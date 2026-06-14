use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GradientHandleInput {
    #[serde(default = "default_half")]
    pub x: f32,
    #[serde(default = "default_half")]
    pub y: f32,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GradientStopInput {
    #[serde(default)]
    pub position: f32,
    #[serde(default)]
    pub color: Option<String>,
    #[serde(default = "default_one_option")]
    pub opacity: Option<f32>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GradientInput {
    #[serde(default = "default_linear_kind")]
    pub kind: String,
    #[serde(default)]
    pub handles: Vec<GradientHandleInput>,
    #[serde(default)]
    pub stops: Vec<GradientStopInput>,
    #[serde(default = "default_one_option")]
    pub opacity: Option<f32>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct EffectInput {
    #[serde(default)]
    pub id: String,
    #[serde(rename = "type")]
    pub effect_type: String,
    #[serde(default = "default_true")]
    pub visible: bool,
    #[serde(default)]
    pub x: Option<f32>,
    #[serde(default)]
    pub y: Option<f32>,
    #[serde(default)]
    pub blur: Option<f32>,
    #[serde(default)]
    pub spread: Option<f32>,
    #[serde(default)]
    pub color: Option<String>,
    #[serde(default = "default_one_option")]
    pub opacity: Option<f32>,
    #[serde(default = "default_one_option")]
    pub glass_opacity: Option<f32>,
    #[serde(default)]
    pub border_width: Option<f32>,
    #[serde(default)]
    pub border_color: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PathHandleInput {
    pub x: f32,
    pub y: f32,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PathPointInput {
    pub id: String,
    pub x: f32,
    pub y: f32,
    #[serde(default)]
    pub handle_in: Option<PathHandleInput>,
    #[serde(default)]
    pub handle_out: Option<PathHandleInput>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct StrokeInput {
    #[serde(default)]
    pub enabled: Option<bool>,
    #[serde(default)]
    pub dash_pattern: Option<Vec<f32>>,
    #[serde(default)]
    pub cap: Option<String>,
    #[serde(default)]
    pub join: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AssetInput {
    #[serde(default)]
    pub width: u32,
    #[serde(default)]
    pub height: u32,
    #[serde(default)]
    pub average_color: Option<String>,
    #[serde(default)]
    pub mime_type: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct NodeInput {
    pub id: String,
    #[serde(rename = "type")]
    pub kind: String,
    #[serde(default)]
    pub parent_id: Option<String>,
    #[serde(default = "default_true")]
    pub visible: bool,
    #[serde(default)]
    pub locked: bool,
    #[serde(default)]
    pub x: f32,
    #[serde(default)]
    pub y: f32,
    #[serde(default = "default_width")]
    pub width: f32,
    #[serde(default = "default_height")]
    pub height: f32,
    #[serde(default)]
    pub rotation: f32,
    #[serde(default = "default_true")]
    pub fill_enabled: bool,
    #[serde(default)]
    pub fill: Option<String>,
    #[serde(default)]
    pub fill_type: Option<String>,
    #[serde(default)]
    pub fill_gradient: Option<GradientInput>,
    #[serde(default = "default_one")]
    pub fill_opacity: f32,
    #[serde(default)]
    pub text_color: Option<String>,
    #[serde(default)]
    pub corner_radius: Option<f32>,
    #[serde(default)]
    pub polygon_sides: Option<u32>,
    #[serde(default)]
    pub clip_children: Option<bool>,
    #[serde(default = "default_true")]
    pub stroke_enabled: bool,
    #[serde(default)]
    pub stroke: Option<StrokeInput>,
    #[serde(default)]
    pub stroke_color: Option<String>,
    #[serde(default)]
    pub stroke_width: Option<f32>,
    #[serde(default = "default_one")]
    pub stroke_opacity: f32,
    #[serde(default)]
    pub stroke_style: Option<String>,
    #[serde(default)]
    pub stroke_dash_length: Option<f32>,
    #[serde(default)]
    pub stroke_dash_gap: Option<f32>,
    #[serde(default)]
    pub stroke_linecap: Option<String>,
    #[serde(default)]
    pub stroke_linejoin: Option<String>,
    #[serde(default)]
    pub effects: Option<Vec<EffectInput>>,
    #[serde(default)]
    pub content: Option<String>,
    #[serde(default)]
    pub font_size: Option<f32>,
    #[serde(default)]
    pub font_family: Option<String>,
    #[serde(default)]
    pub font_weight: Option<f32>,
    #[serde(default = "default_line_height")]
    pub line_height: Option<f32>,
    #[serde(default)]
    pub letter_spacing: Option<f32>,
    #[serde(default)]
    pub text_align: Option<String>,
    #[serde(default)]
    pub vertical_align: Option<String>,
    #[serde(default)]
    pub text_resize_mode: Option<String>,
    #[serde(default)]
    pub auto_resize: Option<String>,
    #[serde(default)]
    pub paragraph_spacing: Option<f32>,
    #[serde(default)]
    pub asset_id: Option<String>,
    #[serde(default)]
    pub image_src: Option<String>,
    #[serde(default)]
    pub path_points: Option<Vec<PathPointInput>>,
    #[serde(default)]
    pub path_closed: Option<bool>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DocumentInput {
    #[serde(default)]
    pub root_ids: Vec<String>,
    pub nodes: HashMap<String, NodeInput>,
    pub child_order: HashMap<String, Vec<String>>,
    #[serde(default)]
    pub assets: HashMap<String, AssetInput>,
}

fn default_line_height() -> Option<f32> {
    Some(1.2)
}

fn default_half() -> f32 {
    0.5
}

fn default_linear_kind() -> String {
    "linear".into()
}

fn default_one() -> f32 {
    1.0
}

fn default_one_option() -> Option<f32> {
    Some(1.0)
}

fn default_true() -> bool {
    true
}

fn default_width() -> f32 {
    100.0
}

fn default_height() -> f32 {
    100.0
}

pub const ROOT_KEY: &str = "__root__";

pub fn parse_document(json: &str) -> Result<DocumentInput, serde_json::Error> {
    serde_json::from_str(json)
}

fn parse_css_rgb(raw: &str) -> Option<[f32; 4]> {
    let trimmed = raw.trim();
    let open = trimmed.find('(')?;
    let close = trimmed.rfind(')')?;
    let inner = trimmed[open + 1..close].trim();
    let is_rgba = trimmed.to_ascii_lowercase().starts_with("rgba");
    let parts: Vec<&str> = inner.split(',').map(|p| p.trim()).collect();
    if parts.len() < 3 {
        return None;
    }
    let r: f32 = parts[0].parse().ok()?;
    let g: f32 = parts[1].parse().ok()?;
    let b: f32 = parts[2].parse().ok()?;
    let a = if is_rgba && parts.len() >= 4 {
        parts[3].parse().unwrap_or(1.0)
    } else {
        1.0
    };
    Some([r / 255.0, g / 255.0, b / 255.0, a])
}

pub fn parse_color(hex: Option<&String>, fallback: [f32; 4]) -> [f32; 4] {
    let Some(raw) = hex else {
        return fallback;
    };
    let trimmed = raw.trim();
    if let Some(rgb) = parse_css_rgb(trimmed) {
        return rgb;
    }
    let s = trimmed.trim_start_matches('#');
    match s.len() {
        6 => {
            let r = u8::from_str_radix(&s[0..2], 16).unwrap_or(0);
            let g = u8::from_str_radix(&s[2..4], 16).unwrap_or(0);
            let b = u8::from_str_radix(&s[4..6], 16).unwrap_or(0);
            [r as f32 / 255.0, g as f32 / 255.0, b as f32 / 255.0, 1.0]
        }
        8 => {
            let r = u8::from_str_radix(&s[0..2], 16).unwrap_or(0);
            let g = u8::from_str_radix(&s[2..4], 16).unwrap_or(0);
            let b = u8::from_str_radix(&s[4..6], 16).unwrap_or(0);
            let a = u8::from_str_radix(&s[6..8], 16).unwrap_or(255);
            [r as f32 / 255.0, g as f32 / 255.0, b as f32 / 255.0, a as f32 / 255.0]
        }
        _ => fallback,
    }
}

#[cfg(test)]
mod tests {
    use super::parse_document;

    #[test]
    fn parses_golden_tile_scene_fixture() {
        let json = include_str!("../../../fixtures/golden-tile-scene.json");
        let doc = parse_document(json).expect("golden fixture should parse");
        assert_eq!(doc.root_ids, vec!["frame-main"]);
        assert_eq!(doc.nodes.len(), 6);
        assert!(doc.child_order.contains_key(super::ROOT_KEY));
        assert_eq!(doc.child_order[super::ROOT_KEY], vec!["frame-main"]);
    }
}
