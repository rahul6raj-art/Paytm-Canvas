use crate::document::NodeInput;
use crate::viewport::WorldRect;

/** Figma: frames clip by default; groups clip only when explicitly enabled. */
pub fn should_clip_children(node: &NodeInput) -> bool {
    match node.kind.as_str() {
        "frame" => node.clip_children != Some(false),
        "group" => node.clip_children == Some(true),
        _ => false,
    }
}

/** Intersect an ancestor clip stack with a new clipping frame (nested clip). */
pub fn push_clip(existing: Option<WorldRect>, node_bounds: WorldRect) -> Option<WorldRect> {
    match existing {
        Some(rect) => rect.intersect(&node_bounds),
        None => Some(node_bounds),
    }
}
