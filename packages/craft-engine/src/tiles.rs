use crate::viewport::WorldRect;
use std::collections::{HashMap, HashSet};

/** Matches `src/lib/canvasTiles/tileGrid.ts` */
pub const TILE_WORLD_SIZE: f32 = 512.0;

/** Extra tile ring around viewport (matches WebGL prefetch). */
pub const TILE_PREFETCH_RING: i32 = 1;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub struct TileCoord {
    pub tx: i32,
    pub ty: i32,
}

pub fn tile_key(tx: i32, ty: i32) -> String {
    format!("{tx},{ty}")
}

pub fn parse_tile_key(key: &str) -> TileCoord {
    let mut parts = key.split(',');
    let tx = parts.next().and_then(|s| s.parse().ok()).unwrap_or(0);
    let ty = parts.next().and_then(|s| s.parse().ok()).unwrap_or(0);
    TileCoord { tx, ty }
}

pub fn tile_world_rect(tx: i32, ty: i32) -> WorldRect {
    WorldRect {
        x: tx as f32 * TILE_WORLD_SIZE,
        y: ty as f32 * TILE_WORLD_SIZE,
        width: TILE_WORLD_SIZE,
        height: TILE_WORLD_SIZE,
    }
}

pub fn tiles_for_world_point(x: f32, y: f32) -> TileCoord {
    TileCoord {
        tx: (x / TILE_WORLD_SIZE).floor() as i32,
        ty: (y / TILE_WORLD_SIZE).floor() as i32,
    }
}

pub fn tiles_intersecting_rect(rect: &WorldRect) -> Vec<TileCoord> {
    let tx0 = (rect.x / TILE_WORLD_SIZE).floor() as i32;
    let ty0 = (rect.y / TILE_WORLD_SIZE).floor() as i32;
    let tx1 = ((rect.x + rect.width) / TILE_WORLD_SIZE).floor() as i32;
    let ty1 = ((rect.y + rect.height) / TILE_WORLD_SIZE).floor() as i32;
    let mut out = Vec::new();
    for tx in tx0..=tx1 {
        for ty in ty0..=ty1 {
            out.push(TileCoord { tx, ty });
        }
    }
    out
}

pub fn expand_tile_ring(coords: &[TileCoord], ring: i32) -> Vec<TileCoord> {
    if ring <= 0 {
        return coords.to_vec();
    }
    let mut set: HashSet<TileCoord> = HashSet::new();
    for c in coords {
        for dx in -ring..=ring {
            for dy in -ring..=ring {
                set.insert(TileCoord {
                    tx: c.tx + dx,
                    ty: c.ty + dy,
                });
            }
        }
    }
    let mut out: Vec<_> = set.into_iter().collect();
    out.sort_by(|a, b| (a.tx, a.ty).cmp(&(b.tx, b.ty)));
    out
}

pub fn merge_tile_vertices(
    cache: &HashMap<String, Vec<crate::scene::GpuVertex>>,
    coords: &[TileCoord],
) -> Vec<crate::scene::GpuVertex> {
    let mut out = Vec::new();
    for coord in coords {
        let key = tile_key(coord.tx, coord.ty);
        if let Some(verts) = cache.get(&key) {
            out.extend_from_slice(verts);
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tiles_intersecting_rect_covers_bounds() {
        let rect = WorldRect {
            x: 100.0,
            y: 600.0,
            width: 500.0,
            height: 500.0,
        };
        let tiles = tiles_intersecting_rect(&rect);
        assert!(tiles.iter().any(|t| t.tx == 0 && t.ty == 1));
        assert!(tiles.iter().any(|t| t.tx == 1 && t.ty == 1));
    }

    #[test]
    fn expand_ring_adds_neighbors() {
        let base = vec![TileCoord { tx: 2, ty: 3 }];
        let expanded = expand_tile_ring(&base, 1);
        assert!(expanded.len() >= 9);
        assert!(expanded.contains(&TileCoord { tx: 3, ty: 3 }));
    }
}
