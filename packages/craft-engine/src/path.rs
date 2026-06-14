use crate::document::{NodeInput, PathPointInput};
use crate::scene::{GpuVertex, WorldTransform};
use crate::tessellate::tessellate_rounded_rect;

const FLATTEN_EPS: f32 = 0.75;

fn cubic_point(
    t: f32,
    p0: (f32, f32),
    c1: (f32, f32),
    c2: (f32, f32),
    p1: (f32, f32),
) -> (f32, f32) {
    let u = 1.0 - t;
    let uu = u * u;
    let tt = t * t;
    (
        uu * u * p0.0 + 3.0 * uu * t * c1.0 + 3.0 * u * tt * c2.0 + tt * t * p1.0,
        uu * u * p0.1 + 3.0 * uu * t * c1.1 + 3.0 * u * tt * c2.1 + tt * t * p1.1,
    )
}

fn flatten_cubic(
    p0: (f32, f32),
    c1: (f32, f32),
    c2: (f32, f32),
    p1: (f32, f32),
    out: &mut Vec<(f32, f32)>,
) {
    fn flat(p0: (f32, f32), c1: (f32, f32), c2: (f32, f32), p1: (f32, f32)) -> bool {
        let dx = p1.0 - p0.0;
        let dy = p1.1 - p0.1;
        let d1 = (c1.0 - p0.0) * dy - (c1.1 - p0.1) * dx;
        let d2 = (c2.0 - p0.0) * dy - (c2.1 - p0.1) * dx;
        let d3 = (p1.0 - p0.0) * dy - (p1.1 - p0.1) * dx;
        let len_sq = dx * dx + dy * dy;
        if len_sq <= 1e-6 {
            return true;
        }
        let tol = FLATTEN_EPS * FLATTEN_EPS * len_sq;
        d1 * d1 <= tol && d2 * d2 <= tol && d3 * d3 <= tol
    }

    if flat(p0, c1, c2, p1) {
        out.push(p1);
        return;
    }
    let m01 = ((p0.0 + c1.0) * 0.5, (p0.1 + c1.1) * 0.5);
    let m12 = ((c1.0 + c2.0) * 0.5, (c1.1 + c2.1) * 0.5);
    let m23 = ((c2.0 + p1.0) * 0.5, (c2.1 + p1.1) * 0.5);
    let m012 = ((m01.0 + m12.0) * 0.5, (m01.1 + m12.1) * 0.5);
    let m123 = ((m12.0 + m23.0) * 0.5, (m12.1 + m23.1) * 0.5);
    let mid = ((m012.0 + m123.0) * 0.5, (m012.1 + m123.1) * 0.5);
    flatten_cubic(p0, m01, m012, mid, out);
    flatten_cubic(mid, m123, m23, p1, out);
}

pub fn path_to_polyline(points: &[PathPointInput], closed: bool) -> Vec<(f32, f32)> {
    if points.is_empty() {
        return Vec::new();
    }
    let mut out = vec![(points[0].x, points[0].y)];
    for i in 1..points.len() {
        let p0 = &points[i - 1];
        let p1 = &points[i];
        let c1 = (
            p0.x + p0.handle_out.as_ref().map(|h| h.x).unwrap_or(0.0),
            p0.y + p0.handle_out.as_ref().map(|h| h.y).unwrap_or(0.0),
        );
        let c2 = (
            p1.x + p1.handle_in.as_ref().map(|h| h.x).unwrap_or(0.0),
            p1.y + p1.handle_in.as_ref().map(|h| h.y).unwrap_or(0.0),
        );
        let start = (p0.x, p0.y);
        let end = (p1.x, p1.y);
        let curved = p0.handle_out.is_some() || p1.handle_in.is_some();
        if curved {
            flatten_cubic(start, c1, c2, end, &mut out);
        } else {
            out.push(end);
        }
    }
    if closed && points.len() > 2 {
        let p0 = points.last().unwrap();
        let p1 = &points[0];
        let c1 = (
            p0.x + p0.handle_out.as_ref().map(|h| h.x).unwrap_or(0.0),
            p0.y + p0.handle_out.as_ref().map(|h| h.y).unwrap_or(0.0),
        );
        let c2 = (
            p1.x + p1.handle_in.as_ref().map(|h| h.x).unwrap_or(0.0),
            p1.y + p1.handle_in.as_ref().map(|h| h.y).unwrap_or(0.0),
        );
        let start = (p0.x, p0.y);
        let end = (p1.x, p1.y);
        if p0.handle_out.is_some() || p1.handle_in.is_some() {
            flatten_cubic(start, c1, c2, end, &mut out);
        } else {
            out.push(end);
        }
    }
    out
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
    let color_at = |_: f32, _: f32| color;
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

fn tessellate_polyline_fill(
    world: WorldTransform,
    w: f32,
    h: f32,
    poly: &[(f32, f32)],
    closed: bool,
    color: [f32; 4],
    out: &mut Vec<GpuVertex>,
) {
    if poly.len() < 3 {
        return;
    }
    if !closed {
        return;
    }
    let anchor = poly[0];
    for i in 1..poly.len().saturating_sub(1) {
        push_tri(world, w, h, anchor, poly[i], poly[i + 1], color, out);
    }
}


pub fn tessellate_path_node(
    node: &NodeInput,
    world: WorldTransform,
    fill_color: [f32; 4],
    stroke_color: [f32; 4],
    out: &mut Vec<GpuVertex>,
) {
    let Some(points) = node.path_points.as_ref() else {
        let w = node.width.max(1.0);
        let h = node.height.max(1.0);
        let color_at = |_: f32, _: f32| fill_color;
        tessellate_rounded_rect(world, w, h, 0.0, &color_at, out);
        return;
    };
    if points.is_empty() {
        return;
    }
    let w = node.width.max(1.0);
    let h = node.height.max(1.0);
    let closed = node.path_closed.unwrap_or(false);
    let poly = path_to_polyline(points, closed);

    if fill_color[3] > 0.0 {
        tessellate_polyline_fill(world, w, h, &poly, closed, fill_color, out);
    }

    let stroke_width = node.stroke_width.unwrap_or(1.0);
    if stroke_color[3] > 0.0 && stroke_width > 0.0 && node.stroke_enabled {
        crate::stroke_dash::tessellate_polyline_stroke_for_node(
            world,
            w,
            h,
            &poly,
            closed,
            node,
            stroke_width,
            stroke_color,
            out,
        );
    }
}

pub fn tessellate_line_node(
    node: &NodeInput,
    world: WorldTransform,
    stroke_color: [f32; 4],
    out: &mut Vec<GpuVertex>,
) {
    let w = node.width.max(1.0);
    let h = node.height.max(1.0);
    let stroke_width = node.stroke_width.unwrap_or(1.0).max(0.5);
    let y = h * 0.5;
    let poly = vec![(0.0, y), (w, y)];
    crate::stroke_dash::tessellate_polyline_stroke_for_node(
        world,
        w,
        h,
        &poly,
        false,
        node,
        stroke_width,
        stroke_color,
        out,
    );

    if node.kind == "arrow" && stroke_color[3] > 0.0 {
        let head = stroke_width * 3.0;
        let tip = (w, y);
        let back = (w - head, y);
        let p1 = (back.0, back.1 - head * 0.5);
        let p2 = (back.0, back.1 + head * 0.5);
        push_tri(world, w, h, tip, p1, p2, stroke_color, out);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn flattens_curved_path() {
        let points = vec![
            PathPointInput {
                id: "a".into(),
                x: 0.0,
                y: 0.0,
                handle_in: None,
                handle_out: Some(crate::document::PathHandleInput { x: 40.0, y: 0.0 }),
            },
            PathPointInput {
                id: "b".into(),
                x: 80.0,
                y: 40.0,
                handle_in: Some(crate::document::PathHandleInput { x: -20.0, y: 0.0 }),
                handle_out: None,
            },
        ];
        let poly = path_to_polyline(&points, false);
        assert!(poly.len() >= 3);
        assert_eq!(poly[0], (0.0, 0.0));
    }
}
