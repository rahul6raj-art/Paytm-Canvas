use crate::document::{parse_color, NodeInput};
use crate::scene::{node_world_bounds, GpuVertex, WorldTransform};
use crate::tessellate::tessellate_rounded_rect;
use crate::viewport::WorldRect;

fn emit_blur_halo(
    node: &NodeInput,
    world: WorldTransform,
    viewport: &WorldRect,
    blur: f32,
    alpha: f32,
    color: [f32; 4],
    out: &mut Vec<GpuVertex>,
) {
    let expand = blur * 0.35;
    let w = node.width.max(1.0) + expand * 2.0;
    let h = node.height.max(1.0) + expand * 2.0;
    let bounds = node_world_bounds(
        &NodeInput {
            width: w,
            height: h,
            ..node.clone()
        },
        world,
    );
    if !bounds.intersects(viewport) {
        return;
    }
    let halo = [color[0], color[1], color[2], color[3] * alpha * 0.35];
    let color_at = |_: f32, _: f32| halo;
    tessellate_rounded_rect(
        world,
        w,
        h,
        node.corner_radius.unwrap_or(0.0) + blur * 0.15,
        &color_at,
        out,
    );
}

pub fn emit_layer_effects(
    node: &NodeInput,
    world: WorldTransform,
    viewport: &WorldRect,
    out: &mut Vec<GpuVertex>,
) {
    let Some(effects) = &node.effects else {
        return;
    };
    let w = node.width.max(1.0);
    let h = node.height.max(1.0);

    for eff in effects {
        if !eff.visible {
            continue;
        }
        match eff.effect_type.as_str() {
            "drop-shadow" => {
                let ox = eff.x.unwrap_or(0.0);
                let oy = eff.y.unwrap_or(4.0);
                let blur = eff.blur.unwrap_or(8.0);
                let spread = eff.spread.unwrap_or(0.0);
                let base = parse_color(eff.color.as_ref(), [0.0, 0.0, 0.0, 0.25]);
                let alpha = eff.opacity.unwrap_or(1.0).clamp(0.0, 1.0);
                let shadow = [base[0], base[1], base[2], base[3] * alpha * 0.65];
                let shadow_world = world.multiply(WorldTransform::translate(ox, oy));
                let sw = w + spread * 2.0;
                let sh = h + spread * 2.0;
                let radius = node.corner_radius.unwrap_or(0.0) + blur * 0.2;
                let bounds = node_world_bounds(
                    &NodeInput {
                        width: sw,
                        height: sh,
                        ..node.clone()
                    },
                    shadow_world,
                );
                if bounds.intersects(viewport) {
                    let color_at = |_: f32, _: f32| shadow;
                    tessellate_rounded_rect(shadow_world, sw, sh, radius, &color_at, out);
                }
            }
            "layer-blur" => {
                let blur = eff.blur.unwrap_or(12.0);
                let base = parse_color(node.fill.as_ref(), [0.5, 0.5, 0.5, 1.0]);
                emit_blur_halo(node, world, viewport, blur, 0.5, base, out);
            }
            "glass" => {
                let opacity = eff.glass_opacity.unwrap_or(0.25);
                let border_w = eff.border_width.unwrap_or(1.0);
                let border = parse_color(eff.border_color.as_ref(), [1.0, 1.0, 1.0, 0.6]);
                let fill = [1.0, 1.0, 1.0, opacity];
                let color_at = |_: f32, _: f32| fill;
                tessellate_rounded_rect(
                    world,
                    w,
                    h,
                    node.corner_radius.unwrap_or(8.0),
                    &color_at,
                    out,
                );
                if border_w > 0.0 {
                    let stroke = [border[0], border[1], border[2], border[3] * 0.8];
                    crate::tessellate::tessellate_stroke_rect(world, w, h, border_w, stroke, out);
                }
            }
            _ => {}
        }
    }
}
