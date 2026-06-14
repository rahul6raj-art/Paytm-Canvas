use crate::document::DocumentInput;
use crate::gradient_gpu::{GradientGpuTable, GradientUniformBlock};
use crate::scene::{
    build_tile_cache, collect_image_draws, collect_visible_tile_vertices,
    rebuild_tile_cache_partial, scene_tile_coords, GpuVertex,
};
use crate::scene::TexturedVertex;
use crate::textures::{upload_textured_vertices, TextureAtlas};
use crate::tile_dirty::tiles_dirty_for_document_change;
use crate::text_font::RuntimeFontRegistry;
use crate::viewport::ViewportState;
use std::collections::{HashMap, HashSet};
use wgpu::util::DeviceExt;

const SHADER: &str = r#"
struct Viewport {
    pan: vec2<f32>,
    zoom: f32,
    dpr: f32,
    size: vec2<f32>,
};

struct GradientStopGpu {
    pos: f32,
    color: vec4<f32>,
    _pad: vec3<f32>,
};

struct GradientEntryGpu {
    kind: u32,
    stop_count: u32,
    opacity: f32,
    _pad0: f32,
    h0: vec2<f32>,
    h1: vec2<f32>,
    stops: array<GradientStopGpu, 4>,
};

struct Gradients {
    entries: array<GradientEntryGpu, 16>,
    count: u32,
    _pad: vec3<u32>,
};

@group(0) @binding(0) var<uniform> viewport: Viewport;
@group(0) @binding(1) var<uniform> gradients: Gradients;

struct VertexInput {
    @location(0) world_pos: vec2<f32>,
    @location(1) local_pos: vec2<f32>,
    @location(2) color: vec4<f32>,
};

struct VertexOutput {
    @builtin(position) clip_pos: vec4<f32>,
    @location(0) local_pos: vec2<f32>,
    @location(1) color: vec4<f32>,
};

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
    var out: VertexOutput;
    let screen = (input.world_pos * viewport.zoom + viewport.pan) * viewport.dpr;
    let ndc = (screen / viewport.size) * 2.0 - vec2<f32>(1.0, 1.0);
    out.clip_pos = vec4<f32>(ndc.x, -ndc.y, 0.0, 1.0);
    out.local_pos = input.local_pos;
    out.color = input.color;
    return out;
}

fn linear_t(local: vec2<f32>, h0: vec2<f32>, h1: vec2<f32>) -> f32 {
    let d = h1 - h0;
    let len2 = dot(d, d);
    if (len2 < 0.0001) { return 0.0; }
    return clamp(dot(local - h0, d) / len2, 0.0, 1.0);
}

fn sample_stops(stops: array<GradientStopGpu, 4>, stop_count: u32, t: f32) -> vec4<f32> {
    if (stop_count == 0u) { return vec4<f32>(0.0); }
    if (stop_count == 1u) { return stops[0].color; }
    var i = 0u;
    loop {
        if (i + 1u >= stop_count) { break; }
        let s0 = stops[i];
        let s1 = stops[i + 1u];
        if (t >= s0.pos && t <= s1.pos) {
            let range = max(s1.pos - s0.pos, 0.0001);
            let mix_t = (t - s0.pos) / range;
            return mix(s0.color, s1.color, mix_t);
        }
        i += 1u;
    }
    return stops[stop_count - 1u].color;
}

fn sample_gradient(entry: GradientEntryGpu, local: vec2<f32>) -> vec4<f32> {
    var t = 0.0;
    if (entry.kind == 0u) {
        t = linear_t(local, entry.h0, entry.h1);
    } else if (entry.kind == 1u) {
        let d = local - entry.h0;
        t = clamp(length(d), 0.0, 1.0);
    } else if (entry.kind == 2u) {
        let a = atan2(local.y - entry.h0.y, local.x - entry.h0.x);
        t = fract(a / 6.2831853 + 1.0);
    } else {
        t = clamp(abs(local.x - 0.5) + abs(local.y - 0.5), 0.0, 1.0);
    }
    var c = sample_stops(entry.stops, entry.stop_count, t);
    c.a *= entry.opacity;
    return c;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
    if (input.color.a < 0.0) {
        let slot = u32(-(input.color.a + 1.0));
        if (slot < gradients.count) {
            return sample_gradient(gradients.entries[slot], input.local_pos);
        }
        return vec4<f32>(1.0, 0.0, 1.0, 1.0);
    }
    return input.color;
}
"#;

const TEXTURED_SHADER: &str = r#"
struct Viewport {
    pan: vec2<f32>,
    zoom: f32,
    dpr: f32,
    size: vec2<f32>,
};

@group(0) @binding(0) var<uniform> viewport: Viewport;
@group(1) @binding(0) var img_sampler: sampler;
@group(1) @binding(1) var img_tex: texture_2d<f32>;

struct VertexInput {
    @location(0) world_pos: vec2<f32>,
    @location(1) uv: vec2<f32>,
};

struct VertexOutput {
    @builtin(position) clip_pos: vec4<f32>,
    @location(0) uv: vec2<f32>,
};

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
    var out: VertexOutput;
    let screen = (input.world_pos * viewport.zoom + viewport.pan) * viewport.dpr;
    let ndc = (screen / viewport.size) * 2.0 - vec2<f32>(1.0, 1.0);
    out.clip_pos = vec4<f32>(ndc.x, -ndc.y, 0.0, 1.0);
    out.uv = input.uv;
    return out;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
    return textureSample(img_tex, img_sampler, input.uv);
}
"#;

#[repr(C)]
#[derive(Clone, Copy, bytemuck::Pod, bytemuck::Zeroable)]
struct ViewportUniform {
    pan: [f32; 2],
    zoom: f32,
    dpr: f32,
    size: [f32; 2],
    _pad: [f32; 2],
}

pub struct GpuRenderer {
    surface: wgpu::Surface<'static>,
    device: wgpu::Device,
    queue: wgpu::Queue,
    config: wgpu::SurfaceConfiguration,
    pipeline: wgpu::RenderPipeline,
    textured_pipeline: wgpu::RenderPipeline,
    viewport_buffer: wgpu::Buffer,
    gradient_buffer: wgpu::Buffer,
    bind_group: wgpu::BindGroup,
    vertex_buffer: wgpu::Buffer,
    vertex_count: u32,
    texture_atlas: TextureAtlas,
    backend_label: String,
    css_width: u32,
    css_height: u32,
    dpr: f32,
    pan: [f32; 2],
    zoom: f32,
    document: Option<DocumentInput>,
    grad_table: GradientGpuTable,
    tile_cache: HashMap<String, Vec<GpuVertex>>,
    tile_cache_valid: bool,
    fonts: RuntimeFontRegistry,
}

impl GpuRenderer {
    pub async fn new(canvas: web_sys::HtmlCanvasElement) -> Result<Self, String> {
        std::panic::set_hook(Box::new(console_error_panic_hook::hook));

        let backends = wgpu::Backends::BROWSER_WEBGPU | wgpu::Backends::GL;
        let instance = wgpu::Instance::new(&wgpu::InstanceDescriptor {
            backends,
            ..Default::default()
        });

        let surface = instance
            .create_surface(wgpu::SurfaceTarget::Canvas(canvas.clone()))
            .map_err(|e| format!("create_surface: {e}"))?;

        let adapter = instance
            .request_adapter(&wgpu::RequestAdapterOptions {
                power_preference: wgpu::PowerPreference::HighPerformance,
                compatible_surface: Some(&surface),
                force_fallback_adapter: false,
            })
            .await
            .ok_or_else(|| "No compatible GPU adapter".to_string())?;

        let backend_label = format!("{:?}", adapter.get_info().backend);

        let (device, queue) = adapter
            .request_device(
                &wgpu::DeviceDescriptor {
                    label: Some("craft-engine-device"),
                    required_features: wgpu::Features::empty(),
                    required_limits: wgpu::Limits::downlevel_webgl2_defaults(),
                    memory_hints: wgpu::MemoryHints::Performance,
                },
                None,
            )
            .await
            .map_err(|e| format!("request_device: {e}"))?;

        let caps = surface.get_capabilities(&adapter);
        let format = caps
            .formats
            .iter()
            .copied()
            .find(|f| f.is_srgb())
            .unwrap_or(caps.formats[0]);

        let css_width = canvas.client_width().max(1) as u32;
        let css_height = canvas.client_height().max(1) as u32;
        let dpr = web_sys::window()
            .map(|w| w.device_pixel_ratio() as f32)
            .unwrap_or(1.0);

        let alpha_mode = caps
            .alpha_modes
            .iter()
            .copied()
            .find(|m| *m != wgpu::CompositeAlphaMode::Opaque)
            .unwrap_or(caps.alpha_modes[0]);

        let config = wgpu::SurfaceConfiguration {
            usage: wgpu::TextureUsages::RENDER_ATTACHMENT,
            format,
            width: (css_width as f32 * dpr).round().max(1.0) as u32,
            height: (css_height as f32 * dpr).round().max(1.0) as u32,
            present_mode: wgpu::PresentMode::AutoVsync,
            alpha_mode,
            view_formats: vec![],
            desired_maximum_frame_latency: 2,
        };
        surface.configure(&device, &config);

        let shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("craft-engine-shader"),
            source: wgpu::ShaderSource::Wgsl(SHADER.into()),
        });

        let viewport_buffer = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("viewport-uniform"),
            size: std::mem::size_of::<ViewportUniform>() as u64,
            usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });

        let gradient_buffer = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("gradient-uniform"),
            size: std::mem::size_of::<GradientUniformBlock>() as u64,
            usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });

        let bind_group_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("viewport-bind-layout"),
            entries: &[
                wgpu::BindGroupLayoutEntry {
                    binding: 0,
                    visibility: wgpu::ShaderStages::VERTEX,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Uniform,
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 1,
                    visibility: wgpu::ShaderStages::FRAGMENT,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Uniform,
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
            ],
        });

        let bind_group = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("viewport-bind-group"),
            layout: &bind_group_layout,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: viewport_buffer.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: gradient_buffer.as_entire_binding(),
                },
            ],
        });

        let pipeline_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: Some("craft-engine-pipeline-layout"),
            bind_group_layouts: &[&bind_group_layout],
            push_constant_ranges: &[],
        });

        let texture_atlas = TextureAtlas::new(&device);
        let textured_bind_layout = texture_atlas.bind_group_layout();
        let textured_pipeline_layout =
            device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
                label: Some("craft-textured-pipeline-layout"),
                bind_group_layouts: &[&bind_group_layout, textured_bind_layout],
                push_constant_ranges: &[],
            });
        let textured_shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("craft-textured-shader"),
            source: wgpu::ShaderSource::Wgsl(TEXTURED_SHADER.into()),
        });
        let textured_pipeline =
            device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
                label: Some("craft-textured-pipeline"),
                layout: Some(&textured_pipeline_layout),
                vertex: wgpu::VertexState {
                    module: &textured_shader,
                    entry_point: Some("vs_main"),
                    buffers: &[wgpu::VertexBufferLayout {
                        array_stride: std::mem::size_of::<TexturedVertex>() as u64,
                        step_mode: wgpu::VertexStepMode::Vertex,
                        attributes: &wgpu::vertex_attr_array![0 => Float32x2, 1 => Float32x2],
                    }],
                    compilation_options: Default::default(),
                },
                fragment: Some(wgpu::FragmentState {
                    module: &textured_shader,
                    entry_point: Some("fs_main"),
                    targets: &[Some(wgpu::ColorTargetState {
                        format: config.format,
                        blend: Some(wgpu::BlendState::ALPHA_BLENDING),
                        write_mask: wgpu::ColorWrites::ALL,
                    })],
                    compilation_options: Default::default(),
                }),
                primitive: wgpu::PrimitiveState {
                    topology: wgpu::PrimitiveTopology::TriangleList,
                    ..Default::default()
                },
                depth_stencil: None,
                multisample: wgpu::MultisampleState::default(),
                multiview: None,
                cache: None,
            });

        let pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label: Some("craft-engine-pipeline"),
            layout: Some(&pipeline_layout),
            vertex: wgpu::VertexState {
                module: &shader,
                entry_point: Some("vs_main"),
                buffers: &[wgpu::VertexBufferLayout {
                    array_stride: std::mem::size_of::<GpuVertex>() as u64,
                    step_mode: wgpu::VertexStepMode::Vertex,
                    attributes: &wgpu::vertex_attr_array![0 => Float32x2, 1 => Float32x2, 2 => Float32x4],
                }],
                compilation_options: Default::default(),
            },
            fragment: Some(wgpu::FragmentState {
                module: &shader,
                entry_point: Some("fs_main"),
                targets: &[Some(wgpu::ColorTargetState {
                    format: config.format,
                    blend: Some(wgpu::BlendState::ALPHA_BLENDING),
                    write_mask: wgpu::ColorWrites::ALL,
                })],
                compilation_options: Default::default(),
            }),
            primitive: wgpu::PrimitiveState {
                topology: wgpu::PrimitiveTopology::TriangleList,
                ..Default::default()
            },
            depth_stencil: None,
            multisample: wgpu::MultisampleState::default(),
            multiview: None,
            cache: None,
        });

        let vertex_buffer = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("vertex-buffer"),
            size: 4,
            usage: wgpu::BufferUsages::VERTEX | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });

        Ok(Self {
            surface,
            device,
            queue,
            config,
            pipeline,
            textured_pipeline,
            viewport_buffer,
            gradient_buffer,
            bind_group,
            vertex_buffer,
            vertex_count: 0,
            texture_atlas,
            backend_label,
            css_width,
            css_height,
            dpr,
            pan: [0.0, 0.0],
            zoom: 1.0,
            document: None,
            grad_table: GradientGpuTable::empty(),
            tile_cache: HashMap::new(),
            tile_cache_valid: false,
            fonts: RuntimeFontRegistry::default(),
        })
    }

    pub fn backend_label(&self) -> &str {
        &self.backend_label
    }

    pub fn tile_cache_len(&self) -> usize {
        self.tile_cache.len()
    }

    pub fn register_image_asset(
        &mut self,
        asset_id: &str,
        width: u32,
        height: u32,
        rgba: &[u8],
    ) -> Result<(), String> {
        self.texture_atlas.register_rgba8(
            &self.device,
            &self.queue,
            asset_id,
            width,
            height,
            rgba,
        )?;
        self.tile_cache_valid = false;
        Ok(())
    }

    pub fn atlas_image_count(&self) -> usize {
        self.texture_atlas.image_count()
    }

    #[cfg(target_arch = "wasm32")]
    pub fn register_font_family(
        &mut self,
        family_name: &str,
        weight: u32,
        bytes: &[u8],
    ) -> Result<(), String> {
        self.fonts
            .register_family(family_name, weight, bytes)?;
        self.tile_cache_valid = false;
        Ok(())
    }

    pub fn layout_text_node(&self, json: &str) -> Result<String, String> {
        crate::text_layout_canonical::layout_text_canonical_json(json, &self.fonts)
    }

    fn textured_asset_ids(&self) -> HashSet<String> {
        self.texture_atlas.registered_ids()
    }

    pub fn resize(&mut self, css_width: u32, css_height: u32, dpr: f32) {
        if css_width == 0 || css_height == 0 {
            return;
        }
        self.css_width = css_width.max(1);
        self.css_height = css_height.max(1);
        self.dpr = dpr.max(0.5);
        self.config.width = (self.css_width as f32 * self.dpr).round().max(1.0) as u32;
        self.config.height = (self.css_height as f32 * self.dpr).round().max(1.0) as u32;
        self.surface.configure(&self.device, &self.config);
    }

    pub fn set_viewport(&mut self, pan_x: f32, pan_y: f32, zoom: f32) {
        self.pan = [pan_x, pan_y];
        self.zoom = zoom.max(0.01);
    }

    pub fn set_document(&mut self, doc: DocumentInput) {
        let prev = self.document.clone();
        self.grad_table = GradientGpuTable::from_document(&doc);
        match prev.as_ref() {
            None => {
                self.document = Some(doc);
                self.tile_cache_valid = false;
            }
            Some(_prev_doc) if !self.tile_cache_valid => {
                self.document = Some(doc);
                self.tile_cache_valid = false;
            }
            Some(prev_doc) => {
                let dirty = tiles_dirty_for_document_change(Some(prev_doc), &doc);
                self.document = Some(doc);
                if dirty.is_empty() {
                    return;
                }
                let total = scene_tile_coords(self.document.as_ref().unwrap()).len().max(1);
                if dirty.len() >= total {
                    self.tile_cache_valid = false;
                } else {
                    self.ensure_tile_cache();
                    if let Some(current) = self.document.as_ref() {
                        let textured = self.textured_asset_ids();
                        rebuild_tile_cache_partial(
                            &mut self.tile_cache,
                            current,
                            &dirty,
                            &textured,
                            &self.grad_table,
                            &self.fonts,
                        );
                    }
                }
            }
        }
    }

    fn viewport_state(&self) -> ViewportState {
        ViewportState {
            pan_x: self.pan[0],
            pan_y: self.pan[1],
            zoom: self.zoom,
            css_width: self.css_width as f32,
            css_height: self.css_height as f32,
        }
    }

    fn ensure_tile_cache(&mut self) {
        if self.tile_cache_valid {
            return;
        }
        let Some(doc) = self.document.as_ref() else {
            self.tile_cache.clear();
            self.tile_cache_valid = true;
            return;
        };
        self.tile_cache =
            build_tile_cache(doc, &self.textured_asset_ids(), &self.grad_table, &self.fonts);
        self.tile_cache_valid = true;
    }

    fn upload_vertices(&mut self, vertices: &[GpuVertex]) {
        self.vertex_count = vertices.len() as u32;
        if vertices.is_empty() {
            return;
        }
        let bytes = bytemuck::cast_slice(vertices);
        self.vertex_buffer = self.device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("vertex-buffer"),
            contents: bytes,
            usage: wgpu::BufferUsages::VERTEX,
        });
    }

    fn prepare_draw_buffer(&mut self) {
        self.ensure_tile_cache();
        let vertices = collect_visible_tile_vertices(&self.tile_cache, self.viewport_state());
        self.upload_vertices(&vertices);
    }

    pub fn render(&mut self) -> Result<(), String> {
        self.prepare_draw_buffer();
        let viewport = ViewportUniform {
            pan: self.pan,
            zoom: self.zoom,
            dpr: self.dpr,
            size: [
                self.css_width as f32 * self.dpr,
                self.css_height as f32 * self.dpr,
            ],
            _pad: [0.0, 0.0],
        };
        self.queue.write_buffer(
            &self.viewport_buffer,
            0,
            bytemuck::bytes_of(&viewport),
        );
        self.queue.write_buffer(
            &self.gradient_buffer,
            0,
            bytemuck::bytes_of(self.grad_table.uniform_block()),
        );

        let frame = self
            .surface
            .get_current_texture()
            .map_err(|e| format!("get_current_texture: {e}"))?;
        let view = frame
            .texture
            .create_view(&wgpu::TextureViewDescriptor::default());

        let image_vertices = self
            .document
            .as_ref()
            .map(|doc| {
                collect_image_draws(doc, self.viewport_state(), &|asset_id| {
                    self.texture_atlas.uv_rect(asset_id)
                })
            })
            .unwrap_or_default();

        let mut encoder = self
            .device
            .create_command_encoder(&wgpu::CommandEncoderDescriptor {
                label: Some("craft-engine-encoder"),
            });

        {
            let mut pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: Some("craft-engine-pass"),
                color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                    view: &view,
                    resolve_target: None,
                    ops: wgpu::Operations {
                        load: wgpu::LoadOp::Clear(wgpu::Color {
                            r: 0.0,
                            g: 0.0,
                            b: 0.0,
                            a: 0.0,
                        }),
                        store: wgpu::StoreOp::Store,
                    },
                })],
                depth_stencil_attachment: None,
                occlusion_query_set: None,
                timestamp_writes: None,
            });
            if self.vertex_count > 0 {
                pass.set_pipeline(&self.pipeline);
                pass.set_bind_group(0, &self.bind_group, &[]);
                pass.set_vertex_buffer(0, self.vertex_buffer.slice(..));
                pass.draw(0..self.vertex_count, 0..1);
            }

            if !image_vertices.is_empty() {
                if let Some(atlas_bind) = self.texture_atlas.bind_group() {
                    let buffer = upload_textured_vertices(&self.device, &image_vertices);
                    pass.set_pipeline(&self.textured_pipeline);
                    pass.set_bind_group(0, &self.bind_group, &[]);
                    pass.set_bind_group(1, atlas_bind, &[]);
                    pass.set_vertex_buffer(0, buffer.slice(..));
                    pass.draw(0..image_vertices.len() as u32, 0..1);
                }
            }
        }

        self.queue.submit(std::iter::once(encoder.finish()));
        frame.present();
        Ok(())
    }
}
