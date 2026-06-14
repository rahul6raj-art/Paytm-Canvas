use crate::document::DocumentInput;
use crate::scene::{scene_tile_coords, tiles_for_node_id};
use crate::tiles::TileCoord;
use std::collections::{HashMap, HashSet};

fn child_order_changed(
    prev: &HashMap<String, Vec<String>>,
    next: &HashMap<String, Vec<String>>,
) -> bool {
    if prev.len() != next.len() {
        return true;
    }
    for (key, a) in prev {
        let b = next.get(key).map(|v| v.as_slice()).unwrap_or(&[]);
        if a.len() != b.len() {
            return true;
        }
        for (i, id) in a.iter().enumerate() {
            if b.get(i) != Some(id) {
                return true;
            }
        }
    }
    false
}

fn node_visual_changed(a: &DocumentInput, b: &DocumentInput, id: &str) -> bool {
    match (a.nodes.get(id), b.nodes.get(id)) {
        (Some(x), Some(y)) => x != y,
        _ => true,
    }
}

fn add_tiles_for_node(out: &mut HashSet<TileCoord>, node_id: &str, doc: &DocumentInput) {
    for coord in tiles_for_node_id(node_id, doc) {
        out.insert(coord);
    }
}

/** Tile coords needing rebuild after a document edit (mirrors `tileDirty.ts`). */
pub fn tiles_dirty_for_document_change(
    prev: Option<&DocumentInput>,
    next: &DocumentInput,
) -> Vec<TileCoord> {
    let Some(prev) = prev else {
        return scene_tile_coords(next);
    };

    let mut dirty = HashSet::new();

    if child_order_changed(&prev.child_order, &next.child_order) {
        for id in prev.nodes.keys() {
            add_tiles_for_node(&mut dirty, id, prev);
        }
        for id in next.nodes.keys() {
            add_tiles_for_node(&mut dirty, id, next);
        }
        return dirty.into_iter().collect();
    }

    let mut ids: HashSet<_> = prev.nodes.keys().cloned().collect();
    ids.extend(next.nodes.keys().cloned());

    for id in ids {
        let a = prev.nodes.get(&id);
        let b = next.nodes.get(&id);
        match (a, b) {
            (None, Some(_)) => add_tiles_for_node(&mut dirty, &id, next),
            (Some(_), None) => add_tiles_for_node(&mut dirty, &id, prev),
            (Some(_), Some(_)) if node_visual_changed(prev, next, &id) => {
                add_tiles_for_node(&mut dirty, &id, prev);
                add_tiles_for_node(&mut dirty, &id, next);
            }
            _ => {}
        }
    }

    dirty.into_iter().collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::document::NodeInput;
    use std::collections::HashMap;

    fn node(id: &str, x: f32) -> NodeInput {
        NodeInput {
            id: id.into(),
            kind: "rectangle".into(),
            parent_id: None,
            visible: true,
            locked: false,
            x,
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

    #[test]
    fn dirty_tiles_on_node_move() {
        let mut child_order = HashMap::new();
        child_order.insert("__root__".into(), vec!["a".into()]);
        let prev = DocumentInput {
            root_ids: vec!["a".into()],
            nodes: HashMap::from([("a".into(), node("a", 0.0))]),
            child_order: child_order.clone(),
            assets: HashMap::new(),
        };
        let next = DocumentInput {
            root_ids: vec!["a".into()],
            nodes: HashMap::from([("a".into(), node("a", 400.0))]),
            child_order,
            assets: HashMap::new(),
        };
        let dirty = tiles_dirty_for_document_change(Some(&prev), &next);
        assert!(!dirty.is_empty());
    }
}
