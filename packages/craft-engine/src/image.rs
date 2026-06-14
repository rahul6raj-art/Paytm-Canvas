use crate::document::{parse_color, DocumentInput, NodeInput};
use crate::scene::{GpuVertex, WorldTransform};
use crate::tessellate::tessellate_rounded_rect;

pub fn resolve_image_fill(node: &NodeInput, doc: &DocumentInput) -> [f32; 4] {
    if let Some(asset_id) = &node.asset_id {
        if let Some(asset) = doc.assets.get(asset_id) {
            if let Some(c) = &asset.average_color {
                let base = parse_color(Some(c), [0.82, 0.84, 0.88, 1.0]);
                return [base[0], base[1], base[2], base[3] * node.fill_opacity];
            }
        }
    }
    let base = parse_color(node.fill.as_ref(), [0.82, 0.84, 0.88, 1.0]);
    [base[0], base[1], base[2], base[3] * node.fill_opacity]
}

pub fn tessellate_image_placeholder(
    node: &NodeInput,
    doc: &DocumentInput,
    world: WorldTransform,
    out: &mut Vec<GpuVertex>,
) {
    let w = node.width.max(1.0);
    let h = node.height.max(1.0);
    let color = resolve_image_fill(node, doc);
    let color_at = |_: f32, _: f32| color;
    tessellate_rounded_rect(world, w, h, node.corner_radius.unwrap_or(0.0), &color_at, out);

    if let Some(asset_id) = &node.asset_id {
        if let Some(asset) = doc.assets.get(asset_id) {
            if asset.width > 0 && asset.height > 0 {
                let icon = [0.55, 0.58, 0.62, 0.9];
                let iw = (w * 0.25).max(8.0);
                let ih = (h * 0.25).max(8.0);
                let local = WorldTransform::translate((w - iw) * 0.5, (h - ih) * 0.5);
                let icon_world = world.multiply(local);
                let icon_at = |_: f32, _: f32| icon;
                tessellate_rounded_rect(icon_world, iw, ih, 2.0, &icon_at, out);
            }
        }
    }
}
