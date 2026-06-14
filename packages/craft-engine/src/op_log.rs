use crate::document::{DocumentInput, NodeInput, ROOT_KEY};
use serde::Deserialize;
use std::collections::HashMap;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentOp {
    pub op: String,
    pub node_id: String,
    #[serde(default)]
    pub fields: HashMap<String, serde_json::Value>,
    #[serde(default)]
    pub parent_id: Option<String>,
}

fn remove_node_recursive(doc: &mut DocumentInput, node_id: &str) {
    if let Some(children) = doc.child_order.get(node_id).cloned() {
        for child in children {
            remove_node_recursive(doc, &child);
        }
    }
    doc.nodes.remove(node_id);
    doc.child_order.remove(node_id);
    doc.root_ids.retain(|id| id != node_id);
    for list in doc.child_order.values_mut() {
        list.retain(|id| id != node_id);
    }
}

fn merge_node_fields(node: &mut NodeInput, fields: &HashMap<String, serde_json::Value>) {
    if let Some(v) = fields.get("x").and_then(|v| v.as_f64()) {
        node.x = v as f32;
    }
    if let Some(v) = fields.get("y").and_then(|v| v.as_f64()) {
        node.y = v as f32;
    }
    if let Some(v) = fields.get("width").and_then(|v| v.as_f64()) {
        node.width = v as f32;
    }
    if let Some(v) = fields.get("height").and_then(|v| v.as_f64()) {
        node.height = v as f32;
    }
    if let Some(v) = fields.get("rotation").and_then(|v| v.as_f64()) {
        node.rotation = v as f32;
    }
    if let Some(v) = fields.get("visible").and_then(|v| v.as_bool()) {
        node.visible = v;
    }
    if let Some(v) = fields.get("locked").and_then(|v| v.as_bool()) {
        node.locked = v;
    }
    if let Some(v) = fields.get("fill").and_then(|v| v.as_str()) {
        node.fill = Some(v.into());
    }
    if let Some(v) = fields.get("content").and_then(|v| v.as_str()) {
        node.content = Some(v.into());
    }
}

pub fn apply_document_op(doc: &mut DocumentInput, op: &DocumentOp) -> Result<(), String> {
    match op.op.as_str() {
        "updateNode" => {
            if let Some(raw) = op.fields.get("node") {
                let node: NodeInput = serde_json::from_value(raw.clone())
                    .map_err(|e| format!("invalid node payload: {e}"))?;
                doc.nodes.insert(op.node_id.clone(), node);
                return Ok(());
            }
            let node = doc
                .nodes
                .get_mut(&op.node_id)
                .ok_or_else(|| format!("node not found: {}", op.node_id))?;
            merge_node_fields(node, &op.fields);
            Ok(())
        }
        "moveNode" => {
            let node = doc
                .nodes
                .get_mut(&op.node_id)
                .ok_or_else(|| format!("node not found: {}", op.node_id))?;
            if let Some(v) = op.fields.get("x").and_then(|v| v.as_f64()) {
                node.x = v as f32;
            }
            if let Some(v) = op.fields.get("y").and_then(|v| v.as_f64()) {
                node.y = v as f32;
            }
            Ok(())
        }
        "deleteNode" => {
            remove_node_recursive(doc, &op.node_id);
            Ok(())
        }
        "insertNode" => {
            let raw = op
                .fields
                .get("node")
                .ok_or_else(|| "insertNode requires fields.node".to_string())?;
            let node: NodeInput = serde_json::from_value(raw.clone())
                .map_err(|e| format!("invalid node payload: {e}"))?;
            let id = node.id.clone();
            doc.nodes.insert(id.clone(), node);
            let parent = op.parent_id.clone().unwrap_or_else(|| ROOT_KEY.into());
            if parent == ROOT_KEY {
                if !doc.root_ids.contains(&id) {
                    doc.root_ids.push(id.clone());
                }
            }
            doc.child_order.entry(parent).or_default().push(id);
            Ok(())
        }
        "setTree" => {
            if let Some(v) = op.fields.get("childOrder") {
                doc.child_order = serde_json::from_value(v.clone())
                    .map_err(|e| format!("invalid childOrder: {e}"))?;
            }
            if let Some(v) = op.fields.get("rootIds") {
                doc.root_ids = serde_json::from_value(v.clone())
                    .map_err(|e| format!("invalid rootIds: {e}"))?;
            }
            Ok(())
        }
        _ => Err(format!("unknown op: {}", op.op)),
    }
}

pub fn parse_op(json: &str) -> Result<DocumentOp, serde_json::Error> {
    serde_json::from_str(json)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::document::NodeInput;

    fn sample_node() -> NodeInput {
        NodeInput {
            id: "a".into(),
            kind: "rectangle".into(),
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

    #[test]
    fn set_tree_op_updates_child_order() {
        let mut doc = DocumentInput {
            root_ids: vec!["a".into(), "b".into()],
            nodes: HashMap::from([
                ("a".into(), sample_node()),
                (
                    "b".into(),
                    NodeInput {
                        id: "b".into(),
                        ..sample_node()
                    },
                ),
            ]),
            child_order: HashMap::from([(ROOT_KEY.into(), vec!["a".into(), "b".into()])]),
            assets: HashMap::new(),
        };
        let op = DocumentOp {
            op: "setTree".into(),
            node_id: ROOT_KEY.into(),
            fields: HashMap::from([(
                "childOrder".into(),
                serde_json::json!({ "__root__": ["b", "a"] }),
            )]),
            parent_id: None,
        };
        apply_document_op(&mut doc, &op).unwrap();
        assert_eq!(doc.child_order[ROOT_KEY], vec!["b".to_string(), "a".to_string()]);
    }

    #[test]
    fn insert_and_delete_node_ops() {
        let mut doc = DocumentInput {
            root_ids: vec!["a".into()],
            nodes: HashMap::from([("a".into(), sample_node())]),
            child_order: HashMap::from([(ROOT_KEY.into(), vec!["a".into()])]),
            assets: HashMap::new(),
        };
        let mut child = sample_node();
        child.id = "b".into();
        let insert = DocumentOp {
            op: "insertNode".into(),
            node_id: "b".into(),
            fields: HashMap::from([("node".into(), serde_json::to_value(&child).unwrap())]),
            parent_id: Some(ROOT_KEY.into()),
        };
        apply_document_op(&mut doc, &insert).unwrap();
        assert!(doc.nodes.contains_key("b"));
        assert!(doc.root_ids.contains(&"b".to_string()));

        let delete = DocumentOp {
            op: "deleteNode".into(),
            node_id: "b".into(),
            fields: HashMap::new(),
            parent_id: None,
        };
        apply_document_op(&mut doc, &delete).unwrap();
        assert!(!doc.nodes.contains_key("b"));
    }

    #[test]
    fn move_node_op_updates_position() {
        let mut doc = DocumentInput {
            root_ids: vec!["a".into()],
            nodes: HashMap::from([("a".into(), sample_node())]),
            child_order: HashMap::from([(ROOT_KEY.into(), vec!["a".into()])]),
            assets: HashMap::new(),
        };
        let op = DocumentOp {
            op: "moveNode".into(),
            node_id: "a".into(),
            fields: HashMap::from([
                ("x".into(), serde_json::json!(50.0)),
                ("y".into(), serde_json::json!(30.0)),
            ]),
            parent_id: None,
        };
        apply_document_op(&mut doc, &op).unwrap();
        assert_eq!(doc.nodes["a"].x, 50.0);
        assert_eq!(doc.nodes["a"].y, 30.0);
    }
}
