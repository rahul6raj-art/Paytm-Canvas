use std::collections::{HashMap, HashSet};

pub const ATLAS_SIZE: u32 = 4096;
pub const ATLAS_PADDING: u32 = 2;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct AtlasRegion {
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
}

#[derive(Clone, Debug)]
struct PendingImage {
    width: u32,
    height: u32,
    rgba: Vec<u8>,
}

#[derive(Clone, Debug)]
struct Shelf {
    y: u32,
    height: u32,
    cursor_x: u32,
}

enum RebuildMode {
    None,
    Incremental,
    Full,
}

/** CPU shelf atlas — packs many RGBA8 images into one 4096² buffer. */
pub struct ShelfAtlas {
    pending: HashMap<String, PendingImage>,
    regions: HashMap<String, AtlasRegion>,
    shelves: Vec<Shelf>,
    pixels: Vec<u8>,
    rebuild_mode: RebuildMode,
}

impl ShelfAtlas {
    pub fn new() -> Self {
        let len = (ATLAS_SIZE as usize) * (ATLAS_SIZE as usize) * 4;
        Self {
            pending: HashMap::new(),
            regions: HashMap::new(),
            shelves: Vec::new(),
            pixels: vec![0; len],
            rebuild_mode: RebuildMode::None,
        }
    }

    pub fn is_dirty(&self) -> bool {
        !matches!(self.rebuild_mode, RebuildMode::None)
    }

    pub fn registered_ids(&self) -> HashSet<String> {
        self.regions.keys().cloned().collect()
    }

    pub fn contains(&self, asset_id: &str) -> bool {
        self.regions.contains_key(asset_id)
    }

    pub fn region(&self, asset_id: &str) -> Option<AtlasRegion> {
        self.regions.get(asset_id).copied()
    }

    pub fn uv_rect(&self, asset_id: &str) -> Option<[f32; 4]> {
        let r = self.regions.get(asset_id)?;
        let size = ATLAS_SIZE as f32;
        let pad = ATLAS_PADDING as f32;
        let u0 = (r.x as f32 + pad) / size;
        let v0 = (r.y as f32 + pad) / size;
        let u1 = (r.x as f32 + r.width as f32 - pad) / size;
        let v1 = (r.y as f32 + r.height as f32 - pad) / size;
        Some([u0, v0, u1, v1])
    }

    pub fn pixels(&self) -> &[u8] {
        &self.pixels
    }

    pub fn register_rgba8(
        &mut self,
        asset_id: &str,
        width: u32,
        height: u32,
        rgba: &[u8],
    ) -> Result<(), String> {
        if width == 0 || height == 0 {
            return Err("image dimensions must be > 0".into());
        }
        let expected = (width as usize) * (height as usize) * 4;
        if rgba.len() < expected {
            return Err(format!(
                "rgba buffer too small: need {expected}, got {}",
                rgba.len()
            ));
        }
        let slice = rgba[..expected].to_vec();
        if let Some(existing) = self.pending.get(asset_id) {
            if existing.width == width
                && existing.height == height
                && existing.rgba == slice
                && self.regions.contains_key(asset_id)
            {
                return Ok(());
            }
        }

        let had_region = self.regions.contains_key(asset_id);
        self.pending.insert(
            asset_id.to_string(),
            PendingImage {
                width,
                height,
                rgba: slice,
            },
        );

        if had_region {
            self.rebuild_mode = RebuildMode::Full;
        } else {
            self.rebuild_mode = match self.rebuild_mode {
                RebuildMode::Full => RebuildMode::Full,
                _ => RebuildMode::Incremental,
            };
        }
        Ok(())
    }

    pub fn rebuild(&mut self) -> Result<(), String> {
        match self.rebuild_mode {
            RebuildMode::None => Ok(()),
            RebuildMode::Full => self.rebuild_all(),
            RebuildMode::Incremental => self.rebuild_incremental(),
        }
    }

    fn rebuild_all(&mut self) -> Result<(), String> {
        self.regions.clear();
        self.shelves.clear();
        self.pixels.fill(0);
        self.pack_all()?;
        self.rebuild_mode = RebuildMode::None;
        Ok(())
    }

    fn rebuild_incremental(&mut self) -> Result<(), String> {
        let mut sorted: Vec<(String, PendingImage)> = self
            .pending
            .iter()
            .filter(|(id, _)| !self.regions.contains_key(*id))
            .map(|(id, img)| (id.clone(), img.clone()))
            .collect();
        sorted.sort_by(|a, b| a.0.cmp(&b.0));

        for (asset_id, img) in sorted {
            let region = self.pack_one(&img)?;
            blit_rgba(
                &mut self.pixels,
                ATLAS_SIZE,
                region.x,
                region.y,
                region.width,
                region.height,
                &img.rgba,
            );
            self.regions.insert(asset_id, region);
        }

        self.rebuild_mode = RebuildMode::None;
        Ok(())
    }

    fn pack_all(&mut self) -> Result<(), String> {
        let mut sorted: Vec<(String, PendingImage)> = self
            .pending
            .iter()
            .map(|(id, img)| (id.clone(), img.clone()))
            .collect();
        sorted.sort_by(|a, b| a.0.cmp(&b.0));
        for (asset_id, img) in sorted {
            let region = self.pack_one(&img)?;
            blit_rgba(
                &mut self.pixels,
                ATLAS_SIZE,
                region.x,
                region.y,
                region.width,
                region.height,
                &img.rgba,
            );
            self.regions.insert(asset_id, region);
        }
        Ok(())
    }

    fn pack_one(&mut self, img: &PendingImage) -> Result<AtlasRegion, String> {
        let pad = ATLAS_PADDING;
        let alloc_w = img.width + pad * 2;
        let alloc_h = img.height + pad * 2;
        if alloc_w > ATLAS_SIZE || alloc_h > ATLAS_SIZE {
            return Err(format!(
                "image ({alloc_w}x{alloc_h}) exceeds atlas tile limit"
            ));
        }
        let (x, y) = alloc_shelf(&mut self.shelves, alloc_w, alloc_h)?;
        Ok(AtlasRegion {
            x: x + pad,
            y: y + pad,
            width: img.width,
            height: img.height,
        })
    }
}

fn alloc_shelf(shelves: &mut Vec<Shelf>, width: u32, height: u32) -> Result<(u32, u32), String> {
    for shelf in shelves.iter_mut() {
        if shelf.height >= height && shelf.cursor_x + width <= ATLAS_SIZE {
            let x = shelf.cursor_x;
            shelf.cursor_x += width;
            return Ok((x, shelf.y));
        }
    }
    let y = shelves.last().map(|s| s.y + s.height).unwrap_or(0);
    if y + height > ATLAS_SIZE {
        return Err("texture atlas full".into());
    }
    shelves.push(Shelf {
        y,
        height,
        cursor_x: width,
    });
    Ok((0, y))
}

fn blit_rgba(
    dst: &mut [u8],
    atlas_w: u32,
    dst_x: u32,
    dst_y: u32,
    width: u32,
    height: u32,
    src: &[u8],
) {
    let stride = (atlas_w as usize) * 4;
    let len = width as usize * 4;
    for row in 0..height as usize {
        let sy = row * len;
        let dy = ((dst_y as usize + row) * stride) + dst_x as usize * 4;
        if sy + len > src.len() || dy + len > dst.len() {
            continue;
        }
        dst[dy..dy + len].copy_from_slice(&src[sy..sy + len]);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn solid(w: u32, h: u32, r: u8) -> Vec<u8> {
        vec![r, 0, 0, 255].repeat((w * h) as usize)
    }

    #[test]
    fn packs_multiple_images() {
        let mut atlas = ShelfAtlas::new();
        atlas.register_rgba8("a", 64, 32, &solid(64, 32, 255)).unwrap();
        atlas.register_rgba8("b", 48, 48, &solid(48, 48, 128)).unwrap();
        atlas.rebuild().unwrap();
        assert!(atlas.contains("a"));
        assert!(atlas.contains("b"));
        let uv_a = atlas.uv_rect("a").unwrap();
        let uv_b = atlas.uv_rect("b").unwrap();
        assert!(uv_a[0] < uv_a[2]);
        assert!(uv_b[0] < uv_b[2]);
        assert_ne!(uv_a, uv_b);
    }

    #[test]
    fn rebuild_preserves_pixels() {
        let mut atlas = ShelfAtlas::new();
        atlas
            .register_rgba8("px", 2, 2, &solid(2, 2, 200))
            .unwrap();
        atlas.rebuild().unwrap();
        let r = atlas.region("px").unwrap();
        let idx = ((r.y * ATLAS_SIZE + r.x) * 4) as usize;
        assert_eq!(atlas.pixels()[idx], 200);
    }

    #[test]
    fn incremental_append_skips_full_repack() {
        let mut atlas = ShelfAtlas::new();
        atlas.register_rgba8("a", 8, 8, &solid(8, 8, 10)).unwrap();
        atlas.rebuild().unwrap();
        let region_a = atlas.region("a").unwrap();

        atlas.register_rgba8("b", 8, 8, &solid(8, 8, 20)).unwrap();
        atlas.rebuild().unwrap();

        assert_eq!(atlas.region("a"), Some(region_a));
        assert!(atlas.contains("b"));
    }

    #[test]
    fn duplicate_register_is_noop() {
        let mut atlas = ShelfAtlas::new();
        let px = solid(4, 4, 99);
        atlas.register_rgba8("x", 4, 4, &px).unwrap();
        atlas.rebuild().unwrap();
        let region = atlas.region("x").unwrap();
        atlas.register_rgba8("x", 4, 4, &px).unwrap();
        assert!(!atlas.is_dirty());
        assert_eq!(atlas.region("x"), Some(region));
    }
}
