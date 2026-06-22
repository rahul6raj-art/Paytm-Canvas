#[derive(Clone, Copy, Debug, Default)]
pub struct WorldRect {
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
}

impl WorldRect {
    pub fn right(&self) -> f32 {
        self.x + self.width
    }

    pub fn bottom(&self) -> f32 {
        self.y + self.height
    }

    pub fn intersect(&self, other: &WorldRect) -> Option<WorldRect> {
        let x = self.x.max(other.x);
        let y = self.y.max(other.y);
        let right = self.right().min(other.right());
        let bottom = self.bottom().min(other.bottom());
        if right <= x || bottom <= y {
            return None;
        }
        Some(WorldRect {
            x,
            y,
            width: right - x,
            height: bottom - y,
        })
    }

    pub fn intersects(&self, other: &WorldRect) -> bool {
        self.x < other.right()
            && self.right() > other.x
            && self.y < other.bottom()
            && self.bottom() > other.y
    }
}

#[derive(Clone, Copy, Debug)]
pub struct ViewportState {
    pub pan_x: f32,
    pub pan_y: f32,
    pub zoom: f32,
    pub css_width: f32,
    pub css_height: f32,
}

impl Default for ViewportState {
    fn default() -> Self {
        Self {
            pan_x: 0.0,
            pan_y: 0.0,
            zoom: 1.0,
            css_width: 1200.0,
            css_height: 800.0,
        }
    }
}

pub fn world_viewport_rect(vp: ViewportState) -> WorldRect {
    let zoom = vp.zoom.max(0.01);
    WorldRect {
        x: (-vp.pan_x) / zoom,
        y: (-vp.pan_y) / zoom,
        width: vp.css_width / zoom,
        height: vp.css_height / zoom,
    }
}

pub fn expand_rect(rect: WorldRect, margin: f32) -> WorldRect {
    WorldRect {
        x: rect.x - margin,
        y: rect.y - margin,
        width: rect.width + margin * 2.0,
        height: rect.height + margin * 2.0,
    }
}
