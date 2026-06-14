use crate::document::{DocumentInput, GradientInput};
use crate::gradient::sort_stops;
use std::collections::HashMap;

pub const MAX_GRADIENT_SLOTS: usize = 16;
pub const MAX_STOPS_PER_GRADIENT: usize = 4;

#[repr(C)]
#[derive(Clone, Copy, Debug, bytemuck::Pod, bytemuck::Zeroable)]
pub struct GradientStopGpu {
    pub pos: f32,
    pub color: [f32; 4],
    pub _pad: [f32; 3],
}

#[repr(C)]
#[derive(Clone, Copy, Debug, bytemuck::Pod, bytemuck::Zeroable)]
pub struct GradientEntryGpu {
    pub kind: u32,
    pub stop_count: u32,
    pub opacity: f32,
    pub _pad0: f32,
    pub h0: [f32; 2],
    pub h1: [f32; 2],
    pub stops: [GradientStopGpu; MAX_STOPS_PER_GRADIENT],
}

#[repr(C)]
#[derive(Clone, Copy, Debug, bytemuck::Pod, bytemuck::Zeroable)]
pub struct GradientUniformBlock {
    pub entries: [GradientEntryGpu; MAX_GRADIENT_SLOTS],
    pub count: u32,
    pub _pad: [u32; 3],
}

impl Default for GradientUniformBlock {
    fn default() -> Self {
        Self {
            entries: [GradientEntryGpu::empty(); MAX_GRADIENT_SLOTS],
            count: 0,
            _pad: [0; 3],
        }
    }
}

impl GradientEntryGpu {
    fn empty() -> Self {
        Self {
            kind: 0,
            stop_count: 0,
            opacity: 1.0,
            _pad0: 0.0,
            h0: [0.5, 0.5],
            h1: [1.0, 0.5],
            stops: [GradientStopGpu::empty(); MAX_STOPS_PER_GRADIENT],
        }
    }
}

impl GradientStopGpu {
    fn empty() -> Self {
        Self {
            pos: 0.0,
            color: [0.0, 0.0, 0.0, 0.0],
            _pad: [0.0; 3],
        }
    }
}

fn kind_to_u32(kind: &str) -> u32 {
    match kind {
        "linear" => 0,
        "radial" => 1,
        "angular" => 2,
        "diamond" => 3,
        _ => 0,
    }
}

fn entry_from_gradient(grad: &GradientInput) -> GradientEntryGpu {
    let stops = sort_stops(&grad.stops);
    let mut gpu_stops = [GradientStopGpu::empty(); MAX_STOPS_PER_GRADIENT];
    let count = stops.len().min(MAX_STOPS_PER_GRADIENT);
    for (i, stop) in stops.iter().take(count).enumerate() {
        let c = crate::document::parse_color(stop.color.as_ref(), [0.5, 0.5, 0.5, 1.0]);
        let o = stop.opacity.unwrap_or(1.0);
        gpu_stops[i] = GradientStopGpu {
            pos: stop.position,
            color: [c[0], c[1], c[2], c[3] * o],
            _pad: [0.0; 3],
        };
    }
    let h0 = grad
        .handles
        .first()
        .cloned()
        .unwrap_or(crate::document::GradientHandleInput { x: 0.0, y: 0.5 });
    let h1 = grad
        .handles
        .get(1)
        .cloned()
        .unwrap_or(crate::document::GradientHandleInput { x: 1.0, y: 0.5 });
    GradientEntryGpu {
        kind: kind_to_u32(&grad.kind),
        stop_count: count as u32,
        opacity: grad.opacity.unwrap_or(1.0),
        _pad0: 0.0,
        h0: [h0.x, h0.y],
        h1: [h1.x, h1.y],
        stops: gpu_stops,
    }
}

pub struct GradientGpuTable {
    block: GradientUniformBlock,
    node_slots: HashMap<String, u32>,
}

impl GradientGpuTable {
    pub fn empty() -> Self {
        Self {
            block: GradientUniformBlock::default(),
            node_slots: HashMap::new(),
        }
    }

    pub fn from_document(doc: &DocumentInput) -> Self {
        let mut block = GradientUniformBlock::default();
        let mut node_slots = HashMap::new();
        let mut dedup: HashMap<String, u32> = HashMap::new();
        let mut next_slot = 0u32;

        for (node_id, node) in &doc.nodes {
            if node.fill_type.as_deref() != Some("gradient") {
                continue;
            }
            let Some(grad) = &node.fill_gradient else {
                continue;
            };
            let key = serde_json::to_string(grad).unwrap_or_else(|_| node_id.clone());
            let slot = if let Some(&s) = dedup.get(&key) {
                s
            } else if (next_slot as usize) < MAX_GRADIENT_SLOTS {
                let s = next_slot;
                block.entries[s as usize] = entry_from_gradient(grad);
                next_slot += 1;
                block.count = next_slot;
                dedup.insert(key, s);
                s
            } else {
                continue;
            };
            node_slots.insert(node_id.clone(), slot);
        }

        Self { block, node_slots }
    }

    pub fn uniform_block(&self) -> &GradientUniformBlock {
        &self.block
    }

    pub fn slot_for_node(&self, node_id: &str) -> Option<u32> {
        self.node_slots.get(node_id).copied()
    }

    pub fn encode_gradient_color(slot: u32) -> [f32; 4] {
        [0.0, 0.0, 0.0, -(slot as f32 + 1.0)]
    }

    /** CPU gradient sample for headless raster (matches GPU fragment logic). */
    pub fn sample_entry_at(entry: &GradientEntryGpu, local_x: f32, local_y: f32) -> [f32; 4] {
        let t = match entry.kind {
            0 => {
                let h0 = entry.h0;
                let h1 = entry.h1;
                let dx = h1[0] - h0[0];
                let dy = h1[1] - h0[1];
                let len_sq = dx * dx + dy * dy;
                if len_sq <= 0.0001 {
                    0.0
                } else {
                    (((local_x - h0[0]) * dx + (local_y - h0[1]) * dy) / len_sq).clamp(0.0, 1.0)
                }
            }
            1 => {
                let dx = local_x - entry.h0[0];
                let dy = local_y - entry.h0[1];
                (dx * dx + dy * dy).sqrt().clamp(0.0, 1.0)
            }
            2 => {
                let angle = (local_y - entry.h0[1]).atan2(local_x - entry.h0[0]);
                (angle / std::f32::consts::TAU + 1.0) % 1.0
            }
            _ => {
                let dx = (local_x - 0.5).abs();
                let dy = (local_y - 0.5).abs();
                (dx + dy).clamp(0.0, 1.0)
            }
        };
        let count = entry.stop_count as usize;
        if count == 0 {
            return [0.0, 0.0, 0.0, 0.0];
        }
        if count == 1 {
            let mut c = entry.stops[0].color;
            c[3] *= entry.opacity;
            return c;
        }
        for i in 0..count.saturating_sub(1) {
            let s0 = entry.stops[i];
            let s1 = entry.stops[i + 1];
            if t >= s0.pos && t <= s1.pos {
                let span = (s1.pos - s0.pos).max(0.0001);
                let u = (t - s0.pos) / span;
                let mut c = [
                    s0.color[0] + (s1.color[0] - s0.color[0]) * u,
                    s0.color[1] + (s1.color[1] - s0.color[1]) * u,
                    s0.color[2] + (s1.color[2] - s0.color[2]) * u,
                    s0.color[3] + (s1.color[3] - s0.color[3]) * u,
                ];
                c[3] *= entry.opacity;
                return c;
            }
        }
        let mut c = entry.stops[count - 1].color;
        c[3] *= entry.opacity;
        c
    }

    pub fn resolve_vertex_color(
        &self,
        color: [f32; 4],
        local_x: f32,
        local_y: f32,
    ) -> [f32; 4] {
        if color[3] >= 0.0 {
            return color;
        }
        let slot = (-(color[3] + 1.0)).round() as u32;
        if slot >= self.block.count {
            return [1.0, 0.0, 1.0, 1.0];
        }
        Self::sample_entry_at(&self.block.entries[slot as usize], local_x, local_y)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::document::{GradientHandleInput, GradientInput, GradientStopInput, NodeInput};
    use std::collections::HashMap;

    #[test]
    fn assigns_gradient_slots() {
        let grad = GradientInput {
            kind: "linear".into(),
            opacity: Some(1.0),
            handles: vec![
                GradientHandleInput { x: 0.0, y: 0.5 },
                GradientHandleInput { x: 1.0, y: 0.5 },
            ],
            stops: vec![GradientStopInput {
                position: 0.0,
                color: Some("#000000".into()),
                opacity: Some(1.0),
            }],
        };
        let node = NodeInput {
            id: "r".into(),
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
            fill: None,
            fill_type: Some("gradient".into()),
            fill_gradient: Some(grad),
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
        };
        let doc = DocumentInput {
            root_ids: vec!["r".into()],
            nodes: HashMap::from([("r".into(), node)]),
            child_order: HashMap::from([("__root__".into(), vec!["r".into()])]),
            assets: HashMap::new(),
        };
        let table = GradientGpuTable::from_document(&doc);
        assert_eq!(table.slot_for_node("r"), Some(0));
        assert_eq!(table.uniform_block().count, 1);
    }
}
