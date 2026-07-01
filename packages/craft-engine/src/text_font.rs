use crate::document::NodeInput;
use crate::text_shaping::detect_text_direction;
use fontdue::Font;
use rustybuzz::{script, Direction, UnicodeBuffer};
use std::collections::HashMap;
use std::sync::OnceLock;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum EmbeddedFamily {
    Inter,
    Roboto,
    NotoArabic,
    NotoDevanagari,
    NotoBengali,
    NotoTamil,
    NotoHebrew,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum TextFontSlot {
    Regular,
    Medium,
    Bold,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
struct FontKey {
    family: EmbeddedFamily,
    slot: TextFontSlot,
}

static INTER_REGULAR: OnceLock<Font> = OnceLock::new();
static INTER_MEDIUM: OnceLock<Font> = OnceLock::new();
static INTER_BOLD: OnceLock<Font> = OnceLock::new();
static ROBOTO_REGULAR: OnceLock<Font> = OnceLock::new();
static ROBOTO_BOLD: OnceLock<Font> = OnceLock::new();
static NOTO_ARABIC_REGULAR: OnceLock<Font> = OnceLock::new();
static NOTO_DEVANAGARI_REGULAR: OnceLock<Font> = OnceLock::new();
static NOTO_BENGALI_REGULAR: OnceLock<Font> = OnceLock::new();
static NOTO_TAMIL_REGULAR: OnceLock<Font> = OnceLock::new();
static NOTO_HEBREW_REGULAR: OnceLock<Font> = OnceLock::new();

pub const INTER_REGULAR_BYTES: &[u8] = include_bytes!("../assets/Inter-Regular.ttf");
pub const INTER_MEDIUM_BYTES: &[u8] = include_bytes!("../assets/Inter-Medium.ttf");
pub const INTER_BOLD_BYTES: &[u8] = include_bytes!("../assets/Inter-Bold.ttf");
pub const ROBOTO_REGULAR_BYTES: &[u8] = include_bytes!("../assets/Roboto-Regular.ttf");
pub const ROBOTO_BOLD_BYTES: &[u8] = include_bytes!("../assets/Roboto-Bold.ttf");
pub const NOTO_ARABIC_REGULAR_BYTES: &[u8] =
    include_bytes!("../assets/NotoSansArabic-Regular.ttf");
pub const NOTO_DEVANAGARI_REGULAR_BYTES: &[u8] =
    include_bytes!("../assets/NotoSansDevanagari-Regular.ttf");
pub const NOTO_BENGALI_REGULAR_BYTES: &[u8] =
    include_bytes!("../assets/NotoSansBengali-Regular.ttf");
pub const NOTO_TAMIL_REGULAR_BYTES: &[u8] =
    include_bytes!("../assets/NotoSansTamil-Regular.ttf");
pub const NOTO_HEBREW_REGULAR_BYTES: &[u8] =
    include_bytes!("../assets/NotoSansHebrew-Regular.ttf");

pub fn font_weight_from_node(node: &NodeInput) -> TextFontSlot {
    let weight = node.font_weight.unwrap_or(500.0);
    if weight >= 600.0 {
        TextFontSlot::Bold
    } else if weight >= 500.0 {
        TextFontSlot::Medium
    } else {
        TextFontSlot::Regular
    }
}

fn trim_quotes(raw: &str) -> &str {
    raw.trim().trim_matches(|c| c == '"' || c == '\'')
}

/** First named family in a CSS stack (skips `var(...)`), mirrors TS `primaryFontName`. */
pub fn primary_family_name(font_family: &str) -> &str {
    for part in font_family.split(',') {
        let part = trim_quotes(part);
        if part.is_empty() || part.to_lowercase().starts_with("var(") {
            continue;
        }
        return part;
    }
    "sans-serif"
}

pub fn embedded_family_from_name(name: &str) -> EmbeddedFamily {
    let lower = name.trim().to_lowercase();
    if lower.contains("arabic") {
        return EmbeddedFamily::NotoArabic;
    }
    if lower.contains("devanagari") {
        return EmbeddedFamily::NotoDevanagari;
    }
    if lower.contains("bengali") {
        return EmbeddedFamily::NotoBengali;
    }
    if lower.contains("tamil") {
        return EmbeddedFamily::NotoTamil;
    }
    if lower.contains("hebrew") {
        return EmbeddedFamily::NotoHebrew;
    }
    if lower.contains("roboto") {
        return EmbeddedFamily::Roboto;
    }
    if lower.contains("inter") {
        return EmbeddedFamily::Inter;
    }
    match lower.as_str() {
        "sans-serif" | "system-ui" | "ui-sans-serif" | "arial" | "helvetica" | "segoe ui"
        | "apple color emoji" => EmbeddedFamily::Inter,
        "serif" | "times new roman" | "georgia" => EmbeddedFamily::Roboto,
        "monospace" | "ui-monospace" | "courier new" | "menlo" => EmbeddedFamily::Roboto,
        _ => EmbeddedFamily::Inter,
    }
}

pub fn embedded_family_from_node(node: &NodeInput) -> EmbeddedFamily {
    let stack = node
        .font_family
        .as_deref()
        .unwrap_or("Inter, system-ui, sans-serif");
    embedded_family_from_name(primary_family_name(stack))
}

fn font_key(node: &NodeInput) -> FontKey {
    FontKey {
        family: embedded_family_from_node(node),
        slot: font_weight_from_node(node),
    }
}

pub fn font_bytes_for_key(key: FontKey) -> &'static [u8] {
    match (key.family, key.slot) {
        (EmbeddedFamily::Inter, TextFontSlot::Regular) => INTER_REGULAR_BYTES,
        (EmbeddedFamily::Inter, TextFontSlot::Medium) => INTER_MEDIUM_BYTES,
        (EmbeddedFamily::Inter, TextFontSlot::Bold) => INTER_BOLD_BYTES,
        // Roboto has no embedded Medium face — fall back to Regular.
        (EmbeddedFamily::Roboto, TextFontSlot::Regular | TextFontSlot::Medium) => ROBOTO_REGULAR_BYTES,
        (EmbeddedFamily::Roboto, TextFontSlot::Bold) => ROBOTO_BOLD_BYTES,
        (EmbeddedFamily::NotoArabic, _) => NOTO_ARABIC_REGULAR_BYTES,
        (EmbeddedFamily::NotoDevanagari, _) => NOTO_DEVANAGARI_REGULAR_BYTES,
        (EmbeddedFamily::NotoBengali, _) => NOTO_BENGALI_REGULAR_BYTES,
        (EmbeddedFamily::NotoTamil, _) => NOTO_TAMIL_REGULAR_BYTES,
        (EmbeddedFamily::NotoHebrew, _) => NOTO_HEBREW_REGULAR_BYTES,
    }
}

pub fn engine_font_for_key(key: FontKey) -> &'static Font {
    match (key.family, key.slot) {
        (EmbeddedFamily::Inter, TextFontSlot::Regular) => INTER_REGULAR.get_or_init(|| {
            Font::from_bytes(INTER_REGULAR_BYTES, fontdue::FontSettings::default())
                .expect("Inter-Regular")
        }),
        (EmbeddedFamily::Inter, TextFontSlot::Medium) => INTER_MEDIUM.get_or_init(|| {
            Font::from_bytes(INTER_MEDIUM_BYTES, fontdue::FontSettings::default())
                .expect("Inter-Medium")
        }),
        (EmbeddedFamily::Inter, TextFontSlot::Bold) => INTER_BOLD.get_or_init(|| {
            Font::from_bytes(INTER_BOLD_BYTES, fontdue::FontSettings::default()).expect("Inter-Bold")
        }),
        (EmbeddedFamily::Roboto, TextFontSlot::Regular | TextFontSlot::Medium) => {
            ROBOTO_REGULAR.get_or_init(|| {
                Font::from_bytes(ROBOTO_REGULAR_BYTES, fontdue::FontSettings::default())
                    .expect("Roboto-Regular")
            })
        }
        (EmbeddedFamily::Roboto, TextFontSlot::Bold) => ROBOTO_BOLD.get_or_init(|| {
            Font::from_bytes(ROBOTO_BOLD_BYTES, fontdue::FontSettings::default())
                .expect("Roboto-Bold")
        }),
        (EmbeddedFamily::NotoArabic, _) => NOTO_ARABIC_REGULAR.get_or_init(|| {
            Font::from_bytes(NOTO_ARABIC_REGULAR_BYTES, fontdue::FontSettings::default())
                .expect("NotoSansArabic-Regular")
        }),
        (EmbeddedFamily::NotoDevanagari, _) => NOTO_DEVANAGARI_REGULAR.get_or_init(|| {
            Font::from_bytes(
                NOTO_DEVANAGARI_REGULAR_BYTES,
                fontdue::FontSettings::default(),
            )
            .expect("NotoSansDevanagari-Regular")
        }),
        (EmbeddedFamily::NotoBengali, _) => NOTO_BENGALI_REGULAR.get_or_init(|| {
            Font::from_bytes(NOTO_BENGALI_REGULAR_BYTES, fontdue::FontSettings::default())
                .expect("NotoSansBengali-Regular")
        }),
        (EmbeddedFamily::NotoTamil, _) => NOTO_TAMIL_REGULAR.get_or_init(|| {
            Font::from_bytes(NOTO_TAMIL_REGULAR_BYTES, fontdue::FontSettings::default())
                .expect("NotoSansTamil-Regular")
        }),
        (EmbeddedFamily::NotoHebrew, _) => NOTO_HEBREW_REGULAR.get_or_init(|| {
            Font::from_bytes(NOTO_HEBREW_REGULAR_BYTES, fontdue::FontSettings::default())
                .expect("NotoSansHebrew-Regular")
        }),
    }
}

fn is_embedded_script_family(family: EmbeddedFamily) -> bool {
    matches!(
        family,
        EmbeddedFamily::NotoArabic
            | EmbeddedFamily::NotoDevanagari
            | EmbeddedFamily::NotoBengali
            | EmbeddedFamily::NotoTamil
            | EmbeddedFamily::NotoHebrew
    )
}

fn script_embedded_fallback(text: &str) -> Option<EmbeddedFamily> {
    let mut buffer = UnicodeBuffer::new();
    buffer.push_str(text);
    buffer.guess_segment_properties();
    match buffer.script() {
        s if s == script::ARABIC => Some(EmbeddedFamily::NotoArabic),
        s if s == script::DEVANAGARI => Some(EmbeddedFamily::NotoDevanagari),
        s if s == script::BENGALI => Some(EmbeddedFamily::NotoBengali),
        s if s == script::TAMIL => Some(EmbeddedFamily::NotoTamil),
        s if s == script::HEBREW => Some(EmbeddedFamily::NotoHebrew),
        _ => None,
    }
}

fn runtime_family_name_for_embedded(family: EmbeddedFamily) -> &'static str {
    match family {
        EmbeddedFamily::NotoArabic => "noto sans arabic",
        EmbeddedFamily::NotoDevanagari => "noto sans devanagari",
        EmbeddedFamily::NotoBengali => "noto sans bengali",
        EmbeddedFamily::NotoTamil => "noto sans tamil",
        EmbeddedFamily::NotoHebrew => "noto sans hebrew",
        _ => "",
    }
}

pub fn engine_font_for_node(node: &NodeInput) -> (&'static Font, &'static [u8]) {
    let key = font_key(node);
    (engine_font_for_key(key), font_bytes_for_key(key))
}

struct RegisteredFont {
    bytes: Vec<u8>,
    font: Font,
}

/** Runtime TTF faces registered from the TS font bridge (Google Fonts, etc.). */
#[derive(Default)]
pub struct RuntimeFontRegistry {
    entries: HashMap<(String, TextFontSlot), RegisteredFont>,
}

fn normalize_family_name(name: &str) -> String {
    primary_family_name(name).trim().to_lowercase()
}

fn weight_to_slot(weight: u32) -> TextFontSlot {
    if weight >= 600 {
        TextFontSlot::Bold
    } else if weight >= 500 {
        TextFontSlot::Medium
    } else {
        TextFontSlot::Regular
    }
}

impl RuntimeFontRegistry {
    pub fn register_family(
        &mut self,
        family_name: &str,
        weight: u32,
        bytes: &[u8],
    ) -> Result<(), String> {
        let key = (normalize_family_name(family_name), weight_to_slot(weight));
        let font = Font::from_bytes(bytes, fontdue::FontSettings::default())
            .map_err(|e| format!("invalid font bytes for {family_name}: {e}"))?;
        self.entries.insert(
            key,
            RegisteredFont {
                bytes: bytes.to_vec(),
                font,
            },
        );
        Ok(())
    }

    pub fn has_family(&self, family_name: &str, slot: TextFontSlot) -> bool {
        self.entries
            .contains_key(&(normalize_family_name(family_name), slot))
    }

    fn lookup_runtime<'a>(
        &'a self,
        name: &str,
        slot: TextFontSlot,
    ) -> Option<(&'a Font, &'a [u8])> {
        let key = normalize_family_name(name);
        if let Some(entry) = self.entries.get(&(key.clone(), slot)) {
            return Some((&entry.font, &entry.bytes));
        }
        // Runtime faces are typically registered only as Regular/Bold — a Medium request falls
        // back to the registered Regular face.
        if slot == TextFontSlot::Medium {
            if let Some(entry) = self.entries.get(&(key, TextFontSlot::Regular)) {
                return Some((&entry.font, &entry.bytes));
            }
        } else if slot == TextFontSlot::Bold {
            if let Some(entry) = self.entries.get(&(key, TextFontSlot::Regular)) {
                return Some((&entry.font, &entry.bytes));
            }
        }
        None
    }

    pub fn resolve_for_node<'a>(&'a self, node: &NodeInput) -> (&'a Font, &'a [u8]) {
        let stack = node
            .font_family
            .as_deref()
            .unwrap_or("Inter, system-ui, sans-serif");
        let primary = primary_family_name(stack);
        let name = normalize_family_name(primary);
        let slot = font_weight_from_node(node);

        if let Some(resolved) = self.lookup_runtime(&name, slot) {
            return resolved;
        }

        let explicit = embedded_family_from_name(primary);
        if is_embedded_script_family(explicit) {
            let key = FontKey {
                family: explicit,
                slot: TextFontSlot::Regular,
            };
            return (engine_font_for_key(key), font_bytes_for_key(key));
        }

        if let Some(content) = node.content.as_deref() {
            if let Some(family) = script_embedded_fallback(content) {
                let runtime_name = runtime_family_name_for_embedded(family);
                if let Some(resolved) = self.lookup_runtime(runtime_name, slot) {
                    return resolved;
                }
                let key = FontKey {
                    family,
                    slot: TextFontSlot::Regular,
                };
                return (engine_font_for_key(key), font_bytes_for_key(key));
            }
        }

        engine_font_for_node(node)
    }

    /** Whether node content flows right-to-left (Arabic, Hebrew, etc.). */
    pub fn is_rtl_content(node: &NodeInput) -> bool {
        node.content
            .as_deref()
            .is_some_and(|text| detect_text_direction(text) == Direction::RightToLeft)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn skips_css_var_in_stack() {
        assert_eq!(
            primary_family_name("var(--font-inter), Inter, system-ui"),
            "Inter"
        );
    }

    #[test]
    fn maps_roboto_family() {
        assert_eq!(
            embedded_family_from_name("Roboto"),
            EmbeddedFamily::Roboto
        );
    }

    #[test]
    fn maps_noto_arabic_family() {
        assert_eq!(
            embedded_family_from_name("Noto Sans Arabic"),
            EmbeddedFamily::NotoArabic
        );
    }

    #[test]
    fn arabic_content_uses_noto_fallback() {
        let mut node = NodeInput {
            id: "t".into(),
            kind: "text".into(),
            parent_id: None,
            visible: true,
            locked: false,
            x: 0.0,
            y: 0.0,
            width: 100.0,
            height: 40.0,
            rotation: 0.0,
            fill_enabled: true,
            fill: None,
            fill_type: None,
            fill_gradient: None,
            fill_opacity: 1.0,
            text_color: None,
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
            content: Some("مرحبا".into()),
            font_size: Some(16.0),
            font_family: Some("Inter, sans-serif".into()),
            font_weight: Some(400.0),
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
        };
        let registry = RuntimeFontRegistry::default();
        let (_, bytes) = registry.resolve_for_node(&node);
        assert_eq!(bytes, NOTO_ARABIC_REGULAR_BYTES);
        assert!(RuntimeFontRegistry::is_rtl_content(&node));
    }

    #[test]
    fn bengali_content_uses_noto_fallback() {
        let node = NodeInput {
            id: "t".into(),
            kind: "text".into(),
            parent_id: None,
            visible: true,
            locked: false,
            x: 0.0,
            y: 0.0,
            width: 100.0,
            height: 40.0,
            rotation: 0.0,
            fill_enabled: true,
            fill: None,
            fill_type: None,
            fill_gradient: None,
            fill_opacity: 1.0,
            text_color: None,
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
            content: Some("নমস্কার".into()),
            font_size: Some(16.0),
            font_family: Some("Inter, sans-serif".into()),
            font_weight: Some(400.0),
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
        };
        let registry = RuntimeFontRegistry::default();
        let (_, bytes) = registry.resolve_for_node(&node);
        assert_eq!(bytes, NOTO_BENGALI_REGULAR_BYTES);
    }

    #[test]
    fn hebrew_content_uses_noto_fallback() {
        let node = NodeInput {
            id: "t".into(),
            kind: "text".into(),
            parent_id: None,
            visible: true,
            locked: false,
            x: 0.0,
            y: 0.0,
            width: 100.0,
            height: 40.0,
            rotation: 0.0,
            fill_enabled: true,
            fill: None,
            fill_type: None,
            fill_gradient: None,
            fill_opacity: 1.0,
            text_color: None,
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
            content: Some("שלום".into()),
            font_size: Some(16.0),
            font_family: Some("Inter, sans-serif".into()),
            font_weight: Some(400.0),
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
        };
        let registry = RuntimeFontRegistry::default();
        let (_, bytes) = registry.resolve_for_node(&node);
        assert_eq!(bytes, NOTO_HEBREW_REGULAR_BYTES);
        assert!(RuntimeFontRegistry::is_rtl_content(&node));
    }

    #[test]
    fn defaults_unknown_google_font_to_inter() {
        assert_eq!(
            embedded_family_from_name("Poppins"),
            EmbeddedFamily::Inter
        );
    }

    #[test]
    fn runtime_registry_overrides_unknown_family() {
        let mut registry = RuntimeFontRegistry::default();
        registry
            .register_family("Poppins", 400, ROBOTO_REGULAR_BYTES)
            .expect("register");
        let mut node = NodeInput {
            id: "t".into(),
            kind: "text".into(),
            parent_id: None,
            visible: true,
            locked: false,
            x: 0.0,
            y: 0.0,
            width: 100.0,
            height: 40.0,
            rotation: 0.0,
            fill_enabled: true,
            fill: None,
            fill_type: None,
            fill_gradient: None,
            fill_opacity: 1.0,
            text_color: None,
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
            font_family: Some("Poppins, sans-serif".into()),
            font_weight: Some(400.0),
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
        };
        let (font, _) = registry.resolve_for_node(&node);
        let (inter, _) = engine_font_for_node(&node);
        assert_ne!(font as *const Font, inter as *const Font);
        assert!(registry.has_family("Poppins", TextFontSlot::Regular));
    }

    #[test]
    fn inter_medium_differs_from_regular_and_bold() {
        let mut node = NodeInput {
            id: "t".into(),
            kind: "text".into(),
            parent_id: None,
            visible: true,
            locked: false,
            x: 0.0,
            y: 0.0,
            width: 100.0,
            height: 40.0,
            rotation: 0.0,
            fill_enabled: true,
            fill: None,
            fill_type: None,
            fill_gradient: None,
            fill_opacity: 1.0,
            text_color: None,
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
            content: Some("Rahul".into()),
            font_size: Some(14.0),
            font_family: Some("Inter, sans-serif".into()),
            font_weight: Some(500.0),
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
        };
        assert_eq!(font_key(&node).slot, TextFontSlot::Medium);
        let medium = engine_font_for_node(&node).0 as *const Font;
        node.font_weight = Some(400.0);
        let regular = engine_font_for_node(&node).0 as *const Font;
        node.font_weight = Some(700.0);
        let bold = engine_font_for_node(&node).0 as *const Font;
        assert_ne!(medium, regular);
        assert_ne!(medium, bold);
    }

    #[test]
    fn inter_bold_differs_from_regular() {
        let mut node = NodeInput {
            id: "t".into(),
            kind: "text".into(),
            parent_id: None,
            visible: true,
            locked: false,
            x: 0.0,
            y: 0.0,
            width: 100.0,
            height: 40.0,
            rotation: 0.0,
            fill_enabled: true,
            fill: None,
            fill_type: None,
            fill_gradient: None,
            fill_opacity: 1.0,
            text_color: None,
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
            font_family: Some("Inter, sans-serif".into()),
            font_weight: Some(700.0),
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
        };
        let key_bold = font_key(&node);
        assert_eq!(key_bold.family, EmbeddedFamily::Inter);
        assert_eq!(key_bold.slot, TextFontSlot::Bold);
        let (inter_bold, _) = engine_font_for_node(&node);
        node.font_weight = Some(400.0);
        let (inter_reg, _) = engine_font_for_node(&node);
        assert_ne!(inter_bold as *const Font, inter_reg as *const Font);
        assert_eq!(font_key(&node).slot, TextFontSlot::Regular);
    }
}
