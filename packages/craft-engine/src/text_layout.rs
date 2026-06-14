use crate::document::NodeInput;
use crate::text_font::RuntimeFontRegistry;
use crate::text_shaping::measure_shaped_width;

pub const TEXT_BOX_PAD_X: f32 = 4.0;
pub const TEXT_BOX_PAD_Y: f32 = 2.0;

#[derive(Debug, Clone, PartialEq)]
pub struct TextLine {
    pub text: String,
    pub width: f32,
    pub paragraph_start: bool,
}

#[derive(Debug, Clone, PartialEq)]
pub struct TextLayout {
    pub lines: Vec<TextLine>,
    pub width: f32,
    pub height: f32,
    pub line_height_px: f32,
    pub paragraph_spacing: f32,
}

pub fn letter_spacing_for(node: &NodeInput) -> f32 {
    node.letter_spacing.unwrap_or(0.0)
}

pub fn text_align_for(node: &NodeInput) -> &str {
    match node.text_align.as_deref() {
        Some("center") => "center",
        Some("right") => "right",
        Some("justify") => "justify",
        _ => "left",
    }
}

pub fn vertical_align_for(node: &NodeInput) -> &str {
    match node.vertical_align.as_deref() {
        Some("middle") | Some("center") => "middle",
        Some("bottom") => "bottom",
        _ => "top",
    }
}

fn is_auto_width(node: &NodeInput) -> bool {
    if node.text_resize_mode.as_deref() == Some("auto-width") {
        return true;
    }
    node.auto_resize.as_deref() == Some("width-height")
}

fn wrap_width_for(node: &NodeInput) -> f32 {
    if is_auto_width(node) {
        return f32::INFINITY;
    }
    (node.width - TEXT_BOX_PAD_X * 2.0).max(1.0)
}

fn measure_line_width(
    font_bytes: &[u8],
    text: &str,
    font_size: f32,
    letter_spacing: f32,
) -> f32 {
    measure_shaped_width(font_bytes, text, font_size, letter_spacing)
}

fn wrap_paragraph(
    font_bytes: &[u8],
    paragraph: &str,
    max_width: f32,
    font_size: f32,
    letter_spacing: f32,
) -> Vec<TextLine> {
    if !max_width.is_finite() || max_width <= 0.0 {
        let width = measure_line_width(font_bytes, paragraph, font_size, letter_spacing);
        return vec![TextLine {
            text: paragraph.to_string(),
            width,
            paragraph_start: true,
        }];
    }

    if paragraph.is_empty() {
        return vec![TextLine {
            text: String::new(),
            width: 0.0,
            paragraph_start: true,
        }];
    }

    let mut lines: Vec<TextLine> = Vec::new();
    let mut current = String::new();

    let flush = |current: &mut String, lines: &mut Vec<TextLine>| {
        if current.is_empty() && !lines.is_empty() {
            return;
        }
        let width = measure_line_width(font_bytes, current, font_size, letter_spacing);
        lines.push(TextLine {
            text: std::mem::take(current),
            width,
            paragraph_start: lines.is_empty(),
        });
    };

    for token in split_tokens(paragraph) {
        if token.is_empty() {
            continue;
        }
        let candidate = format!("{current}{token}");
        let candidate_width = measure_line_width(font_bytes, &candidate, font_size, letter_spacing);
        if candidate_width <= max_width || current.is_empty() {
            current = candidate;
            continue;
        }
        flush(&mut current, &mut lines);
        if measure_line_width(font_bytes, &token, font_size, letter_spacing) <= max_width {
            current = token.to_string();
        } else {
            for ch in token.chars() {
                let next = format!("{current}{ch}");
                if measure_line_width(font_bytes, &next, font_size, letter_spacing) <= max_width
                    || current.is_empty()
                {
                    current = next;
                } else {
                    flush(&mut current, &mut lines);
                    current = ch.to_string();
                }
            }
        }
    }

    if current.is_empty() && lines.is_empty() {
        lines.push(TextLine {
            text: String::new(),
            width: 0.0,
            paragraph_start: true,
        });
    } else if !current.is_empty() || lines.is_empty() {
        flush(&mut current, &mut lines);
    }

    if let Some(first) = lines.first_mut() {
        first.paragraph_start = true;
    }
    lines
}

fn split_tokens(paragraph: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut current = String::new();
    for ch in paragraph.chars() {
        if ch.is_whitespace() {
            if !current.is_empty() {
                out.push(std::mem::take(&mut current));
            }
            out.push(ch.to_string());
        } else {
            current.push(ch);
        }
    }
    if !current.is_empty() {
        out.push(current);
    }
    out
}

pub fn layout_text_node(node: &NodeInput, fonts: &RuntimeFontRegistry) -> TextLayout {
    let (_, font_bytes) = fonts.resolve_for_node(node);
    let content = node.content.as_deref().unwrap_or("Text");
    let font_size = node.font_size.unwrap_or(16.0).max(8.0);
    let line_height = node.line_height.unwrap_or(1.2);
    let line_height_px = font_size * line_height;
    let letter_spacing = letter_spacing_for(node);
    let paragraph_spacing = node.paragraph_spacing.unwrap_or(0.0).max(0.0);
    let max_width = wrap_width_for(node);

    let paragraphs: Vec<&str> = content.split('\n').collect();
    let mut lines: Vec<TextLine> = Vec::new();

    for paragraph in paragraphs {
        let mut wrapped = wrap_paragraph(font_bytes, paragraph, max_width, font_size, letter_spacing);
        if let Some(first) = wrapped.first_mut() {
            first.paragraph_start = true;
        }
        lines.append(&mut wrapped);
    }

    if lines.is_empty() {
        lines.push(TextLine {
            text: String::new(),
            width: 0.0,
            paragraph_start: true,
        });
    }

    let mut width = 0.0f32;
    for line in &lines {
        width = width.max(line.width);
    }

    let mut paragraph_gaps = 0u32;
    for line in lines.iter().skip(1) {
        if line.paragraph_start {
            paragraph_gaps += 1;
        }
    }

    let height = (lines.len() as f32 * line_height_px
        + paragraph_gaps as f32 * paragraph_spacing)
        .max(line_height_px);

    TextLayout {
        lines,
        width,
        height,
        line_height_px,
        paragraph_spacing,
    }
}

pub fn line_top_y(layout: &TextLayout, line_index: usize) -> f32 {
    let mut y = 0.0f32;
    for i in 1..=line_index {
        y += layout.line_height_px;
        if layout.lines.get(i).is_some_and(|l| l.paragraph_start) {
            y += layout.paragraph_spacing;
        }
    }
    y
}

pub fn line_offset_x(line_width: f32, box_width: f32, align: &str) -> f32 {
    line_offset_x_directional(line_width, box_width, align, false)
}

/** Line start offset with optional RTL flow (start/end mirror left/right). */
pub fn line_offset_x_directional(line_width: f32, box_width: f32, align: &str, rtl: bool) -> f32 {
    if rtl {
        return match align {
            "center" => ((box_width - line_width) * 0.5).max(0.0),
            "right" => 0.0,
            _ => (box_width - line_width).max(0.0),
        };
    }
    match align {
        "center" => ((box_width - line_width) * 0.5).max(0.0),
        "right" => (box_width - line_width).max(0.0),
        _ => 0.0,
    }
}

pub fn vertical_content_offset_y(content_height: f32, inner_height: f32, align: &str) -> f32 {
    let slack = inner_height - content_height;
    if slack <= 0.0 {
        return 0.0;
    }
    match align {
        "middle" => slack * 0.5,
        "bottom" => slack,
        _ => 0.0,
    }
}

pub fn inner_box_width(node: &NodeInput, layout: &TextLayout) -> f32 {
    if is_auto_width(node) {
        layout.width.max(1.0)
    } else {
        (node.width - TEXT_BOX_PAD_X * 2.0).max(1.0)
    }
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
    fn wraps_long_paragraph() {
        let node = text_node("hello world from craft engine", 60.0);
        let fonts = RuntimeFontRegistry::default();
        let layout = layout_text_node(&node, &fonts);
        assert!(layout.lines.len() > 1);
    }

    #[test]
    fn letter_spacing_increases_width() {
        let fonts = RuntimeFontRegistry::default();
        let mut node = text_node("ABC", 200.0);
        node.letter_spacing = Some(0.0);
        let tight = layout_text_node(&node, &fonts);
        node.letter_spacing = Some(8.0);
        let loose = layout_text_node(&node, &fonts);
        assert!(loose.width > tight.width);
    }

    #[test]
    fn center_align_offsets_line() {
        let offset = line_offset_x(40.0, 100.0, "center");
        assert!((offset - 30.0).abs() < 0.01);
    }

    #[test]
    fn rtl_left_align_starts_at_end() {
        let offset = line_offset_x_directional(40.0, 100.0, "left", true);
        assert!((offset - 60.0).abs() < 0.01);
    }

    #[test]
    fn bold_weight_uses_bold_metrics() {
        let mut regular = text_node("Hello", 200.0);
        regular.font_weight = Some(400.0);
        let mut bold = text_node("Hello", 200.0);
        bold.font_weight = Some(700.0);
        let fonts = RuntimeFontRegistry::default();
        let reg = layout_text_node(&regular, &fonts);
        let b = layout_text_node(&bold, &fonts);
        assert!(b.width > reg.width);
    }
}
