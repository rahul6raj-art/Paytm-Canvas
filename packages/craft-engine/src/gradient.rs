use crate::document::{parse_color, GradientInput, GradientStopInput, NodeInput};

const MAX_STOPS: usize = 8;

fn normalize_stop_position(position: f32) -> f32 {
    if position > 1.0 {
        (position / 100.0).clamp(0.0, 1.0)
    } else {
        position.clamp(0.0, 1.0)
    }
}

pub fn sort_stops(stops: &[GradientStopInput]) -> Vec<GradientStopInput> {
    let mut out: Vec<_> = stops
        .iter()
        .cloned()
        .map(|mut s| {
            s.position = normalize_stop_position(s.position);
            s
        })
        .collect();
    out.sort_by(|a, b| {
        a.position
            .partial_cmp(&b.position)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    out
}

fn lerp(a: f32, b: f32, t: f32) -> f32 {
    a + (b - a) * t
}

pub fn sample_stops(stops: &[GradientStopInput], t: f32) -> [f32; 4] {
    if stops.is_empty() {
        return [0.5, 0.5, 0.5, 1.0];
    }
    let t = t.clamp(0.0, 1.0);
    let first = &stops[0];
    if t <= first.position {
        let c = parse_color(first.color.as_ref(), [0.5, 0.5, 0.5, 1.0]);
        return [c[0], c[1], c[2], c[3] * first.opacity.unwrap_or(1.0)];
    }
    for pair in stops.windows(2) {
        let a = &pair[0];
        let b = &pair[1];
        if t <= b.position {
            let span = (b.position - a.position).max(0.0001);
            let u = (t - a.position) / span;
            let ca = parse_color(a.color.as_ref(), [0.5, 0.5, 0.5, 1.0]);
            let cb = parse_color(b.color.as_ref(), [0.5, 0.5, 0.5, 1.0]);
            let oa = a.opacity.unwrap_or(1.0);
            let ob = b.opacity.unwrap_or(1.0);
            return [
                lerp(ca[0], cb[0], u),
                lerp(ca[1], cb[1], u),
                lerp(ca[2], cb[2], u),
                lerp(ca[3] * oa, cb[3] * ob, u),
            ];
        }
    }
    let last = stops.last().unwrap();
    let c = parse_color(last.color.as_ref(), [0.5, 0.5, 0.5, 1.0]);
    [c[0], c[1], c[2], c[3] * last.opacity.unwrap_or(1.0)]
}

/// Normalized local coordinate (0–1) → linear gradient factor along handle axis.
pub fn linear_gradient_t(local_x: f32, local_y: f32, gradient: &GradientInput) -> f32 {
    let handles = &gradient.handles;
    if handles.len() < 2 {
        return local_x;
    }
    let h0 = &handles[0];
    let h1 = &handles[1];
    let px = local_x.clamp(0.0, 1.0);
    let py = local_y.clamp(0.0, 1.0);
    let dx = h1.x - h0.x;
    let dy = h1.y - h0.y;
    let len_sq = dx * dx + dy * dy;
    if len_sq <= 0.0001 {
        return px;
    }
    let t = ((px - h0.x) * dx + (py - h0.y) * dy) / len_sq;
    t.clamp(0.0, 1.0)
}

pub fn resolve_fill_rgba(node: &NodeInput, local_x: f32, local_y: f32) -> [f32; 4] {
    if !node.fill_enabled {
        return [0.0, 0.0, 0.0, 0.0];
    }
    let opacity = node.fill_opacity.clamp(0.0, 1.0);
    if node.fill_type.as_deref() == Some("gradient") {
        if let Some(grad) = &node.fill_gradient {
            let stops = sort_stops(&grad.stops);
            let t = match grad.kind.as_str() {
                "linear" => linear_gradient_t(local_x, local_y, grad),
                "radial" => {
                    let cx = grad.handles.first().map(|h| h.x).unwrap_or(0.5);
                    let cy = grad.handles.first().map(|h| h.y).unwrap_or(0.5);
                    let dx = local_x - cx;
                    let dy = local_y - cy;
                    (dx * dx + dy * dy).sqrt().min(1.0)
                }
                "angular" => {
                    let cx = grad.handles.first().map(|h| h.x).unwrap_or(0.5);
                    let cy = grad.handles.first().map(|h| h.y).unwrap_or(0.5);
                    let angle = (local_y - cy).atan2(local_x - cx);
                    (angle / std::f32::consts::TAU + 1.0) % 1.0
                }
                "diamond" => {
                    let dx = (local_x - 0.5).abs();
                    let dy = (local_y - 0.5).abs();
                    (dx + dy).min(1.0)
                }
                _ => {
                    let c = parse_color(node.fill.as_ref(), [0.7, 0.7, 0.7, 1.0]);
                    return [c[0], c[1], c[2], c[3] * opacity];
                }
            };
            let mut c = sample_stops(&stops[..stops.len().min(MAX_STOPS)], t);
            c[3] *= opacity * grad.opacity.unwrap_or(1.0);
            return c;
        }
    }
    let base = match node.kind.as_str() {
        "text" => parse_color(node.text_color.as_ref().or(node.fill.as_ref()), [0.1, 0.1, 0.1, 1.0]),
        "image" => [0.82, 0.84, 0.88, 1.0],
        _ => parse_color(node.fill.as_ref(), [0.85, 0.85, 0.85, 1.0]),
    };
    [base[0], base[1], base[2], base[3] * opacity]
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::document::{GradientHandleInput, NodeInput};

    #[test]
    fn samples_linear_gradient_stops() {
        let grad = GradientInput {
            kind: "linear".into(),
            opacity: Some(1.0),
            handles: vec![
                GradientHandleInput { x: 0.0, y: 0.5 },
                GradientHandleInput { x: 1.0, y: 0.5 },
            ],
            stops: vec![
                GradientStopInput {
                    position: 0.0,
                    color: Some("#000000".into()),
                    opacity: Some(1.0),
                },
                GradientStopInput {
                    position: 1.0,
                    color: Some("#ffffff".into()),
                    opacity: Some(1.0),
                },
            ],
        };
        let dark = sample_stops(&grad.stops, 0.0);
        let light = sample_stops(&grad.stops, 1.0);
        assert!(dark[0] < 0.1);
        assert!(light[0] > 0.9);
    }

    #[test]
    fn angular_and_diamond_gradients_sample() {
        let grad = GradientInput {
            kind: "angular".into(),
            opacity: Some(1.0),
            handles: vec![GradientHandleInput { x: 0.5, y: 0.5 }],
            stops: vec![
                GradientStopInput {
                    position: 0.0,
                    color: Some("#000000".into()),
                    opacity: Some(1.0),
                },
                GradientStopInput {
                    position: 1.0,
                    color: Some("#ffffff".into()),
                    opacity: Some(1.0),
                },
            ],
        };
        let mut node = NodeInput {
            id: "n".into(),
            kind: "rectangle".into(),
            parent_id: None,
            visible: true,
            locked: false,
            x: 0.0,
            y: 0.0,
            width: 100.0,
            height: 100.0,
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
        let c = resolve_fill_rgba(&node, 1.0, 0.5);
        assert!(c[3] > 0.0);

        node.fill_gradient.as_mut().unwrap().kind = "diamond".into();
        let d = resolve_fill_rgba(&node, 0.5, 0.5);
        assert!(d[3] > 0.0);
    }
}
