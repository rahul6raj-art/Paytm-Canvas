use crate::scene::{GpuVertex, WorldTransform};

const SEGMENTS: usize = 32;

type Vtx = ((f32, f32), (f32, f32));

fn world_local(world: WorldTransform, lx: f32, ly: f32, w: f32, h: f32) -> Vtx {
    let p = world.apply_point(lx, ly);
    (p, (lx / w.max(1.0), ly / h.max(1.0)))
}

fn world_only(world: WorldTransform, lx: f32, ly: f32) -> Vtx {
    let p = world.apply_point(lx, ly);
    (p, (0.0, 0.0))
}

fn push_tri(out: &mut Vec<GpuVertex>, a: Vtx, b: Vtx, c: Vtx, ca: [f32; 4], cb: [f32; 4], cc: [f32; 4]) {
    out.push(GpuVertex {
        world_x: a.0.0,
        world_y: a.0.1,
        local_x: a.1.0,
        local_y: a.1.1,
        color: ca,
    });
    out.push(GpuVertex {
        world_x: b.0.0,
        world_y: b.0.1,
        local_x: b.1.0,
        local_y: b.1.1,
        color: cb,
    });
    out.push(GpuVertex {
        world_x: c.0.0,
        world_y: c.0.1,
        local_x: c.1.0,
        local_y: c.1.1,
        color: cc,
    });
}

/** Closed centerline path for a rounded rectangle (matches fill corner tessellation). */
pub fn rounded_rect_outline(w: f32, h: f32, radius: f32) -> Vec<(f32, f32)> {
    let r = radius.max(0.0).min(w * 0.5).min(h * 0.5);
    if r <= 0.5 {
        return vec![(0.0, 0.0), (w, 0.0), (w, h), (0.0, h)];
    }

    let arc = SEGMENTS / 4;
    let mut ring: Vec<(f32, f32)> = Vec::with_capacity(8 + arc * 4);
    ring.push((r, 0.0));
    ring.push((w - r, 0.0));
    for i in 1..=arc {
        let t = std::f32::consts::PI * 1.5 + (std::f32::consts::PI * 0.5) * (i as f32 / arc as f32);
        ring.push((w - r + r * t.cos(), r + r * t.sin()));
    }
    ring.push((w, h - r));
    for i in 1..=arc {
        let t = (std::f32::consts::PI * 0.5) * (i as f32 / arc as f32);
        ring.push((w - r + r * t.cos(), h - r + r * t.sin()));
    }
    ring.push((r, h));
    for i in 1..=arc {
        let t = std::f32::consts::PI * 0.5 + (std::f32::consts::PI * 0.5) * (i as f32 / arc as f32);
        ring.push((r + r * t.cos(), h - r + r * t.sin()));
    }
    ring.push((0.0, r));
    for i in 1..=arc {
        let t = std::f32::consts::PI + (std::f32::consts::PI * 0.5) * (i as f32 / arc as f32);
        ring.push((r + r * t.cos(), r + r * t.sin()));
    }
    ring
}

pub fn tessellate_rounded_rect<F: Fn(f32, f32) -> [f32; 4]>(
    world: WorldTransform,
    w: f32,
    h: f32,
    radius: f32,
    color_at: &F,
    out: &mut Vec<GpuVertex>,
) {
    let r = radius.max(0.0).min(w * 0.5).min(h * 0.5);
    if r <= 0.5 {
        let corners = [(0.0, 0.0), (w, 0.0), (w, h), (0.0, h)];
        let colors: Vec<_> = corners
            .iter()
            .map(|(lx, ly)| color_at(*lx / w.max(1.0), *ly / h.max(1.0)))
            .collect();
        let p: Vec<_> = corners
            .iter()
            .map(|(lx, ly)| world_local(world, *lx, *ly, w, h))
            .collect();
        push_tri(out, p[0], p[1], p[2], colors[0], colors[1], colors[2]);
        push_tri(out, p[0], p[2], p[3], colors[0], colors[2], colors[3]);
        return;
    }

    let ring = rounded_rect_outline(w, h, r);

    let center_lx = w * 0.5;
    let center_ly = h * 0.5;
    let center = world_local(world, center_lx, center_ly, w, h);
    let center_c = color_at(center_lx / w, center_ly / h);
    let first_l = ring[0];
    let first = world_local(world, first_l.0, first_l.1, w, h);
    let first_c = color_at(first_l.0 / w, first_l.1 / h);
    let mut prev = first;
    let mut prev_c = first_c;
    for p in ring.iter().skip(1) {
        let next = world_local(world, p.0, p.1, w, h);
        let next_c = color_at(p.0 / w, p.1 / h);
        push_tri(out, center, prev, next, center_c, prev_c, next_c);
        prev = next;
        prev_c = next_c;
    }
    push_tri(out, center, prev, first, center_c, prev_c, first_c);
}

pub fn tessellate_ellipse<F: Fn(f32, f32) -> [f32; 4]>(
    world: WorldTransform,
    w: f32,
    h: f32,
    color_at: &F,
    out: &mut Vec<GpuVertex>,
) {
    let cx = w * 0.5;
    let cy = h * 0.5;
    let rx = w * 0.5;
    let ry = h * 0.5;
    let center = world_local(world, cx, cy, w, h);
    let center_c = color_at(0.5, 0.5);
    let mut prev = world_local(world, cx + rx, cy, w, h);
    let mut prev_c = color_at(1.0, 0.5);
    for i in 1..=SEGMENTS {
        let t = (i as f32 / SEGMENTS as f32) * std::f32::consts::TAU;
        let lx = cx + rx * t.cos();
        let ly = cy + ry * t.sin();
        let next = world_local(world, lx, ly, w, h);
        let next_c = color_at(lx / w.max(1.0), ly / h.max(1.0));
        push_tri(out, center, prev, next, center_c, prev_c, next_c);
        prev = next;
        prev_c = next_c;
    }
}

fn fit_polygon_to_box(raw: &[(f32, f32)], w: f32, h: f32) -> Vec<(f32, f32)> {
    if raw.is_empty() {
        return Vec::new();
    }
    let mut min_x = f32::INFINITY;
    let mut min_y = f32::INFINITY;
    let mut max_x = f32::NEG_INFINITY;
    let mut max_y = f32::NEG_INFINITY;
    for &(x, y) in raw {
        min_x = min_x.min(x);
        min_y = min_y.min(y);
        max_x = max_x.max(x);
        max_y = max_y.max(y);
    }
    let span_x = max_x - min_x;
    let span_y = max_y - min_y;
    if span_x < 1e-6 || span_y < 1e-6 {
        return raw.to_vec();
    }
    raw.iter()
        .map(|&(x, y)| (((x - min_x) / span_x) * w, ((y - min_y) / span_y) * h))
        .collect()
}

pub fn regular_polygon_local(w: f32, h: f32, sides: u32) -> Vec<(f32, f32)> {
    let n = sides.clamp(3, 12) as usize;
    let cx = w * 0.5;
    let cy = h * 0.5;
    let rx = w * 0.5;
    let ry = h * 0.5;
    let raw: Vec<(f32, f32)> = (0..n)
        .map(|i| {
            let t = i as f32 / n as f32 * std::f32::consts::TAU - std::f32::consts::FRAC_PI_2;
            (cx + rx * t.cos(), cy + ry * t.sin())
        })
        .collect();
    fit_polygon_to_box(&raw, w, h)
}

pub fn tessellate_polygon<F: Fn(f32, f32) -> [f32; 4]>(
    world: WorldTransform,
    w: f32,
    h: f32,
    sides: u32,
    color_at: &F,
    out: &mut Vec<GpuVertex>,
) {
    let n = sides.clamp(3, 12) as usize;
    let verts = regular_polygon_local(w, h, sides);
    if verts.len() < 3 {
        return;
    }
    let center = world_local(world, w * 0.5, h * 0.5, w, h);
    let center_c = color_at(0.5, 0.5);
    let (first_x, first_y) = verts[0];
    let mut prev = world_local(world, first_x, first_y, w, h);
    let mut prev_c = color_at(first_x / w.max(1.0), first_y / h.max(1.0));
    for i in 1..n {
        let (lx, ly) = verts[i];
        let next = world_local(world, lx, ly, w, h);
        let next_c = color_at(lx / w.max(1.0), ly / h.max(1.0));
        push_tri(out, center, prev, next, center_c, prev_c, next_c);
        prev = next;
        prev_c = next_c;
    }
}

pub fn tessellate_stroke_rect(
    world: WorldTransform,
    w: f32,
    h: f32,
    stroke_width: f32,
    color: [f32; 4],
    out: &mut Vec<GpuVertex>,
) {
    let sw = stroke_width.max(0.5);
    let half = sw * 0.5;
    let outer = [
        world_only(world, -half, -half),
        world_only(world, w + half, -half),
        world_only(world, w + half, h + half),
        world_only(world, -half, h + half),
    ];
    let inner = [
        world_only(world, half, half),
        world_only(world, w - half, half),
        world_only(world, w - half, h - half),
        world_only(world, half, h - half),
    ];
    for i in 0..4 {
        let j = (i + 1) % 4;
        push_tri(out, outer[i], outer[j], inner[j], color, color, color);
        push_tri(out, outer[i], inner[j], inner[i], color, color, color);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sharp_outline_is_four_corners() {
        let poly = rounded_rect_outline(100.0, 50.0, 0.0);
        assert_eq!(poly.len(), 4);
    }

    #[test]
    fn rounded_outline_has_arc_segments() {
        let poly = rounded_rect_outline(100.0, 50.0, 12.0);
        assert!(poly.len() > 8);
        assert_eq!(poly[0], (12.0, 0.0));
    }
}
