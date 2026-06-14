use crate::document::{DocumentInput, NodeInput, ROOT_KEY};
use crate::scene::{node_world_bounds, WorldTransform};
use crate::viewport::WorldRect;

fn node_local_transform(node: &NodeInput) -> WorldTransform {
    let rot = WorldTransform::rotate(node.rotation);
    let pos = WorldTransform::translate(node.x, node.y);
    pos.multiply(rot)
}

fn is_hittable(kind: &str) -> bool {
    matches!(
        kind,
        "frame" | "group" | "rectangle" | "ellipse" | "polygon" | "path" | "line" | "arrow" | "text" | "image"
    )
}

fn should_clip_children(node: &NodeInput) -> bool {
    match node.kind.as_str() {
        "frame" => node.clip_children != Some(false),
        "group" => node.clip_children == Some(true),
        _ => false,
    }
}

fn point_in_bounds(px: f32, py: f32, bounds: &WorldRect) -> bool {
    px >= bounds.x && px <= bounds.right() && py >= bounds.y && py <= bounds.bottom()
}

fn point_in_clip(px: f32, py: f32, clip: Option<WorldRect>) -> bool {
    match clip {
        Some(rect) => point_in_bounds(px, py, &rect),
        None => true,
    }
}

fn child_ids_for_parent(doc: &DocumentInput, parent_id: &str) -> Vec<String> {
    let from_order: Vec<String> = doc
        .child_order
        .get(parent_id)
        .cloned()
        .unwrap_or_default()
        .into_iter()
        .filter(|id| {
            doc.nodes
                .get(id)
                .map(|n| n.parent_id.as_deref() == Some(parent_id))
                .unwrap_or(false)
        })
        .collect();
    if !from_order.is_empty() {
        return from_order;
    }
    let mut fallback: Vec<String> = doc
        .nodes
        .iter()
        .filter(|(_, n)| {
            n.parent_id.as_deref() == Some(parent_id) && n.visible && !n.locked && is_hittable(&n.kind)
        })
        .map(|(id, _)| id.clone())
        .collect();
    fallback.sort();
    fallback
}

fn walk_hit(
    node_id: &str,
    parent_world: WorldTransform,
    doc: &DocumentInput,
    wx: f32,
    wy: f32,
    clip: Option<WorldRect>,
    hits: &mut Vec<String>,
) {
    let Some(node) = doc.nodes.get(node_id) else {
        return;
    };
    if !node.visible || node.locked || !is_hittable(&node.kind) {
        return;
    }
    let world = parent_world.multiply(node_local_transform(node));
    let bounds = node_world_bounds(node, world);
    let child_clip = if should_clip_children(node) {
        Some(bounds)
    } else {
        clip
    };
    if point_in_clip(wx, wy, clip) && point_in_bounds(wx, wy, &bounds) {
        hits.push(node_id.to_string());
    }
    let child_ids = child_ids_for_parent(doc, node_id);
    for child_id in child_ids {
        walk_hit(&child_id, world, doc, wx, wy, child_clip, hits);
    }
}

/** Deepest node at world point (paint order — last match wins). */
pub fn hit_test_deepest(doc: &DocumentInput, world_x: f32, world_y: f32) -> Option<String> {
    let roots = if !doc.root_ids.is_empty() {
        doc.root_ids.clone()
    } else {
        doc.child_order.get(ROOT_KEY).cloned().unwrap_or_default()
    };
    let mut hits = Vec::new();
    for root_id in roots {
        walk_hit(
            &root_id,
            WorldTransform::IDENTITY,
            doc,
            world_x,
            world_y,
            None,
            &mut hits,
        );
    }
    hits.pop()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::document::NodeInput;
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
            width: 200.0,
            height: 200.0,
            rotation: 0.0,
            fill_enabled: true,
            fill: Some("#fff".into()),
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

    #[test]
    fn picks_deepest_child() {
        let mut nodes = HashMap::new();
        nodes.insert("frame".into(), base_node("frame", "frame"));
        let mut child = base_node("child", "rectangle");
        child.parent_id = Some("frame".into());
        child.x = 20.0;
        child.y = 20.0;
        child.width = 80.0;
        child.height = 80.0;
        child.fill = Some("#f00".into());
        nodes.insert("child".into(), child);
        let mut child_order = HashMap::new();
        child_order.insert("__root__".into(), vec!["frame".into()]);
        child_order.insert("frame".into(), vec!["child".into()]);
        let doc = DocumentInput {
            root_ids: vec!["frame".into()],
            nodes,
            child_order,
            assets: HashMap::new(),
        };
        assert_eq!(hit_test_deepest(&doc, 50.0, 50.0).as_deref(), Some("child"));
    }

    #[test]
    fn picks_child_via_parent_id_when_child_order_empty() {
        let mut nodes = HashMap::new();
        nodes.insert("frame".into(), base_node("frame", "frame"));
        let mut child = base_node("child", "rectangle");
        child.parent_id = Some("frame".into());
        child.x = 20.0;
        child.y = 20.0;
        child.width = 80.0;
        child.height = 80.0;
        child.fill = Some("#f00".into());
        nodes.insert("child".into(), child);
        let mut child_order = HashMap::new();
        child_order.insert("__root__".into(), vec!["frame".into()]);
        child_order.insert("frame".into(), vec![]);
        let doc = DocumentInput {
            root_ids: vec!["frame".into()],
            nodes,
            child_order,
            assets: HashMap::new(),
        };
        assert_eq!(hit_test_deepest(&doc, 50.0, 50.0).as_deref(), Some("child"));
    }

    #[test]
    fn golden_scene_hit_test_targets_expected_nodes() {
        let json = include_str!("../../../fixtures/golden-tile-scene.json");
        let doc = crate::document::parse_document(json).expect("golden fixture");
        assert_eq!(
            hit_test_deepest(&doc, 200.0, 150.0).as_deref(),
            Some("rect-fill"),
            "center of orange card"
        );
        assert_eq!(
            hit_test_deepest(&doc, 110.0, 110.0).as_deref(),
            Some("frame-main"),
            "frame chrome not covered by children"
        );
    }
}
