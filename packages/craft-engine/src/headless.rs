use crate::document::DocumentInput;
use crate::gradient_gpu::GradientGpuTable;
use crate::scene::collect_vertices;
use crate::text_font::RuntimeFontRegistry;
use crate::software::{default_export_viewport, rasterize_vertices};
use crate::viewport::ViewportState;

#[cfg(not(target_arch = "wasm32"))]
pub fn render_document_png(
    doc: &DocumentInput,
    width: u32,
    height: u32,
    background: [f32; 4],
) -> Result<Vec<u8>, String> {
    let vp = default_export_viewport(width as f32, height as f32);
    let grad_table = GradientGpuTable::from_document(doc);
    let fonts = RuntimeFontRegistry::default();
    let vertices = collect_vertices(doc, vp, &fonts);
    let rgba = rasterize_vertices(&vertices, vp, width, height, background, &grad_table);
    let img =
        image::RgbaImage::from_raw(width, height, rgba)
            .ok_or_else(|| String::from("invalid image buffer"))?;
    let mut out = Vec::new();
    let mut cursor = std::io::Cursor::new(&mut out);
    img.write_to(
        &mut cursor,
        image::ImageFormat::Png,
    )
    .map_err(|e| format!("png encode: {e}"))?;
    Ok(out)
}

#[cfg(not(target_arch = "wasm32"))]
pub fn render_document_png_auto_size(
    doc: &DocumentInput,
    padding: f32,
) -> Result<(Vec<u8>, u32, u32), String> {
    let vp = ViewportState {
        pan_x: 0.0,
        pan_y: 0.0,
        zoom: 1.0,
        css_width: 1920.0,
        css_height: 1080.0,
    };
    let grad_table = GradientGpuTable::from_document(doc);
    let fonts = RuntimeFontRegistry::default();
    let vertices = collect_vertices(doc, vp, &fonts);
    let bounds = crate::software::scene_bounds_rect(&vertices);
    let width = (bounds.width + padding * 2.0).ceil().max(64.0) as u32;
    let height = (bounds.height + padding * 2.0).ceil().max(64.0) as u32;
    let export_vp = ViewportState {
        pan_x: -bounds.x + padding,
        pan_y: -bounds.y + padding,
        zoom: 1.0,
        css_width: width as f32,
        css_height: height as f32,
    };
    let verts = collect_vertices(doc, export_vp, &fonts);
    let rgba = rasterize_vertices(
        &verts,
        export_vp,
        width,
        height,
        [1.0, 1.0, 1.0, 1.0],
        &grad_table,
    );
    let img =
        image::RgbaImage::from_raw(width, height, rgba)
            .ok_or_else(|| String::from("invalid image buffer"))?;
    let mut out = Vec::new();
    let mut cursor = std::io::Cursor::new(&mut out);
    img.write_to(&mut cursor, image::ImageFormat::Png)
        .map_err(|e| format!("png encode: {e}"))?;
    Ok((out, width, height))
}
