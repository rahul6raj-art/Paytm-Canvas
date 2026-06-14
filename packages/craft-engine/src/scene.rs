use crate::document::{parse_color, DocumentInput, NodeInput, ROOT_KEY};
use crate::gradient::resolve_fill_rgba;
use crate::gradient_gpu::GradientGpuTable;
use crate::tessellate::{
    tessellate_ellipse, tessellate_polygon, tessellate_rounded_rect,
};
use crate::tiles::{
    merge_tile_vertices, tile_key, tile_world_rect, tiles_intersecting_rect, TileCoord,
    TILE_PREFETCH_RING, TILE_WORLD_SIZE,
};
use crate::text_font::RuntimeFontRegistry;
use crate::viewport::{expand_rect, world_viewport_rect, ViewportState, WorldRect};
use std::collections::{HashMap, HashSet};

#[derive(Clone, Copy, Debug)]
pub struct WorldTransform {
    pub a: f32,
    pub b: f32,
    pub c: f32,
    pub d: f32,
    pub e: f32,
    pub f: f32,
}

impl WorldTransform {
    pub const IDENTITY: Self = Self {
        a: 1.0,
        b: 0.0,
        c: 0.0,
        d: 1.0,
        e: 0.0,
        f: 0.0,
    };

    pub fn translate(x: f32, y: f32) -> Self {
        Self {
            a: 1.0,
            b: 0.0,
            c: 0.0,
            d: 1.0,
            e: x,
            f: y,
        }
    }

    pub fn rotate(deg: f32) -> Self {
        let rad = deg.to_radians();
        let (sin, cos) = rad.sin_cos();
        Self {
            a: cos,
            b: sin,
            c: -sin,
            d: cos,
            e: 0.0,
            f: 0.0,
        }
    }

    pub fn multiply(self, other: Self) -> Self {
        Self {
            a: self.a * other.a + self.c * other.b,
            b: self.b * other.a + self.d * other.b,
            c: self.a * other.c + self.c * other.d,
            d: self.b * other.c + self.d * other.d,
            e: self.a * other.e + self.c * other.f + self.e,
            f: self.b * other.e + self.d * other.f + self.f,
        }
    }

    pub fn apply_point(self, x: f32, y: f32) -> (f32, f32) {
        (
            self.a * x + self.c * y + self.e,
            self.b * x + self.d * y + self.f,
        )
    }
}

#[derive(Clone, Copy, Debug, bytemuck::Pod, bytemuck::Zeroable)]
#[repr(C)]
pub struct GpuVertex {
    pub world_x: f32,
    pub world_y: f32,
    pub local_x: f32,
    pub local_y: f32,
    pub color: [f32; 4],
}

#[derive(Clone, Copy, Debug, bytemuck::Pod, bytemuck::Zeroable)]
#[repr(C)]
pub struct TexturedVertex {
    pub world_x: f32,
    pub world_y: f32,
    pub uv: [f32; 2],
}

pub fn image_quad_vertices(
    world: WorldTransform,
    width: f32,
    height: f32,
    uv_rect: [f32; 4],
) -> [TexturedVertex; 6] {
    let (u0, v0, u1, v1) = (uv_rect[0], uv_rect[1], uv_rect[2], uv_rect[3]);
    let (x0, y0) = world.apply_point(0.0, 0.0);
    let (x1, y1) = world.apply_point(width, 0.0);
    let (x2, y2) = world.apply_point(width, height);
    let (x3, y3) = world.apply_point(0.0, height);
    [
        TexturedVertex { world_x: x0, world_y: y0, uv: [u0, v0] },
        TexturedVertex { world_x: x1, world_y: y1, uv: [u1, v0] },
        TexturedVertex { world_x: x2, world_y: y2, uv: [u1, v1] },
        TexturedVertex { world_x: x0, world_y: y0, uv: [u0, v0] },
        TexturedVertex { world_x: x2, world_y: y2, uv: [u1, v1] },
        TexturedVertex { world_x: x3, world_y: y3, uv: [u0, v1] },
    ]
}

fn node_local_transform(node: &NodeInput) -> WorldTransform {
    let rot = WorldTransform::rotate(node.rotation);
    let pos = WorldTransform::translate(node.x, node.y);
    pos.multiply(rot)
}

pub fn node_world_bounds(node: &NodeInput, world: WorldTransform) -> WorldRect {
    let w = node.width.max(1.0);
    let h = node.height.max(1.0);
    let corners = [
        world.apply_point(0.0, 0.0),
        world.apply_point(w, 0.0),
        world.apply_point(w, h),
        world.apply_point(0.0, h),
    ];
    let mut min_x = corners[0].0;
    let mut min_y = corners[0].1;
    let mut max_x = corners[0].0;
    let mut max_y = corners[0].1;
    for (x, y) in corners.iter().copied().skip(1) {
        min_x = min_x.min(x);
        min_y = min_y.min(y);
        max_x = max_x.max(x);
        max_y = max_y.max(y);
    }
    WorldRect {
        x: min_x,
        y: min_y,
        width: (max_x - min_x).max(1.0),
        height: (max_y - min_y).max(1.0),
    }
}

fn with_alpha(mut color: [f32; 4], opacity: f32) -> [f32; 4] {
    color[3] *= opacity.clamp(0.0, 1.0);
    color
}

fn node_stroke_color(node: &NodeInput) -> [f32; 4] {
    if !node.stroke_enabled {
        return [0.0, 0.0, 0.0, 0.0];
    }
    let width = node.stroke_width.unwrap_or(1.0);
    if width <= 0.0 {
        return [0.0, 0.0, 0.0, 0.0];
    }
    let base = parse_color(node.stroke_color.as_ref(), [0.0, 0.0, 0.0, 1.0]);
    with_alpha(base, node.stroke_opacity)
}

fn is_paintable(kind: &str) -> bool {
    matches!(
        kind,
        "frame" | "group" | "rectangle" | "ellipse" | "polygon" | "path" | "line" | "arrow" | "text" | "image"
    )
}

fn bounds_visible(bounds: &WorldRect, viewport: &WorldRect) -> bool {
    bounds.intersects(viewport)
}

fn emit_node_geometry(
    node: &NodeInput,
    world: WorldTransform,
    clip: Option<WorldRect>,
    viewport: &WorldRect,
    doc: &DocumentInput,
    textured_assets: &HashSet<String>,
    grad_table: &GradientGpuTable,
    fonts: &RuntimeFontRegistry,
    out: &mut Vec<GpuVertex>,
) {
    if !node.visible || !is_paintable(&node.kind) {
        return;
    }
    let bounds = node_world_bounds(node, world);
    if !bounds_visible(&bounds, viewport) {
        return;
    }
    if let Some(clip_rect) = clip {
        if !bounds.intersects(&clip_rect) {
            return;
        }
    }

    crate::effects::emit_layer_effects(node, world, viewport, out);

    let w = node.width.max(1.0);
    let h = node.height.max(1.0);
    let radius = node.corner_radius.unwrap_or(0.0);
    let grad_slot = grad_table.slot_for_node(&node.id);
    let color_at = |lx: f32, ly: f32| {
        if node.fill_type.as_deref() == Some("gradient") {
            if let Some(slot) = grad_slot {
                return crate::gradient_gpu::GradientGpuTable::encode_gradient_color(slot);
            }
        }
        resolve_fill_rgba(node, lx, ly)
    };

    let fill_sample = resolve_fill_rgba(node, 0.5, 0.5);
    if fill_sample[3] > 0.0 {
        match node.kind.as_str() {
            "text" => crate::text::tessellate_text_content(node, world, fonts, out),
            "image" => {
                let use_texture = node
                    .asset_id
                    .as_ref()
                    .map(|id| textured_assets.contains(id))
                    .unwrap_or(false);
                if !use_texture {
                    crate::image::tessellate_image_placeholder(node, doc, world, out);
                }
            }
            "ellipse" => tessellate_ellipse(world, w, h, &color_at, out),
            "polygon" => {
                let sides = node.polygon_sides.unwrap_or(6);
                tessellate_polygon(world, w, h, sides, &color_at, out);
            }
            "path" => crate::path::tessellate_path_node(
                node,
                world,
                fill_sample,
                node_stroke_color(node),
                out,
            ),
            "line" | "arrow" => {
                if fill_sample[3] > 0.0 {
                    tessellate_rounded_rect(world, w, h.max(1.0), 0.0, &color_at, out);
                }
                let stroke = node_stroke_color(node);
                if stroke[3] > 0.0 {
                    crate::path::tessellate_line_node(node, world, stroke, out);
                }
            }
            _ => tessellate_rounded_rect(world, w, h, radius, &color_at, out),
        }
    }

    let stroke = node_stroke_color(node);
    let stroke_width = node.stroke_width.unwrap_or(1.0);
    if stroke[3] > 0.0 && stroke_width > 0.0 {
        match node.kind.as_str() {
            "line" | "arrow" | "path" | "text" | "image" => {}
            "ellipse" => crate::stroke_dash::tessellate_ellipse_stroke(
                world,
                w,
                h,
                stroke_width,
                stroke,
                node,
                out,
            ),
            "polygon" => crate::stroke_dash::tessellate_polygon_stroke(
                world,
                w,
                h,
                node.polygon_sides.unwrap_or(6),
                stroke_width,
                stroke,
                node,
                out,
            ),
            _ => crate::stroke_dash::tessellate_rect_stroke(
                world,
                w,
                h,
                stroke_width,
                stroke,
                node,
                out,
            ),
        }
    }
}

fn walk_node(
    node_id: &str,
    parent_world: WorldTransform,
    doc: &DocumentInput,
    clip: Option<WorldRect>,
    viewport: &WorldRect,
    textured_assets: &HashSet<String>,
    grad_table: &GradientGpuTable,
    fonts: &RuntimeFontRegistry,
    out: &mut Vec<GpuVertex>,
) {
    let Some(node) = doc.nodes.get(node_id) else {
        return;
    };
    let world = parent_world.multiply(node_local_transform(node));
    emit_node_geometry(
        node,
        world,
        clip,
        viewport,
        doc,
        textured_assets,
        grad_table,
        fonts,
        out,
    );

    let node_bounds = node_world_bounds(node, world);
    let child_clip = if node.clip_children.unwrap_or(false) {
        Some(node_bounds)
    } else {
        clip
    };

    let child_ids = doc
        .child_order
        .get(node_id)
        .cloned()
        .unwrap_or_default();
    for child_id in child_ids {
        walk_node(
            &child_id,
            world,
            doc,
            child_clip,
            viewport,
            textured_assets,
            grad_table,
            fonts,
            out,
        );
    }
}

fn walk_image_draws(
    node_id: &str,
    parent_world: WorldTransform,
    doc: &DocumentInput,
    clip: Option<WorldRect>,
    viewport: &WorldRect,
    atlas_uv: &dyn Fn(&str) -> Option<[f32; 4]>,
    out: &mut Vec<TexturedVertex>,
) {
    let Some(node) = doc.nodes.get(node_id) else {
        return;
    };
    if !node.visible {
        return;
    }
    let world = parent_world.multiply(node_local_transform(node));
    if node.kind == "image" {
        let bounds = node_world_bounds(node, world);
        if bounds_visible(&bounds, viewport) {
            let clipped = clip.map(|c| bounds.intersects(&c)).unwrap_or(true);
            if clipped {
                if let Some(asset_id) = &node.asset_id {
                    if let Some(uv) = atlas_uv(asset_id) {
                        let w = node.width.max(1.0);
                        let h = node.height.max(1.0);
                        out.extend_from_slice(&image_quad_vertices(world, w, h, uv));
                    }
                }
            }
        }
    }
    let node_bounds = node_world_bounds(node, world);
    let child_clip = if node.clip_children.unwrap_or(false) {
        Some(node_bounds)
    } else {
        clip
    };
    for child_id in doc.child_order.get(node_id).cloned().unwrap_or_default() {
        walk_image_draws(&child_id, world, doc, child_clip, viewport, atlas_uv, out);
    }
}

fn root_ids(doc: &DocumentInput) -> Vec<String> {
    if !doc.root_ids.is_empty() {
        doc.root_ids.clone()
    } else {
        doc.child_order.get(ROOT_KEY).cloned().unwrap_or_default()
    }
}

pub fn collect_vertices_for_rect(
    doc: &DocumentInput,
    viewport: &WorldRect,
    textured_assets: &HashSet<String>,
    grad_table: &GradientGpuTable,
    fonts: &RuntimeFontRegistry,
) -> Vec<GpuVertex> {
    let mut out = Vec::new();
    for root_id in root_ids(doc) {
        walk_node(
            &root_id,
            WorldTransform::IDENTITY,
            doc,
            None,
            viewport,
            textured_assets,
            grad_table,
            fonts,
            &mut out,
        );
    }
    out
}

pub fn collect_image_draws(
    doc: &DocumentInput,
    viewport: ViewportState,
    atlas_uv: &dyn Fn(&str) -> Option<[f32; 4]>,
) -> Vec<TexturedVertex> {
    let vp = expand_rect(world_viewport_rect(viewport), 128.0);
    let mut out = Vec::new();
    for root_id in root_ids(doc) {
        walk_image_draws(
            &root_id,
            WorldTransform::IDENTITY,
            doc,
            None,
            &vp,
            atlas_uv,
            &mut out,
        );
    }
    out
}

pub fn collect_vertices(
    doc: &DocumentInput,
    viewport: ViewportState,
    fonts: &RuntimeFontRegistry,
) -> Vec<GpuVertex> {
    let grad_table = GradientGpuTable::from_document(doc);
    collect_vertices_for_rect(
        doc,
        &expand_rect(world_viewport_rect(viewport), 128.0),
        &HashSet::new(),
        &grad_table,
        fonts,
    )
}

fn collect_touched_tiles(
    node_id: &str,
    parent_world: WorldTransform,
    doc: &DocumentInput,
    out: &mut HashSet<TileCoord>,
) {
    let Some(node) = doc.nodes.get(node_id) else {
        return;
    };
    let world = parent_world.multiply(node_local_transform(node));
    if node.visible && is_paintable(&node.kind) {
        let bounds = node_world_bounds(node, world);
        for tile in tiles_intersecting_rect(&bounds) {
            out.insert(tile);
        }
    }
    let child_ids = doc.child_order.get(node_id).cloned().unwrap_or_default();
    for child_id in child_ids {
        collect_touched_tiles(&child_id, world, doc, out);
    }
}

fn find_node_tiles(
    current_id: &str,
    target_id: &str,
    parent_world: WorldTransform,
    doc: &DocumentInput,
    out: &mut HashSet<TileCoord>,
) -> bool {
    let Some(node) = doc.nodes.get(current_id) else {
        return false;
    };
    let world = parent_world.multiply(node_local_transform(node));
    let mut found = current_id == target_id;
    if found && node.visible && is_paintable(&node.kind) {
        let bounds = node_world_bounds(node, world);
        for tile in tiles_intersecting_rect(&bounds) {
            out.insert(tile);
        }
    }
    for child_id in doc.child_order.get(current_id).cloned().unwrap_or_default() {
        if find_node_tiles(&child_id, target_id, world, doc, out) {
            found = true;
        }
    }
    found
}

/** Tiles touched by a single node (uses parent chain for world bounds). */
pub fn tiles_for_node_id(node_id: &str, doc: &DocumentInput) -> Vec<TileCoord> {
    let mut set = HashSet::new();
    for root_id in root_ids(doc) {
        find_node_tiles(&root_id, node_id, WorldTransform::IDENTITY, doc, &mut set);
    }
    let mut coords: Vec<_> = set.into_iter().collect();
    coords.sort_by(|a, b| (a.tx, a.ty).cmp(&(b.tx, b.ty)));
    coords
}

pub fn scene_tile_coords(doc: &DocumentInput) -> Vec<TileCoord> {
    let mut set = HashSet::new();
    for root_id in root_ids(doc) {
        collect_touched_tiles(&root_id, WorldTransform::IDENTITY, doc, &mut set);
    }
    let mut coords: Vec<_> = set.into_iter().collect();
    coords.sort_by(|a, b| (a.tx, a.ty).cmp(&(b.tx, b.ty)));
    coords
}

/** Rebuild only the given tile coords in an existing cache. */
pub fn rebuild_tile_cache_partial(
    cache: &mut HashMap<String, Vec<GpuVertex>>,
    doc: &DocumentInput,
    coords: &[TileCoord],
    textured_assets: &HashSet<String>,
    grad_table: &GradientGpuTable,
    fonts: &RuntimeFontRegistry,
) {
    for coord in coords {
        let key = tile_key(coord.tx, coord.ty);
        let rect = tile_world_rect(coord.tx, coord.ty);
        let verts = collect_vertices_for_rect(doc, &rect, textured_assets, grad_table, fonts);
        if verts.is_empty() {
            cache.remove(&key);
        } else {
            cache.insert(key, verts);
        }
    }
}

/** Build per-tile vertex cache (512×512 world units, matches WebGL tile grid). */
pub fn build_tile_cache(
    doc: &DocumentInput,
    textured_assets: &HashSet<String>,
    grad_table: &GradientGpuTable,
    fonts: &RuntimeFontRegistry,
) -> HashMap<String, Vec<GpuVertex>> {
    let mut cache = HashMap::new();
    for coord in scene_tile_coords(doc) {
        let rect = tile_world_rect(coord.tx, coord.ty);
        let verts = collect_vertices_for_rect(doc, &rect, textured_assets, grad_table, fonts);
        if !verts.is_empty() {
            cache.insert(tile_key(coord.tx, coord.ty), verts);
        }
    }
    cache
}

pub fn collect_visible_tile_vertices(
    cache: &HashMap<String, Vec<GpuVertex>>,
    viewport: ViewportState,
) -> Vec<GpuVertex> {
    let vp = expand_rect(world_viewport_rect(viewport), TILE_WORLD_SIZE * 0.25);
    let visible = tiles_intersecting_rect(&vp);
    let expanded = crate::tiles::expand_tile_ring(&visible, TILE_PREFETCH_RING);
    merge_tile_vertices(cache, &expanded)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::document::{DocumentInput, NodeInput};
    use std::collections::HashMap;

    fn base_node(id: &str, kind: &str) -> NodeInput {
        NodeInput {
            id: id.into(),
            kind: kind.into(),
            parent_id: None,
            visible: true,
            locked: false,
            x: 0.0,
            y: 0.0,
            width: 100.0,
            height: 80.0,
            rotation: 0.0,
            fill_enabled: true,
            fill: Some("#ff0000".into()),
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
            content: None,
            font_size: None,
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

    fn default_doc(nodes: HashMap<String, NodeInput>, child_order: HashMap<String, Vec<String>>, root_ids: Vec<String>) -> DocumentInput {
        DocumentInput {
            root_ids,
            nodes,
            child_order,
            assets: HashMap::new(),
        }
    }

    fn default_vp() -> ViewportState {
        ViewportState {
            pan_x: 0.0,
            pan_y: 0.0,
            zoom: 1.0,
            css_width: 2000.0,
            css_height: 2000.0,
        }
    }

    #[test]
    fn collects_nested_scene_vertices() {
        let mut nodes = HashMap::new();
        nodes.insert("frame".into(), base_node("frame", "frame"));
        let mut rect = base_node("rect", "rectangle");
        rect.parent_id = Some("frame".into());
        rect.x = 10.0;
        rect.y = 20.0;
        nodes.insert("rect".into(), rect);
        let mut child_order = HashMap::new();
        child_order.insert("__root__".into(), vec!["frame".into()]);
        child_order.insert("frame".into(), vec!["rect".into()]);
        let doc = default_doc(nodes, child_order, vec!["frame".into()]);
        let fonts = RuntimeFontRegistry::default();
        let verts = collect_vertices(&doc, default_vp(), &fonts);
        assert!(verts.len() >= 12);
    }

    #[test]
    fn viewport_cull_skips_offscreen_nodes() {
        let mut nodes = HashMap::new();
        let mut far = base_node("far", "rectangle");
        far.x = 10_000.0;
        far.y = 10_000.0;
        nodes.insert("far".into(), far);
        let mut child_order = HashMap::new();
        child_order.insert("__root__".into(), vec!["far".into()]);
        let doc = default_doc(nodes, child_order, vec!["far".into()]);
        let fonts = RuntimeFontRegistry::default();
        assert_eq!(collect_vertices(&doc, default_vp(), &fonts).len(), 0);
    }

    #[test]
    fn tile_cache_splits_scene_by_tile() {
        let mut nodes = HashMap::new();
        let mut a = base_node("a", "rectangle");
        a.x = 50.0;
        a.y = 50.0;
        nodes.insert("a".into(), a);
        let mut b = base_node("b", "rectangle");
        b.x = 600.0;
        b.y = 50.0;
        nodes.insert("b".into(), b);
        let mut child_order = HashMap::new();
        child_order.insert("__root__".into(), vec!["a".into(), "b".into()]);
        let doc = default_doc(nodes, child_order, vec!["a".into(), "b".into()]);
        let grad_table = GradientGpuTable::from_document(&doc);
        let fonts = RuntimeFontRegistry::default();
        let cache = build_tile_cache(&doc, &HashSet::new(), &grad_table, &fonts);
        assert!(cache.len() >= 2);
    }
}
