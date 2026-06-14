use crate::document::NodeInput;
use crate::text_font::{
    embedded_family_from_name, primary_family_name, RuntimeFontRegistry,
};
use crate::text_layout::{
    inner_box_width, layout_text_node, line_offset_x_directional, line_top_y,
    letter_spacing_for, text_align_for, vertical_align_for, vertical_content_offset_y,
    TextLayout, TEXT_BOX_PAD_X, TEXT_BOX_PAD_Y,
};
use crate::text_shaping::{detect_text_direction, justify_word_spacing, shape_text_run};
use rustybuzz::Direction;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TextLayoutRequest {
    pub node: NodeInput,
    #[serde(default)]
    pub display_content: Option<String>,
    #[serde(default)]
    pub paragraph_spacing: Option<f32>,
    #[serde(default)]
    pub vertical_trim_top: Option<f32>,
    #[serde(default)]
    pub effective_font_size: Option<f32>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CanonicalLineSegment {
    pub text: String,
    pub x: f32,
    pub y: f32,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CanonicalLine {
    pub text: String,
    pub start_index: usize,
    pub width: f32,
    pub paragraph_start: bool,
    pub x: f32,
    pub y: f32,
    pub segments: Vec<CanonicalLineSegment>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CaretStop {
    pub index: usize,
    pub x: f32,
    pub y: f32,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GlyphBox {
    pub index: usize,
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
    pub glyph_id: u32,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FontResolution {
    pub requested_family: String,
    pub resolved_family: String,
    pub fallback_used: bool,
    pub missing: bool,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CanonicalTextLayout {
    pub source: String,
    pub lines: Vec<CanonicalLine>,
    pub width: f32,
    pub height: f32,
    pub line_height_px: f32,
    pub paragraph_spacing: f32,
    pub vertical_trim_top: f32,
    pub inner_w: f32,
    pub inner_h: f32,
    pub block_offset_y: f32,
    pub caret_stops: Vec<CaretStop>,
    pub glyphs: Vec<GlyphBox>,
    pub font: FontResolution,
    pub rtl: bool,
}

fn layout_node_for_request(req: &TextLayoutRequest) -> (NodeInput, f32) {
    let mut node = req.node.clone();
    if let Some(content) = &req.display_content {
        node.content = Some(content.clone());
    }
    if let Some(ps) = req.paragraph_spacing {
        node.paragraph_spacing = Some(ps.max(0.0));
    }
    let font_size = req
        .effective_font_size
        .or(req.node.font_size)
        .unwrap_or(16.0)
        .max(8.0);
    node.font_size = Some(font_size);
    (node, font_size)
}

fn resolve_font_metadata(node: &NodeInput, fonts: &RuntimeFontRegistry) -> FontResolution {
    let stack = node
        .font_family
        .as_deref()
        .unwrap_or("Inter, system-ui, sans-serif");
    let requested = primary_family_name(stack).to_string();
    let requested_norm = requested.trim().to_lowercase();
    let slot = crate::text_font::font_weight_from_node(node);
    let has_runtime = fonts.has_family(&requested, slot);
    let embedded = embedded_family_from_name(&requested);
    let resolved = if has_runtime {
        requested.clone()
    } else {
        format!("{:?}", embedded)
            .trim_matches('"')
            .to_string()
    };
    let is_builtin = requested_norm.contains("inter")
        || requested_norm.contains("roboto")
        || requested_norm == "sans-serif"
        || requested_norm == "system-ui";
    let missing = !has_runtime && !is_builtin;
    FontResolution {
        requested_family: requested,
        resolved_family: resolved,
        fallback_used: missing || !has_runtime,
        missing,
    }
}

fn shaped_prefix_width(
    font_bytes: &[u8],
    text: &str,
    prefix_len: usize,
    font_size: f32,
    letter_spacing: f32,
) -> f32 {
    if prefix_len == 0 {
        return 0.0;
    }
    let prefix: String = text.chars().take(prefix_len).collect();
    shape_text_run(font_bytes, &prefix, font_size, letter_spacing).width
}

fn build_justify_segments(
    font_bytes: &[u8],
    line: &str,
    line_x: f32,
    line_y: f32,
    font_size: f32,
    letter_spacing: f32,
    inner_w: f32,
) -> Vec<CanonicalLineSegment> {
    let words: Vec<&str> = line.split_whitespace().collect();
    if words.len() < 2 {
        return vec![CanonicalLineSegment {
            text: line.to_string(),
            x: line_x,
            y: line_y,
        }];
    }
    let shaped_width = shape_text_run(font_bytes, line, font_size, letter_spacing).width;
    let gap = justify_word_spacing(line, shaped_width, inner_w, font_bytes, font_size, letter_spacing);
    let mut segments = Vec::new();
    let mut pen_x = line_x;
    for (i, word) in words.iter().enumerate() {
        segments.push(CanonicalLineSegment {
            text: (*word).to_string(),
            x: pen_x,
            y: line_y,
        });
        let word_w = shape_text_run(font_bytes, word, font_size, letter_spacing).width;
        pen_x += word_w;
        if i + 1 < words.len() {
            pen_x += letter_spacing + gap;
        }
    }
    segments
}

fn build_caret_stops_for_line(
    font_bytes: &[u8],
    line: &crate::text_layout::TextLine,
    line_index: usize,
    layout: &TextLayout,
    line_x: f32,
    line_y: f32,
    font_size: f32,
    letter_spacing: f32,
    start_index: usize,
    out: &mut Vec<CaretStop>,
) {
    let char_count = line.text.chars().count();
    for i in 0..=char_count {
        let x = line_x + shaped_prefix_width(font_bytes, &line.text, i, font_size, letter_spacing);
        out.push(CaretStop {
            index: start_index + i,
            x,
            y: line_y,
        });
    }
    let _ = line_index;
    let _ = layout;
}

fn build_glyph_boxes_for_line(
    font: &fontdue::Font,
    font_bytes: &[u8],
    line: &str,
    line_x: f32,
    line_y: f32,
    baseline: f32,
    font_size: f32,
    letter_spacing: f32,
    start_index: usize,
    out: &mut Vec<GlyphBox>,
) {
    let run = shape_text_run(font_bytes, line, font_size, letter_spacing);
    let mut char_index = start_index;
    for glyph in run.glyphs {
        let metrics = font
            .metrics_indexed(glyph.glyph_id.min(u16::MAX as u32) as u16, font_size);
        let width = metrics.advance_width.max(1.0);
        let height = font_size.max(1.0);
        out.push(GlyphBox {
            index: char_index,
            x: line_x + glyph.x,
            y: line_y + baseline + glyph.y,
            width,
            height,
            glyph_id: glyph.glyph_id,
        });
        char_index += 1;
    }
}

pub fn layout_text_canonical(
    req: &TextLayoutRequest,
    fonts: &RuntimeFontRegistry,
) -> CanonicalTextLayout {
    let (node, font_size) = layout_node_for_request(req);
    let vertical_trim_top = req.vertical_trim_top.unwrap_or(0.0).max(0.0);
    let (font, font_bytes) = fonts.resolve_for_node(&node);
    let base_layout = layout_text_node(&node, fonts);
    let letter_spacing = letter_spacing_for(&node);
    let align = text_align_for(&node);
    let inner_w = inner_box_width(&node, &base_layout);
    let inner_h = (node.height - TEXT_BOX_PAD_Y * 2.0).max(1.0);
    let block_offset_y =
        vertical_content_offset_y(base_layout.height, inner_h, vertical_align_for(&node));
    let baseline = (base_layout.line_height_px - font_size) * 0.5;
    let last_line = base_layout.lines.len().saturating_sub(1);

    let mut lines: Vec<CanonicalLine> = Vec::new();
    let mut caret_stops: Vec<CaretStop> = Vec::new();
    let mut glyphs: Vec<GlyphBox> = Vec::new();
    let mut start_index = 0usize;
    let mut rtl_any = false;

    for (line_index, line) in base_layout.lines.iter().enumerate() {
        let line_y = TEXT_BOX_PAD_Y + block_offset_y + line_top_y(&base_layout, line_index);
        let rtl = detect_text_direction(&line.text) == Direction::RightToLeft;
        rtl_any = rtl_any || rtl;
        let line_x =
            TEXT_BOX_PAD_X + line_offset_x_directional(line.width, inner_w, align, rtl);

        let segments = if align == "justify" && line_index != last_line {
            build_justify_segments(
                font_bytes,
                &line.text,
                line_x,
                line_y,
                font_size,
                letter_spacing,
                inner_w,
            )
        } else {
            vec![CanonicalLineSegment {
                text: line.text.clone(),
                x: line_x,
                y: line_y,
            }]
        };

        build_caret_stops_for_line(
            font_bytes,
            line,
            line_index,
            &base_layout,
            line_x,
            line_y,
            font_size,
            letter_spacing,
            start_index,
            &mut caret_stops,
        );
        build_glyph_boxes_for_line(
            font,
            font_bytes,
            &line.text,
            line_x,
            line_y,
            baseline,
            font_size,
            letter_spacing,
            start_index,
            &mut glyphs,
        );

        lines.push(CanonicalLine {
            text: line.text.clone(),
            start_index,
            width: line.width,
            paragraph_start: line.paragraph_start,
            x: line_x,
            y: line_y,
            segments,
        });

        start_index += line.text.chars().count();
        if let Some(next) = base_layout.lines.get(line_index + 1) {
            if next.paragraph_start {
                start_index += 1;
            }
        }
    }

    let height = (base_layout.height - vertical_trim_top * 2.0).max(base_layout.line_height_px);

    CanonicalTextLayout {
        source: "wasm".into(),
        lines,
        width: base_layout.width,
        height,
        line_height_px: base_layout.line_height_px,
        paragraph_spacing: base_layout.paragraph_spacing,
        vertical_trim_top,
        inner_w,
        inner_h,
        block_offset_y,
        caret_stops,
        glyphs,
        font: resolve_font_metadata(&node, fonts),
        rtl: rtl_any,
    }
}

pub fn layout_text_canonical_json(
    json: &str,
    fonts: &RuntimeFontRegistry,
) -> Result<String, String> {
    let req: TextLayoutRequest =
        serde_json::from_str(json).map_err(|e| format!("invalid layout request: {e}"))?;
    let layout = layout_text_canonical(&req, fonts);
    serde_json::to_string(&layout).map_err(|e| format!("layout encode: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::document::NodeInput;

    fn text_node(content: &str, width: f32) -> NodeInput {
        NodeInput {
            id: "t".into(),
            kind: "text".into(),
            parent_id: None,
            visible: true,
            locked: false,
            x: 0.0,
            y: 0.0,
            width,
            height: 80.0,
            rotation: 0.0,
            fill_enabled: true,
            fill: None,
            fill_type: None,
            fill_gradient: None,
            fill_opacity: 1.0,
            text_color: Some("#111".into()),
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
            content: Some(content.into()),
            font_size: Some(16.0),
            font_family: None,
            font_weight: None,
            line_height: Some(1.2),
            letter_spacing: None,
            text_align: None,
            vertical_align: None,
            text_resize_mode: Some("fixed".into()),
            auto_resize: None,
            paragraph_spacing: None,
            asset_id: None,
            image_src: None,
            path_points: None,
            path_closed: None,
        }
    }

    #[test]
    fn canonical_layout_has_caret_stops() {
        let fonts = RuntimeFontRegistry::default();
        let req = TextLayoutRequest {
            node: text_node("Hi", 120.0),
            display_content: None,
            paragraph_spacing: None,
            vertical_trim_top: None,
            effective_font_size: None,
        };
        let layout = layout_text_canonical(&req, &fonts);
        assert_eq!(layout.lines.len(), 1);
        assert!(layout.caret_stops.len() >= 3);
        assert!(!layout.glyphs.is_empty());
    }

    #[test]
    fn canonical_json_round_trip() {
        let fonts = RuntimeFontRegistry::default();
        let req = TextLayoutRequest {
            node: text_node("wrap me please", 40.0),
            display_content: None,
            paragraph_spacing: None,
            vertical_trim_top: None,
            effective_font_size: None,
        };
        let json = r#"{"node":{"id":"t","type":"text","width":40,"height":80,"content":"wrap me please","fontSize":16,"lineHeight":1.2,"textResizeMode":"fixed"}}"#;
        let out = layout_text_canonical_json(json, &fonts).expect("layout");
        assert!(out.contains("\"caretStops\""));
        assert!(out.contains("\"source\":\"wasm\""));
        let _ = req;
    }
}
