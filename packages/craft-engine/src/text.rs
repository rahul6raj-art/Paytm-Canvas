use crate::document::{parse_color, NodeInput};
use crate::scene::{GpuVertex, WorldTransform};
use crate::tessellate::tessellate_rounded_rect;
use crate::text_font::RuntimeFontRegistry;
use crate::text_layout::{
    inner_box_width, layout_text_node, letter_spacing_for, line_offset_x_directional, line_top_y,
    text_align_for, vertical_align_for, vertical_content_offset_y, TEXT_BOX_PAD_X, TEXT_BOX_PAD_Y,
};
use crate::text_shaping::{detect_text_direction, justify_word_spacing, shape_text_run};
use rustybuzz::Direction;
use fontdue::Font;

fn try_rasterize_indexed(font: &Font, glyph_id: u32, font_size: f32) -> Option<(fontdue::Metrics, Vec<u8>)> {
    let idx = glyph_id.min(u16::MAX as u32) as u16;
    match std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        font.rasterize_indexed(idx, font_size)
    })) {
        Ok(result) => Some(result),
        Err(_) => None,
    }
}

fn emit_glyph_indexed(
    font: &Font,
    glyph_id: u32,
    gx: f32,
    gy: f32,
    font_size: f32,
    fill_opacity: f32,
    base: [f32; 4],
    world: WorldTransform,
    out: &mut Vec<GpuVertex>,
) {
    let Some((metrics, bitmap)) = try_rasterize_indexed(font, glyph_id, font_size) else {
        return;
    };
    if metrics.width > 0 && metrics.height > 0 {
        let row_stride = metrics.width;
        for row in 0..metrics.height {
            let mut col = 0usize;
            while col < metrics.width {
                let px_idx = row * row_stride + col;
                if px_idx >= bitmap.len() {
                    break;
                }
                let alpha = bitmap[px_idx];
                if alpha == 0 {
                    col += 1;
                    continue;
                }
                let start = col;
                let mut run_alpha = alpha;
                col += 1;
                while col < metrics.width {
                    let px_idx = row * row_stride + col;
                    if px_idx >= bitmap.len() {
                        break;
                    }
                    let a = bitmap[px_idx];
                    if a == 0 {
                        break;
                    }
                    run_alpha = run_alpha.max(a);
                    col += 1;
                }
                let run_w = (col - start) as f32;
                let px = gx + metrics.xmin as f32 + start as f32;
                let py = gy + metrics.ymin as f32 + row as f32;
                let local = WorldTransform::translate(px, py);
                let glyph_world = world.multiply(local);
                let a = (run_alpha as f32 / 255.0) * fill_opacity;
                let row_color = |_: f32, _: f32| [base[0], base[1], base[2], base[3] * a];
                tessellate_rounded_rect(glyph_world, run_w.max(1.0), 1.0, 0.0, &row_color, out);
            }
        }
    }
}

fn render_shaped_run(
    font: &Font,
    font_bytes: &[u8],
    text: &str,
    origin_x: f32,
    origin_y: f32,
    font_size: f32,
    letter_spacing: f32,
    baseline: f32,
    fill_opacity: f32,
    base: [f32; 4],
    world: WorldTransform,
    out: &mut Vec<GpuVertex>,
) {
    let run = shape_text_run(font_bytes, text, font_size, letter_spacing);
    for glyph in run.glyphs {
        let gx = origin_x + glyph.x;
        let gy = origin_y + baseline + glyph.y;
        emit_glyph_indexed(
            font,
            glyph.glyph_id,
            gx,
            gy,
            font_size,
            fill_opacity,
            base,
            world,
            out,
        );
    }
}

fn render_line(
    font: &Font,
    font_bytes: &[u8],
    line: &str,
    line_x: f32,
    line_y: f32,
    font_size: f32,
    letter_spacing: f32,
    baseline: f32,
    align: &str,
    inner_w: f32,
    is_last_line: bool,
    fill_opacity: f32,
    base: [f32; 4],
    world: WorldTransform,
    out: &mut Vec<GpuVertex>,
) {
    if align == "justify" && !is_last_line && line.split_whitespace().count() >= 2 {
        let words: Vec<&str> = line.split_whitespace().collect();
        let shaped_width = shape_text_run(font_bytes, line, font_size, letter_spacing).width;
        let gap = justify_word_spacing(line, shaped_width, inner_w, font_bytes, font_size, letter_spacing);
        let mut pen_x = line_x;
        for (i, word) in words.iter().enumerate() {
            render_shaped_run(
                font,
                font_bytes,
                word,
                pen_x,
                line_y,
                font_size,
                letter_spacing,
                baseline,
                fill_opacity,
                base,
                world,
                out,
            );
            let word_w = shape_text_run(font_bytes, word, font_size, letter_spacing).width;
            pen_x += word_w;
            if i + 1 < words.len() {
                pen_x += letter_spacing + gap;
            }
        }
        return;
    }

    render_shaped_run(
        font,
        font_bytes,
        line,
        line_x,
        line_y,
        font_size,
        letter_spacing,
        baseline,
        fill_opacity,
        base,
        world,
        out,
    );
}

/** rustybuzz shaping + fontdue raster (Regular/Bold). */
pub fn tessellate_text_content(
    node: &NodeInput,
    world: WorldTransform,
    fonts: &RuntimeFontRegistry,
    out: &mut Vec<GpuVertex>,
) {
    let content = node.content.as_deref().unwrap_or("Text");
    if content.is_empty() {
        return;
    }
    let (font, font_bytes) = fonts.resolve_for_node(node);
    let font_size = node.font_size.unwrap_or(16.0).max(8.0);
    let layout = layout_text_node(node, fonts);
    let letter_spacing = letter_spacing_for(node);
    let align = text_align_for(node);
    let inner_w = inner_box_width(node, &layout);
    let inner_h = (node.height - TEXT_BOX_PAD_Y * 2.0).max(1.0);
    let block_y = TEXT_BOX_PAD_Y
        + vertical_content_offset_y(layout.height, inner_h, vertical_align_for(node));
    let baseline = (layout.line_height_px - font_size) * 0.5;

    let base = parse_color(
        node.text_color.as_ref().or(node.fill.as_ref()),
        [0.1, 0.1, 0.1, 1.0],
    );
    let fill_opacity = node.fill_opacity.clamp(0.0, 1.0);
    let last_line = layout.lines.len().saturating_sub(1);

    for (line_index, line) in layout.lines.iter().enumerate() {
        let line_y = block_y + line_top_y(&layout, line_index);
        let rtl = detect_text_direction(&line.text) == Direction::RightToLeft;
        let line_x =
            TEXT_BOX_PAD_X + line_offset_x_directional(line.width, inner_w, align, rtl);
        render_line(
            font,
            font_bytes,
            &line.text,
            line_x,
            line_y,
            font_size,
            letter_spacing,
            baseline,
            align,
            inner_w,
            line_index == last_line,
            fill_opacity,
            base,
            world,
            out,
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::document::NodeInput;
    use crate::text_font::RuntimeFontRegistry;

    fn base_node() -> NodeInput {
        NodeInput {
            id: "t".into(),
            kind: "text".into(),
            parent_id: None,
            visible: true,
            locked: false,
            x: 0.0,
            y: 0.0,
            width: 120.0,
            height: 40.0,
            rotation: 0.0,
            fill_enabled: true,
            fill: None,
            fill_type: None,
            fill_gradient: None,
            fill_opacity: 1.0,
            text_color: Some("#111111".into()),
            corner_radius: None,
            polygon_sides: None,
            clip_children: None,
            stroke_enabled: false,
            stroke: None,
            stroke_color: None,
            stroke_width: None,
            stroke_opacity: 1.0,
            stroke_style: None,
            stroke_dash_length: None,
            stroke_dash_gap: None,
            stroke_linecap: None,
            stroke_linejoin: None,
            effects: None,
            content: Some("Hi".into()),
            font_size: Some(16.0),
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
    fn emits_vertices_for_text() {
        let fonts = RuntimeFontRegistry::default();
        let mut node = base_node();
        let mut out = Vec::new();
        tessellate_text_content(&node, WorldTransform::IDENTITY, &fonts, &mut out);
        assert!(out.len() >= 3, "expected glyph geometry");
        node.content = Some(String::new());
        let mut empty = Vec::new();
        tessellate_text_content(&node, WorldTransform::IDENTITY, &fonts, &mut empty);
        assert!(empty.is_empty());
    }

    #[test]
    fn multiline_text_emits_more_vertices() {
        let fonts = RuntimeFontRegistry::default();
        let mut node = base_node();
        node.height = 80.0;
        let mut single = Vec::new();
        let mut multi = Vec::new();
        node.content = Some("Line".into());
        tessellate_text_content(&node, WorldTransform::IDENTITY, &fonts, &mut single);
        node.content = Some("Line one\nLine two".into());
        tessellate_text_content(&node, WorldTransform::IDENTITY, &fonts, &mut multi);
        assert!(multi.len() > single.len());
    }
}
