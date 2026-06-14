use crate::gradient_gpu::GradientGpuTable;
use crate::scene::GpuVertex;
use crate::viewport::{world_viewport_rect, ViewportState, WorldRect};

fn world_to_pixel(x: f32, y: f32, vp: ViewportState, width: u32, height: u32) -> (i32, i32) {
    let rect = world_viewport_rect(vp);
    let px = ((x - rect.x) / rect.width.max(1.0)) * width as f32;
    let py = ((y - rect.y) / rect.height.max(1.0)) * height as f32;
    (px.round() as i32, py.round() as i32)
}

fn put_pixel(buf: &mut [u8], width: u32, height: u32, x: i32, y: i32, color: [f32; 4]) {
    if x < 0 || y < 0 || x >= width as i32 || y >= height as i32 {
        return;
    }
    let i = ((y as u32 * width + x as u32) * 4) as usize;
    if i + 3 >= buf.len() {
        return;
    }
    let a = color[3].clamp(0.0, 1.0);
    let src_r = (color[0].clamp(0.0, 1.0) * 255.0) as u8;
    let src_g = (color[1].clamp(0.0, 1.0) * 255.0) as u8;
    let src_b = (color[2].clamp(0.0, 1.0) * 255.0) as u8;
    let src_a = (a * 255.0) as u8;
    if src_a == 0 {
        return;
    }
    if src_a == 255 || buf[i + 3] == 0 {
        buf[i] = src_r;
        buf[i + 1] = src_g;
        buf[i + 2] = src_b;
        buf[i + 3] = src_a;
        return;
    }
    let dst_a = buf[i + 3] as f32 / 255.0;
    let out_a = a + dst_a * (1.0 - a);
    if out_a <= 0.0 {
        return;
    }
    let blend = |s: u8, d: u8| -> u8 {
        let sf = s as f32 / 255.0;
        let df = d as f32 / 255.0;
        ((sf * a + df * dst_a * (1.0 - a)) / out_a * 255.0).round() as u8
    };
    buf[i] = blend(src_r, buf[i]);
    buf[i + 1] = blend(src_g, buf[i + 1]);
    buf[i + 2] = blend(src_b, buf[i + 2]);
    buf[i + 3] = (out_a * 255.0).round() as u8;
}

fn vertex_color(grad_table: &GradientGpuTable, v: &GpuVertex) -> [f32; 4] {
    grad_table.resolve_vertex_color(v.color, v.local_x, v.local_y)
}

fn fill_tri(
    buf: &mut [u8],
    width: u32,
    height: u32,
    vp: ViewportState,
    grad_table: &GradientGpuTable,
    a: &GpuVertex,
    b: &GpuVertex,
    c: &GpuVertex,
) {
    let (ax, ay) = world_to_pixel(a.world_x, a.world_y, vp, width, height);
    let (bx, by) = world_to_pixel(b.world_x, b.world_y, vp, width, height);
    let (cx, cy) = world_to_pixel(c.world_x, c.world_y, vp, width, height);
    let min_x = ax.min(bx).min(cx).max(0);
    let min_y = ay.min(by).min(cy).max(0);
    let max_x = ax.max(bx).max(cx).min(width as i32 - 1);
    let max_y = ay.max(by).max(cy).min(height as i32 - 1);
    let denom = (by - cy) as f64 * (ax - cx) as f64 + (cy - ay) as f64 * (bx - cx) as f64;
    if denom.abs() < 1e-6 {
        return;
    }
    for y in min_y..=max_y {
        for x in min_x..=max_x {
            let px = x as f64 + 0.5;
            let py = y as f64 + 0.5;
            let w0 = ((by - cy) as f64 * (px - cx as f64) + (cy - ay) as f64 * (bx as f64 - px)) / denom;
            let w1 = ((cy - ay) as f64 * (px - ax as f64) + (ay - by) as f64 * (cx as f64 - px)) / denom;
            let w2 = 1.0 - w0 - w1;
            if w0 >= -0.001 && w1 >= -0.001 && w2 >= -0.001 {
                let ca = vertex_color(grad_table, a);
                let cb = vertex_color(grad_table, b);
                let cc = vertex_color(grad_table, c);
                let lx = (a.local_x as f64 * w0 + b.local_x as f64 * w1 + c.local_x as f64 * w2) as f32;
                let ly = (a.local_y as f64 * w0 + b.local_y as f64 * w1 + c.local_y as f64 * w2) as f32;
                let mut color = [
                    (ca[0] as f64 * w0 + cb[0] as f64 * w1 + cc[0] as f64 * w2) as f32,
                    (ca[1] as f64 * w0 + cb[1] as f64 * w1 + cc[1] as f64 * w2) as f32,
                    (ca[2] as f64 * w0 + cb[2] as f64 * w1 + cc[2] as f64 * w2) as f32,
                    (ca[3] as f64 * w0 + cb[3] as f64 * w1 + cc[3] as f64 * w2) as f32,
                ];
                if color[3] < 0.0 {
                    color = grad_table.resolve_vertex_color(color, lx, ly);
                }
                put_pixel(buf, width, height, x, y, color);
            }
        }
    }
}

/** CPU raster for native headless export. */
pub fn rasterize_vertices(
    vertices: &[GpuVertex],
    vp: ViewportState,
    width: u32,
    height: u32,
    background: [f32; 4],
    grad_table: &GradientGpuTable,
) -> Vec<u8> {
    let mut buf = vec![0u8; (width * height * 4) as usize];
    let bg = [
        (background[0] * 255.0) as u8,
        (background[1] * 255.0) as u8,
        (background[2] * 255.0) as u8,
        (background[3] * 255.0) as u8,
    ];
    for px in buf.chunks_mut(4) {
        px.copy_from_slice(&bg);
    }
    let mut i = 0usize;
    while i + 2 < vertices.len() {
        fill_tri(
            &mut buf,
            width,
            height,
            vp,
            grad_table,
            &vertices[i],
            &vertices[i + 1],
            &vertices[i + 2],
        );
        i += 3;
    }
    buf
}

pub fn default_export_viewport(css_width: f32, css_height: f32) -> ViewportState {
    ViewportState {
        pan_x: 0.0,
        pan_y: 0.0,
        zoom: 1.0,
        css_width,
        css_height,
    }
}

pub fn scene_bounds_rect(vertices: &[GpuVertex]) -> WorldRect {
    if vertices.is_empty() {
        return WorldRect {
            x: 0.0,
            y: 0.0,
            width: 1.0,
            height: 1.0,
        };
    }
    let mut min_x = vertices[0].world_x;
    let mut min_y = vertices[0].world_y;
    let mut max_x = min_x;
    let mut max_y = min_y;
    for v in vertices {
        min_x = min_x.min(v.world_x);
        min_y = min_y.min(v.world_y);
        max_x = max_x.max(v.world_x);
        max_y = max_y.max(v.world_y);
    }
    WorldRect {
        x: min_x,
        y: min_y,
        width: (max_x - min_x).max(1.0),
        height: (max_y - min_y).max(1.0),
    }
}
