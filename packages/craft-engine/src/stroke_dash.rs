use crate::document::NodeInput;
use crate::scene::{GpuVertex, WorldTransform};

const CAP_SEGS: usize = 6;
const MITER_LIMIT: f32 = 4.0;
const OUTLINE_SEGS: usize = 32;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StrokeCap {
    Butt,
    Round,
    Square,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StrokeJoin {
    Miter,
    Round,
    Bevel,
}

#[derive(Debug, Clone)]
pub struct PolylineStrokeStyle {
    pub dash_pattern: Vec<f32>,
    pub cap: StrokeCap,
    pub join: StrokeJoin,
}

/** Resolve dash lengths from nested `stroke` or legacy flat fields (mirrors TS `resolveStrokeSpec`). */
pub fn stroke_dash_pattern(node: &NodeInput) -> Vec<f32> {
    if let Some(stroke) = node.stroke.as_ref() {
        if let Some(pattern) = stroke.dash_pattern.as_ref() {
            if pattern.is_empty() {
                return Vec::new();
            }
            return pattern.iter().map(|v| v.max(0.0)).collect();
        }
    }

    let style = node.stroke_style.as_deref().unwrap_or("solid");
    if style == "solid" {
        return Vec::new();
    }

    let w = node.stroke_width.unwrap_or(1.0).max(0.5);
    let dash = node
        .stroke_dash_length
        .unwrap_or_else(|| if style == "dotted" { w } else { (w * 4.0).max(2.0) });
    let gap = node.stroke_dash_gap.unwrap_or_else(|| {
        if style == "dotted" {
            w * 1.5
        } else {
            (w * 2.0).max(2.0)
        }
    });
    if dash <= 0.0 && gap <= 0.0 {
        return Vec::new();
    }
    vec![dash.max(0.5), gap.max(0.5)]
}

pub fn stroke_cap_from_node(node: &NodeInput) -> StrokeCap {
    if let Some(cap) = node
        .stroke
        .as_ref()
        .and_then(|s| s.cap.as_deref())
        .or(node.stroke_linecap.as_deref())
    {
        return match cap {
            "round" => StrokeCap::Round,
            "square" => StrokeCap::Square,
            _ => StrokeCap::Butt,
        };
    }
    if node.stroke_style.as_deref() == Some("dotted") {
        return StrokeCap::Round;
    }
    StrokeCap::Butt
}

pub fn stroke_join_from_node(node: &NodeInput) -> StrokeJoin {
    if let Some(join) = node
        .stroke
        .as_ref()
        .and_then(|s| s.join.as_deref())
        .or(node.stroke_linejoin.as_deref())
    {
        return match join {
            "round" => StrokeJoin::Round,
            "bevel" => StrokeJoin::Bevel,
            _ => StrokeJoin::Miter,
        };
    }
    StrokeJoin::Miter
}

pub fn polyline_stroke_style_from_node(node: &NodeInput) -> PolylineStrokeStyle {
    PolylineStrokeStyle {
        dash_pattern: stroke_dash_pattern(node),
        cap: stroke_cap_from_node(node),
        join: stroke_join_from_node(node),
    }
}

fn push_tri(
    world: WorldTransform,
    w: f32,
    h: f32,
    a: (f32, f32),
    b: (f32, f32),
    c: (f32, f32),
    color: [f32; 4],
    out: &mut Vec<GpuVertex>,
) {
    let wa = world.apply_point(a.0, a.1);
    let wb = world.apply_point(b.0, b.1);
    let wc = world.apply_point(c.0, c.1);
    let la = (a.0 / w.max(1.0), a.1 / h.max(1.0));
    let lb = (b.0 / w.max(1.0), b.1 / h.max(1.0));
    let lc = (c.0 / w.max(1.0), c.1 / h.max(1.0));
    out.push(GpuVertex {
        world_x: wa.0,
        world_y: wa.1,
        local_x: la.0,
        local_y: la.1,
        color,
    });
    out.push(GpuVertex {
        world_x: wb.0,
        world_y: wb.1,
        local_x: lb.0,
        local_y: lb.1,
        color,
    });
    out.push(GpuVertex {
        world_x: wc.0,
        world_y: wc.1,
        local_x: lc.0,
        local_y: lc.1,
        color,
    });
}

fn push_segment_quad(
    world: WorldTransform,
    w: f32,
    h: f32,
    a: (f32, f32),
    b: (f32, f32),
    t0: f32,
    t1: f32,
    stroke_width: f32,
    color: [f32; 4],
    out: &mut Vec<GpuVertex>,
) {
    let sw = stroke_width.max(0.5);
    let p0 = (a.0 + (b.0 - a.0) * t0, a.1 + (b.1 - a.1) * t0);
    let p1 = (a.0 + (b.0 - a.0) * t1, a.1 + (b.1 - a.1) * t1);
    let dx = p1.0 - p0.0;
    let dy = p1.1 - p0.1;
    let len = (dx * dx + dy * dy).sqrt();
    if len < 1e-4 {
        return;
    }
    let nx = -dy / len * sw * 0.5;
    let ny = dx / len * sw * 0.5;
    let q0 = (p0.0 + nx, p0.1 + ny);
    let q1 = (p1.0 + nx, p1.1 + ny);
    let q2 = (p1.0 - nx, p1.1 - ny);
    let q3 = (p0.0 - nx, p0.1 - ny);
    push_tri(world, w, h, q0, q1, q2, color, out);
    push_tri(world, w, h, q0, q2, q3, color, out);
}

fn push_round_cap(
    world: WorldTransform,
    w: f32,
    h: f32,
    cx: f32,
    cy: f32,
    radius: f32,
    color: [f32; 4],
    out: &mut Vec<GpuVertex>,
) {
    let center = (cx, cy);
    for i in 0..CAP_SEGS {
        let a0 = std::f32::consts::TAU * i as f32 / CAP_SEGS as f32;
        let a1 = std::f32::consts::TAU * (i + 1) as f32 / CAP_SEGS as f32;
        let p0 = (cx + radius * a0.cos(), cy + radius * a0.sin());
        let p1 = (cx + radius * a1.cos(), cy + radius * a1.sin());
        push_tri(world, w, h, center, p0, p1, color, out);
    }
}

fn push_square_cap(
    world: WorldTransform,
    w: f32,
    h: f32,
    cx: f32,
    cy: f32,
    tx: f32,
    ty: f32,
    radius: f32,
    color: [f32; 4],
    at_start: bool,
    out: &mut Vec<GpuVertex>,
) {
    let len = (tx * tx + ty * ty).sqrt().max(1e-6);
    let ux = tx / len;
    let uy = ty / len;
    let px = -uy;
    let py = ux;
    let sign = if at_start { -1.0 } else { 1.0 };
    let tip = (cx + sign * ux * radius, cy + sign * uy * radius);
    let c0 = (cx + px * radius, cy + py * radius);
    let c1 = (cx - px * radius, cy - py * radius);
    push_tri(world, w, h, tip, c0, c1, color, out);
}

fn line_intersect(a1: (f32, f32), a2: (f32, f32), b1: (f32, f32), b2: (f32, f32)) -> Option<(f32, f32)> {
    let dxa = a2.0 - a1.0;
    let dya = a2.1 - a1.1;
    let dxb = b2.0 - b1.0;
    let dyb = b2.1 - b1.1;
    let denom = dxa * dyb - dya * dxb;
    if denom.abs() < 1e-6 {
        return None;
    }
    let t = ((b1.0 - a1.0) * dyb - (b1.1 - a1.1) * dxb) / denom;
    Some((a1.0 + dxa * t, a1.1 + dya * t))
}

fn push_bevel_join(
    world: WorldTransform,
    w: f32,
    h: f32,
    prev: (f32, f32),
    curr: (f32, f32),
    next: (f32, f32),
    half: f32,
    color: [f32; 4],
    out: &mut Vec<GpuVertex>,
) {
    let dx1 = curr.0 - prev.0;
    let dy1 = curr.1 - prev.1;
    let dx2 = next.0 - curr.0;
    let dy2 = next.1 - curr.1;
    let len1 = (dx1 * dx1 + dy1 * dy1).sqrt().max(1e-6);
    let len2 = (dx2 * dx2 + dy2 * dy2).sqrt().max(1e-6);
    let ux1 = dx1 / len1;
    let uy1 = dy1 / len1;
    let ux2 = dx2 / len2;
    let uy2 = dy2 / len2;
    let n1x = -uy1 * half;
    let n1y = ux1 * half;
    let n2x = -uy2 * half;
    let n2y = ux2 * half;
    let l1 = (curr.0 + n1x, curr.1 + n1y);
    let l2 = (curr.0 + n2x, curr.1 + n2y);
    let r1 = (curr.0 - n1x, curr.1 - n1y);
    let r2 = (curr.0 - n2x, curr.1 - n2y);
    push_tri(world, w, h, l1, l2, curr, color, out);
    push_tri(world, w, h, r2, r1, curr, color, out);
}

fn push_miter_join(
    world: WorldTransform,
    w: f32,
    h: f32,
    prev: (f32, f32),
    curr: (f32, f32),
    next: (f32, f32),
    half: f32,
    color: [f32; 4],
    out: &mut Vec<GpuVertex>,
) {
    let dx1 = curr.0 - prev.0;
    let dy1 = curr.1 - prev.1;
    let dx2 = next.0 - curr.0;
    let dy2 = next.1 - curr.1;
    let len1 = (dx1 * dx1 + dy1 * dy1).sqrt().max(1e-6);
    let len2 = (dx2 * dx2 + dy2 * dy2).sqrt().max(1e-6);
    let ux1 = dx1 / len1;
    let uy1 = dy1 / len1;
    let ux2 = dx2 / len2;
    let uy2 = dy2 / len2;
    let n1x = -uy1 * half;
    let n1y = ux1 * half;
    let n2x = -uy2 * half;
    let n2y = ux2 * half;
    let l1 = (curr.0 + n1x, curr.1 + n1y);
    let l2 = (curr.0 + n2x, curr.1 + n2y);
    let r1 = (curr.0 - n1x, curr.1 - n1y);
    let r2 = (curr.0 - n2x, curr.1 - n2y);

    if let Some(ml) = line_intersect(l1, (l1.0 + ux1, l1.1 + uy1), l2, (l2.0 + ux2, l2.1 + uy2)) {
        let dist = ((ml.0 - curr.0).powi(2) + (ml.1 - curr.1).powi(2)).sqrt();
        if dist <= half * MITER_LIMIT {
            push_tri(world, w, h, l1, ml, l2, color, out);
            if let Some(mr) = line_intersect(r1, (r1.0 + ux1, r1.1 + uy1), r2, (r2.0 + ux2, r2.1 + uy2))
            {
                push_tri(world, w, h, r2, mr, r1, color, out);
            }
            return;
        }
    }
    push_bevel_join(world, w, h, prev, curr, next, half, color, out);
}

fn push_round_join(
    world: WorldTransform,
    w: f32,
    h: f32,
    curr: (f32, f32),
    half: f32,
    color: [f32; 4],
    out: &mut Vec<GpuVertex>,
) {
    push_round_cap(world, w, h, curr.0, curr.1, half, color, out);
}

fn push_endpoint_cap(
    world: WorldTransform,
    w: f32,
    h: f32,
    point: (f32, f32),
    tangent_x: f32,
    tangent_y: f32,
    half: f32,
    cap: StrokeCap,
    at_start: bool,
    color: [f32; 4],
    out: &mut Vec<GpuVertex>,
) {
    match cap {
        StrokeCap::Round => push_round_cap(world, w, h, point.0, point.1, half, color, out),
        StrokeCap::Square => {
            push_square_cap(
                world,
                w,
                h,
                point.0,
                point.1,
                tangent_x,
                tangent_y,
                half,
                color,
                at_start,
                out,
            );
        }
        StrokeCap::Butt => {}
    }
}

fn push_join(
    world: WorldTransform,
    w: f32,
    h: f32,
    prev: (f32, f32),
    curr: (f32, f32),
    next: (f32, f32),
    half: f32,
    join: StrokeJoin,
    color: [f32; 4],
    out: &mut Vec<GpuVertex>,
) {
    match join {
        StrokeJoin::Miter => push_miter_join(world, w, h, prev, curr, next, half, color, out),
        StrokeJoin::Bevel => push_bevel_join(world, w, h, prev, curr, next, half, color, out),
        StrokeJoin::Round => push_round_join(world, w, h, curr, half, color, out),
    }
}

fn tessellate_solid_polyline_stroke(
    world: WorldTransform,
    w: f32,
    h: f32,
    poly: &[(f32, f32)],
    closed: bool,
    stroke_width: f32,
    color: [f32; 4],
    style: &PolylineStrokeStyle,
    out: &mut Vec<GpuVertex>,
) {
    if poly.len() < 2 {
        return;
    }
    let half = stroke_width.max(0.5) * 0.5;
    let n = poly.len();
    let seg_count = if closed { n } else { n - 1 };

    for i in 0..seg_count {
        let a = poly[i];
        let b = poly[(i + 1) % n];
        push_segment_quad(world, w, h, a, b, 0.0, 1.0, stroke_width, color, out);
    }

    if !closed {
        let dx = poly[1].0 - poly[0].0;
        let dy = poly[1].1 - poly[0].1;
        push_endpoint_cap(
            world,
            w,
            h,
            poly[0],
            dx,
            dy,
            half,
            style.cap,
            true,
            color,
            out,
        );
        let last = n - 1;
        let dx = poly[last].0 - poly[last - 1].0;
        let dy = poly[last].1 - poly[last - 1].1;
        push_endpoint_cap(
            world,
            w,
            h,
            poly[last],
            dx,
            dy,
            half,
            style.cap,
            false,
            color,
            out,
        );
    }

    if seg_count >= 2 {
        for i in 0..n {
            if !closed && (i == 0 || i == n - 1) {
                continue;
            }
            let prev = poly[(i + n - 1) % n];
            let curr = poly[i];
            let next = poly[(i + 1) % n];
            push_join(world, w, h, prev, curr, next, half, style.join, color, out);
        }
    }
}

fn tessellate_dashed_polyline_stroke(
    world: WorldTransform,
    w: f32,
    h: f32,
    poly: &[(f32, f32)],
    closed: bool,
    stroke_width: f32,
    color: [f32; 4],
    dash_pattern: &[f32],
    cap: StrokeCap,
    out: &mut Vec<GpuVertex>,
) {
    if poly.len() < 2 || dash_pattern.is_empty() {
        return;
    }
    let half = stroke_width.max(0.5) * 0.5;
    let count = if closed { poly.len() } else { poly.len() - 1 };
    let mut pattern_i = 0usize;
    let mut pattern_remain = dash_pattern[0].max(0.5);
    let mut drawing = true;

    for seg in 0..count {
        let a = poly[seg];
        let b = poly[(seg + 1) % poly.len()];
        let dx = b.0 - a.0;
        let dy = b.1 - a.1;
        let len = (dx * dx + dy * dy).sqrt();
        if len < 1e-6 {
            continue;
        }
        let mut traveled = 0.0f32;
        while traveled < len - 1e-6 {
            let seg_remain = len - traveled;
            let step = seg_remain.min(pattern_remain);
            if drawing && step > 1e-4 {
                let t0 = traveled / len;
                let t1 = (traveled + step) / len;
                push_segment_quad(world, w, h, a, b, t0, t1, stroke_width, color, out);
                if cap == StrokeCap::Round {
                    let p0 = (a.0 + dx * t0, a.1 + dy * t0);
                    let p1 = (a.0 + dx * t1, a.1 + dy * t1);
                    push_round_cap(world, w, h, p0.0, p0.1, half, color, out);
                    push_round_cap(world, w, h, p1.0, p1.1, half, color, out);
                } else if cap == StrokeCap::Square {
                    let p0 = (a.0 + dx * t0, a.1 + dy * t0);
                    let p1 = (a.0 + dx * t1, a.1 + dy * t1);
                    push_square_cap(world, w, h, p0.0, p0.1, dx, dy, half, color, true, out);
                    push_square_cap(world, w, h, p1.0, p1.1, dx, dy, half, color, false, out);
                }
            }
            traveled += step;
            pattern_remain -= step;
            if pattern_remain <= 1e-4 {
                pattern_i = (pattern_i + 1) % dash_pattern.len();
                pattern_remain = dash_pattern[pattern_i].max(0.5);
                drawing = pattern_i % 2 == 0;
            }
        }
    }
}

/** Stroke along a polyline using node stroke style. */
pub fn tessellate_polyline_stroke_for_node(
    world: WorldTransform,
    w: f32,
    h: f32,
    poly: &[(f32, f32)],
    closed: bool,
    node: &NodeInput,
    stroke_width: f32,
    color: [f32; 4],
    out: &mut Vec<GpuVertex>,
) {
    let style = polyline_stroke_style_from_node(node);
    tessellate_polyline_stroke(
        world,
        w,
        h,
        poly,
        closed,
        stroke_width,
        color,
        &style,
        out,
    );
}

/** Stroke along a polyline; solid when `dash_pattern` is empty. */
pub fn tessellate_polyline_stroke(
    world: WorldTransform,
    w: f32,
    h: f32,
    poly: &[(f32, f32)],
    closed: bool,
    stroke_width: f32,
    color: [f32; 4],
    style: &PolylineStrokeStyle,
    out: &mut Vec<GpuVertex>,
) {
    if style.dash_pattern.is_empty() {
        tessellate_solid_polyline_stroke(world, w, h, poly, closed, stroke_width, color, style, out);
    } else {
        tessellate_dashed_polyline_stroke(
            world,
            w,
            h,
            poly,
            closed,
            stroke_width,
            color,
            &style.dash_pattern,
            style.cap,
            out,
        );
    }
}

pub fn ellipse_outline(w: f32, h: f32) -> Vec<(f32, f32)> {
    let cx = w * 0.5;
    let cy = h * 0.5;
    let rx = w * 0.5;
    let ry = h * 0.5;
    (0..OUTLINE_SEGS)
        .map(|i| {
            let t = i as f32 / OUTLINE_SEGS as f32 * std::f32::consts::TAU;
            (cx + rx * t.cos(), cy + ry * t.sin())
        })
        .collect()
}

pub fn polygon_outline(w: f32, h: f32, sides: u32) -> Vec<(f32, f32)> {
    crate::tessellate::regular_polygon_local(w, h, sides)
}

fn rect_stroke_outline(w: f32, h: f32, node: &NodeInput) -> Vec<(f32, f32)> {
    let radius = node.corner_radius.unwrap_or(0.0);
    crate::tessellate::rounded_rect_outline(w, h, radius)
}

/** Rectangle/frame border stroke along centerline (supports corner radius + dashes). */
pub fn tessellate_rect_stroke(
    world: WorldTransform,
    w: f32,
    h: f32,
    stroke_width: f32,
    color: [f32; 4],
    node: &NodeInput,
    out: &mut Vec<GpuVertex>,
) {
    let style = polyline_stroke_style_from_node(node);
    let radius = node.corner_radius.unwrap_or(0.0);
    let r = radius.max(0.0).min(w * 0.5).min(h * 0.5);
    let sharp_fast_path = r <= 0.5
        && style.dash_pattern.is_empty()
        && style.cap == StrokeCap::Butt
        && style.join == StrokeJoin::Miter;
    if sharp_fast_path {
        crate::tessellate::tessellate_stroke_rect(world, w, h, stroke_width, color, out);
        return;
    }
    let poly = rect_stroke_outline(w, h, node);
    tessellate_polyline_stroke(world, w, h, &poly, true, stroke_width, color, &style, out);
}

pub fn tessellate_ellipse_stroke(
    world: WorldTransform,
    w: f32,
    h: f32,
    stroke_width: f32,
    color: [f32; 4],
    node: &NodeInput,
    out: &mut Vec<GpuVertex>,
) {
    let poly = ellipse_outline(w, h);
    tessellate_polyline_stroke_for_node(world, w, h, &poly, true, node, stroke_width, color, out);
}

pub fn tessellate_polygon_stroke(
    world: WorldTransform,
    w: f32,
    h: f32,
    sides: u32,
    stroke_width: f32,
    color: [f32; 4],
    node: &NodeInput,
    out: &mut Vec<GpuVertex>,
) {
    let poly = polygon_outline(w, h, sides);
    tessellate_polyline_stroke_for_node(world, w, h, &poly, true, node, stroke_width, color, out);
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::document::NodeInput;

    fn base_node() -> NodeInput {
        NodeInput {
            id: "n".into(),
            kind: "rectangle".into(),
            parent_id: None,
            visible: true,
            locked: false,
            x: 0.0,
            y: 0.0,
            width: 100.0,
            height: 50.0,
            rotation: 0.0,
            fill_enabled: true,
            fill: Some("#fff".into()),
            fill_type: None,
            fill_gradient: None,
            fill_opacity: 1.0,
            text_color: None,
            corner_radius: None,
            polygon_sides: None,
            clip_children: None,
            stroke_enabled: true,
            stroke: None,
            stroke_color: Some("#000".into()),
            stroke_width: Some(2.0),
            stroke_opacity: 1.0,
            stroke_style: None,
            stroke_dash_length: None,
            stroke_dash_gap: None,
            stroke_linecap: None,
            stroke_linejoin: None,
            effects: None,
            content: None,
            font_size: None,
            font_family: None,
            font_weight: None,
            line_height: None,
            letter_spacing: None,
            text_align: None,
            vertical_align: None,
            text_resize_mode: None,
            auto_resize: None,
            paragraph_spacing: None,
            asset_id: None,
            image_src: None,
            path_points: None,
            path_closed: None,
        }
    }

    #[test]
    fn solid_style_has_empty_pattern() {
        let node = base_node();
        assert!(stroke_dash_pattern(&node).is_empty());
    }

    #[test]
    fn dashed_style_resolves_lengths() {
        let mut node = base_node();
        node.stroke_style = Some("dashed".into());
        node.stroke_dash_length = Some(8.0);
        node.stroke_dash_gap = Some(4.0);
        assert_eq!(stroke_dash_pattern(&node), vec![8.0, 4.0]);
    }

    #[test]
    fn dashed_polyline_splits_into_multiple_segments() {
        let poly = vec![(0.0, 0.0), (100.0, 0.0)];
        let world = WorldTransform::IDENTITY;
        let color = [0.0, 0.0, 0.0, 1.0];
        let style = PolylineStrokeStyle {
            dash_pattern: vec![10.0, 10.0],
            cap: StrokeCap::Butt,
            join: StrokeJoin::Miter,
        };
        let mut solid = Vec::new();
        let mut dashed = Vec::new();
        tessellate_polyline_stroke(
            world,
            100.0,
            1.0,
            &poly,
            false,
            2.0,
            color,
            &PolylineStrokeStyle {
                dash_pattern: vec![],
                cap: StrokeCap::Butt,
                join: StrokeJoin::Miter,
            },
            &mut solid,
        );
        tessellate_polyline_stroke(world, 100.0, 1.0, &poly, false, 2.0, color, &style, &mut dashed);
        assert!(solid.len() >= 6);
        assert!(dashed.len() >= 30);
    }

    #[test]
    fn round_cap_adds_vertices_on_dashed_line() {
        let poly = vec![(0.0, 0.0), (40.0, 0.0)];
        let world = WorldTransform::IDENTITY;
        let color = [0.0, 0.0, 0.0, 1.0];
        let butt = PolylineStrokeStyle {
            dash_pattern: vec![6.0, 6.0],
            cap: StrokeCap::Butt,
            join: StrokeJoin::Miter,
        };
        let round = PolylineStrokeStyle {
            dash_pattern: vec![6.0, 6.0],
            cap: StrokeCap::Round,
            join: StrokeJoin::Miter,
        };
        let mut butt_out = Vec::new();
        let mut round_out = Vec::new();
        tessellate_polyline_stroke(world, 40.0, 1.0, &poly, false, 4.0, color, &butt, &mut butt_out);
        tessellate_polyline_stroke(world, 40.0, 1.0, &poly, false, 4.0, color, &round, &mut round_out);
        assert!(round_out.len() > butt_out.len());
    }

    #[test]
    fn rounded_rect_dashed_stroke_has_more_vertices_than_sharp() {
        let world = WorldTransform::IDENTITY;
        let color = [0.0, 0.0, 0.0, 1.0];
        let mut sharp = base_node();
        sharp.corner_radius = Some(0.0);
        sharp.stroke_style = Some("dashed".into());
        sharp.stroke_dash_length = Some(8.0);
        sharp.stroke_dash_gap = Some(4.0);
        let mut rounded = sharp.clone();
        rounded.corner_radius = Some(16.0);
        let mut sharp_out = Vec::new();
        let mut rounded_out = Vec::new();
        tessellate_rect_stroke(world, 100.0, 50.0, 2.0, color, &sharp, &mut sharp_out);
        tessellate_rect_stroke(world, 100.0, 50.0, 2.0, color, &rounded, &mut rounded_out);
        assert!(sharp_out.len() > 0);
        assert!(rounded_out.len() > sharp_out.len());
    }

    #[test]
    fn ellipse_outline_has_expected_segments() {
        let poly = ellipse_outline(80.0, 40.0);
        assert_eq!(poly.len(), OUTLINE_SEGS);
        let (x, y) = poly[0];
        assert!((x - 80.0).abs() < 0.01);
        assert!((y - 20.0).abs() < 0.01);
    }
}
