use crate::document::DocumentInput;

const DEFAULT_LIMIT: usize = 64;

pub struct DocumentHistory {
    undo: Vec<DocumentInput>,
    redo: Vec<DocumentInput>,
    limit: usize,
}

impl DocumentHistory {
    pub fn new() -> Self {
        Self {
            undo: Vec::new(),
            redo: Vec::new(),
            limit: DEFAULT_LIMIT,
        }
    }

    pub fn clear(&mut self) {
        self.undo.clear();
        self.redo.clear();
    }

    pub fn can_undo(&self) -> bool {
        !self.undo.is_empty()
    }

    pub fn can_redo(&self) -> bool {
        !self.redo.is_empty()
    }

    pub fn push_snapshot(&mut self, snapshot: DocumentInput) {
        self.undo.push(snapshot);
        if self.undo.len() > self.limit {
            self.undo.remove(0);
        }
        self.redo.clear();
    }

    pub fn undo(&mut self, current: &DocumentInput) -> Option<DocumentInput> {
        let prev = self.undo.pop()?;
        self.redo.push(current.clone());
        Some(prev)
    }

    pub fn redo(&mut self, current: &DocumentInput) -> Option<DocumentInput> {
        let next = self.redo.pop()?;
        self.undo.push(current.clone());
        Some(next)
    }
}

impl Default for DocumentHistory {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::document::NodeInput;
    use std::collections::HashMap;

    fn doc(x: f32) -> DocumentInput {
        DocumentInput {
            root_ids: vec!["a".into()],
            nodes: HashMap::from([(
                "a".into(),
                NodeInput {
                    id: "a".into(),
                    kind: "rectangle".into(),
                    parent_id: None,
                    visible: true,
                    locked: false,
                    x,
                    y: 0.0,
                    width: 10.0,
                    height: 10.0,
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
                },
            )]),
            child_order: HashMap::from([("__root__".into(), vec!["a".into()])]),
            assets: HashMap::new(),
        }
    }

    #[test]
    fn undo_redo_round_trip() {
        let mut h = DocumentHistory::new();
        let a = doc(0.0);
        let b = doc(10.0);
        h.push_snapshot(a.clone());
        let restored = h.undo(&b).unwrap();
        assert_eq!(restored.nodes["a"].x, 0.0);
        let again = h.redo(&restored).unwrap();
        assert_eq!(again.nodes["a"].x, 10.0);
    }
}
