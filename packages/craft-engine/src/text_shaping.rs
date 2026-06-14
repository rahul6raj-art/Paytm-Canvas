use rustybuzz::{Direction, Face, UnicodeBuffer, script, shape};

#[derive(Debug, Clone)]
pub struct ShapedGlyph {
    pub glyph_id: u32,
    pub x: f32,
    pub y: f32,
}

#[derive(Debug, Clone)]
pub struct ShapedRun {
    pub glyphs: Vec<ShapedGlyph>,
    pub width: f32,
    pub direction: Direction,
}

fn prepare_buffer(text: &str) -> UnicodeBuffer {
    let mut buffer = UnicodeBuffer::new();
    buffer.push_str(text);
    buffer.guess_segment_properties();
    buffer
}

/** Detect horizontal direction from Unicode content (RTL for Arabic, etc.). */
pub fn detect_text_direction(text: &str) -> Direction {
    if text.is_empty() {
        return Direction::LeftToRight;
    }
    prepare_buffer(text).direction()
}

fn scale_for_size(face: &Face<'_>, font_size: f32) -> f32 {
    let units = face.units_per_em().max(1) as f32;
    font_size / units
}

/** Shape a UTF-8 run with rustybuzz (script/direction auto-detect, kerning, ligatures). */
pub fn shape_text_run(font_bytes: &[u8], text: &str, font_size: f32, letter_spacing: f32) -> ShapedRun {
    if text.is_empty() {
        return ShapedRun {
            glyphs: Vec::new(),
            width: 0.0,
            direction: Direction::LeftToRight,
        };
    }

    let Ok(ttf_face) = ttf_parser::Face::parse(font_bytes, 0) else {
        return ShapedRun {
            glyphs: Vec::new(),
            width: 0.0,
            direction: Direction::LeftToRight,
        };
    };
    let face = Face::from_face(ttf_face);
    let scale = scale_for_size(&face, font_size);

    let buffer = prepare_buffer(text);
    let direction = buffer.direction();

    let output = shape(&face, &[], buffer);
    let infos = output.glyph_infos();
    let positions = output.glyph_positions();

    let mut pen_x = 0.0f32;
    let mut glyphs = Vec::with_capacity(infos.len());
    for (idx, (info, pos)) in infos.iter().zip(positions.iter()).enumerate() {
        let gx = pen_x + pos.x_offset as f32 * scale;
        let gy = pos.y_offset as f32 * scale;
        glyphs.push(ShapedGlyph {
            glyph_id: info.glyph_id as u32,
            x: gx,
            y: gy,
        });
        pen_x += pos.x_advance as f32 * scale;
        if letter_spacing > 0.0 && idx + 1 < infos.len() {
            pen_x += letter_spacing;
        }
    }

    ShapedRun {
        width: pen_x.abs(),
        glyphs,
        direction,
    }
}

pub fn measure_shaped_width(
    font_bytes: &[u8],
    text: &str,
    font_size: f32,
    letter_spacing: f32,
) -> f32 {
    shape_text_run(font_bytes, text, font_size, letter_spacing).width
}

pub fn justify_word_spacing(
    line: &str,
    _line_width: f32,
    box_width: f32,
    font_bytes: &[u8],
    font_size: f32,
    letter_spacing: f32,
) -> f32 {
    let words: Vec<&str> = line.split_whitespace().filter(|w| !w.is_empty()).collect();
    if words.len() < 2 {
        return 0.0;
    }
    let mut words_width = 0.0f32;
    for (i, word) in words.iter().enumerate() {
        words_width += measure_shaped_width(font_bytes, word, font_size, letter_spacing);
        if i + 1 < words.len() {
            words_width += letter_spacing;
        }
    }
    let gaps = (words.len() - 1) as f32;
    ((box_width - words_width) / gaps).max(0.0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::text_font::{
        INTER_REGULAR_BYTES, NOTO_ARABIC_REGULAR_BYTES, NOTO_BENGALI_REGULAR_BYTES,
        NOTO_DEVANAGARI_REGULAR_BYTES, NOTO_HEBREW_REGULAR_BYTES, NOTO_TAMIL_REGULAR_BYTES,
        ROBOTO_REGULAR_BYTES,
    };

    #[test]
    fn shapes_non_empty_run() {
        let run = shape_text_run(INTER_REGULAR_BYTES, "Hello", 16.0, 0.0);
        assert!(!run.glyphs.is_empty());
        assert!(run.width > 0.0);
        assert_eq!(run.direction, Direction::LeftToRight);
    }

    #[test]
    fn roboto_fi_ligature_is_single_glyph() {
        let run = shape_text_run(ROBOTO_REGULAR_BYTES, "fi", 24.0, 0.0);
        assert_eq!(run.glyphs.len(), 1);
    }

    #[test]
    fn inter_and_roboto_metrics_differ() {
        let inter = shape_text_run(INTER_REGULAR_BYTES, "Hello", 16.0, 0.0).width;
        let roboto = shape_text_run(ROBOTO_REGULAR_BYTES, "Hello", 16.0, 0.0).width;
        assert!((inter - roboto).abs() > 0.5);
    }

    #[test]
    fn arabic_detects_rtl() {
        assert_eq!(detect_text_direction("مرحبا"), Direction::RightToLeft);
        assert_eq!(prepare_buffer("مرحبا").script(), script::ARABIC);
    }

    #[test]
    fn devanagari_detects_script() {
        assert_eq!(prepare_buffer("नमस्ते").script(), script::DEVANAGARI);
        assert_eq!(detect_text_direction("नमस्ते"), Direction::LeftToRight);
    }

    #[test]
    fn arabic_shapes_with_noto_font() {
        let run = shape_text_run(NOTO_ARABIC_REGULAR_BYTES, "مرحبا", 24.0, 0.0);
        assert!(!run.glyphs.is_empty());
        assert!(run.width > 0.0);
        assert_eq!(run.direction, Direction::RightToLeft);
    }

    #[test]
    fn devanagari_shapes_with_noto_font() {
        let run = shape_text_run(NOTO_DEVANAGARI_REGULAR_BYTES, "नमस्ते", 24.0, 0.0);
        assert!(!run.glyphs.is_empty());
        assert!(run.width > 0.0);
    }

    #[test]
    fn bengali_shapes_with_noto_font() {
        assert_eq!(prepare_buffer("নমস্কার").script(), script::BENGALI);
        let run = shape_text_run(NOTO_BENGALI_REGULAR_BYTES, "নমস্কার", 24.0, 0.0);
        assert!(!run.glyphs.is_empty());
        assert!(run.width > 0.0);
    }

    #[test]
    fn tamil_shapes_with_noto_font() {
        assert_eq!(prepare_buffer("வணக்கம்").script(), script::TAMIL);
        let run = shape_text_run(NOTO_TAMIL_REGULAR_BYTES, "வணக்கம்", 24.0, 0.0);
        assert!(!run.glyphs.is_empty());
        assert!(run.width > 0.0);
    }

    #[test]
    fn hebrew_detects_rtl_and_shapes() {
        assert_eq!(detect_text_direction("שלום"), Direction::RightToLeft);
        assert_eq!(prepare_buffer("שלום").script(), script::HEBREW);
        let run = shape_text_run(NOTO_HEBREW_REGULAR_BYTES, "שלום", 24.0, 0.0);
        assert!(!run.glyphs.is_empty());
        assert!(run.width > 0.0);
        assert_eq!(run.direction, Direction::RightToLeft);
    }
}
