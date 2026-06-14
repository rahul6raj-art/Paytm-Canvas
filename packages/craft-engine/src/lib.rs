mod document;
mod effects;
mod gradient;
mod gradient_gpu;
mod hit;
mod image;
mod path;
mod op_log;
mod scene;
mod software;
mod stroke_dash;
mod tessellate;
mod text;
mod text_font;
mod text_layout;
mod text_layout_canonical;
mod text_shaping;
mod undo_stack;
mod texture_atlas;
#[cfg(target_arch = "wasm32")]
mod textures;
mod tile_dirty;
mod tiles;
mod viewport;

#[cfg(target_arch = "wasm32")]
mod gpu;

#[cfg(not(target_arch = "wasm32"))]
pub mod headless;

pub use document::{parse_document, DocumentInput};
pub use hit::hit_test_deepest;
pub use op_log::{apply_document_op, parse_op, DocumentOp};

#[cfg(target_arch = "wasm32")]
use gpu::GpuRenderer;
#[cfg(target_arch = "wasm32")]
use wasm_bindgen::prelude::*;

#[cfg(target_arch = "wasm32")]
use undo_stack::DocumentHistory;

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub struct CraftEngine {
    gpu: GpuRenderer,
    document: Option<DocumentInput>,
    history: DocumentHistory,
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
impl CraftEngine {
    #[wasm_bindgen(js_name = create)]
    pub async fn create(canvas: web_sys::HtmlCanvasElement) -> Result<CraftEngine, JsValue> {
        let gpu = GpuRenderer::new(canvas)
            .await
            .map_err(|e| JsValue::from_str(&e))?;
        Ok(Self {
            gpu,
            document: None,
            history: DocumentHistory::new(),
        })
    }

    #[wasm_bindgen(js_name = backendLabel)]
    pub fn backend_label(&self) -> String {
        self.gpu.backend_label().to_string()
    }

    pub fn resize(&mut self, css_width: u32, css_height: u32, dpr: f32) {
        self.gpu.resize(css_width, css_height, dpr);
    }

    #[wasm_bindgen(js_name = setViewport)]
    pub fn set_viewport(&mut self, pan_x: f32, pan_y: f32, zoom: f32) {
        self.gpu.set_viewport(pan_x, pan_y, zoom);
    }

    #[wasm_bindgen(js_name = loadDocument)]
    pub fn load_document(&mut self, json: &str) -> Result<(), JsValue> {
        let doc = parse_document(json).map_err(|e| JsValue::from_str(&e.to_string()))?;
        if let Some(prev) = self.document.clone() {
            self.history.push_snapshot(prev);
        }
        self.gpu.set_document(doc.clone());
        self.document = Some(doc);
        Ok(())
    }

    /** Replace WASM document without recording undo (TS store is source of truth). */
    #[wasm_bindgen(js_name = syncDocument)]
    pub fn sync_document(&mut self, json: &str) -> Result<(), JsValue> {
        let doc = parse_document(json).map_err(|e| JsValue::from_str(&e.to_string()))?;
        self.gpu.set_document(doc.clone());
        self.document = Some(doc);
        Ok(())
    }

    #[wasm_bindgen(js_name = pushHistorySnapshot)]
    pub fn push_history_snapshot(&mut self) -> Result<(), JsValue> {
        if let Some(prev) = self.document.clone() {
            self.history.push_snapshot(prev);
        }
        Ok(())
    }

    pub fn render(&mut self) -> Result<(), JsValue> {
        self.gpu
            .render()
            .map_err(|e| JsValue::from_str(&e))
    }

    #[wasm_bindgen(js_name = hitTest)]
    pub fn hit_test(&self, world_x: f32, world_y: f32) -> Option<String> {
        self.document
            .as_ref()
            .and_then(|doc| hit_test_deepest(doc, world_x, world_y))
    }

    #[wasm_bindgen(js_name = tileCacheLen)]
    pub fn tile_cache_len(&self) -> usize {
        self.gpu.tile_cache_len()
    }

    #[wasm_bindgen(js_name = atlasImageCount)]
    pub fn atlas_image_count(&self) -> usize {
        self.gpu.atlas_image_count()
    }

    #[wasm_bindgen(js_name = applyDocumentOp)]
    pub fn apply_document_op(&mut self, json: &str) -> Result<(), JsValue> {
        let op = parse_op(json).map_err(|e| JsValue::from_str(&e.to_string()))?;
        let doc = self
            .document
            .as_mut()
            .ok_or_else(|| JsValue::from_str("no document loaded"))?;
        apply_document_op(doc, &op).map_err(|e| JsValue::from_str(&e))?;
        if let Some(current) = self.document.clone() {
            self.gpu.set_document(current);
        }
        Ok(())
    }

    #[wasm_bindgen(js_name = applyDocumentOps)]
    pub fn apply_document_ops(&mut self, json: &str) -> Result<(), JsValue> {
        let ops: Vec<DocumentOp> =
            serde_json::from_str(json).map_err(|e| JsValue::from_str(&e.to_string()))?;
        let doc = self
            .document
            .as_mut()
            .ok_or_else(|| JsValue::from_str("no document loaded"))?;
        for op in &ops {
            apply_document_op(doc, op).map_err(|e| JsValue::from_str(&e))?;
        }
        if let Some(current) = self.document.clone() {
            self.gpu.set_document(current);
        }
        Ok(())
    }

    #[wasm_bindgen(js_name = clearHistory)]
    pub fn clear_history(&mut self) {
        self.history.clear();
    }

    #[wasm_bindgen(js_name = canUndo)]
    pub fn can_undo(&self) -> bool {
        self.history.can_undo()
    }

    #[wasm_bindgen(js_name = canRedo)]
    pub fn can_redo(&self) -> bool {
        self.history.can_redo()
    }

    pub fn undo(&mut self) -> Result<(), JsValue> {
        let current = self
            .document
            .clone()
            .ok_or_else(|| JsValue::from_str("no document loaded"))?;
        let restored = self
            .history
            .undo(&current)
            .ok_or_else(|| JsValue::from_str("nothing to undo"))?;
        self.gpu.set_document(restored.clone());
        self.document = Some(restored);
        Ok(())
    }

    pub fn redo(&mut self) -> Result<(), JsValue> {
        let current = self
            .document
            .clone()
            .ok_or_else(|| JsValue::from_str("no document loaded"))?;
        let restored = self
            .history
            .redo(&current)
            .ok_or_else(|| JsValue::from_str("nothing to redo"))?;
        self.gpu.set_document(restored.clone());
        self.document = Some(restored);
        Ok(())
    }

    #[wasm_bindgen(js_name = snapshotDocument)]
    pub fn snapshot_document(&self) -> Option<String> {
        self.document
            .as_ref()
            .and_then(|doc| serde_json::to_string(doc).ok())
    }

    #[wasm_bindgen(js_name = registerImageAsset)]
    pub fn register_image_asset(
        &mut self,
        asset_id: &str,
        width: u32,
        height: u32,
        rgba: &[u8],
    ) -> Result<(), JsValue> {
        self.gpu
            .register_image_asset(asset_id, width, height, rgba)
            .map_err(|e| JsValue::from_str(&e))
    }

    /** Register a runtime TTF/OTF face for text rendering (from Google Fonts bridge). */
    #[wasm_bindgen(js_name = registerFontFamily)]
    pub fn register_font_family(
        &mut self,
        family_name: &str,
        weight: u32,
        ttf_bytes: &[u8],
    ) -> Result<(), JsValue> {
        self.gpu
            .register_font_family(family_name, weight, ttf_bytes)
            .map_err(|e| JsValue::from_str(&e))
    }

    /** Canonical rustybuzz/fontdue text layout for editor, SVG, caret, and hit-test. */
    #[wasm_bindgen(js_name = layoutTextNode)]
    pub fn layout_text_node(&self, json: &str) -> Result<String, JsValue> {
        self.gpu
            .layout_text_node(json)
            .map_err(|e| JsValue::from_str(&e))
    }
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub fn engine_version() -> String {
    "3.44.0".into()
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(start)]
pub fn init_panic_hook() {
    console_error_panic_hook::set_once();
}
