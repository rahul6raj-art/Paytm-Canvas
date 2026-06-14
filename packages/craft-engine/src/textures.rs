use crate::scene::TexturedVertex;
use crate::texture_atlas::{ShelfAtlas, ATLAS_SIZE};
use std::collections::HashSet;
use wgpu::util::DeviceExt;

pub struct TextureAtlas {
    atlas: ShelfAtlas,
    sampler: wgpu::Sampler,
    layout: wgpu::BindGroupLayout,
    texture: Option<wgpu::Texture>,
    bind_group: Option<wgpu::BindGroup>,
}

impl TextureAtlas {
    pub fn new(device: &wgpu::Device) -> Self {
        let sampler = device.create_sampler(&wgpu::SamplerDescriptor {
            label: Some("craft-atlas-sampler"),
            address_mode_u: wgpu::AddressMode::ClampToEdge,
            address_mode_v: wgpu::AddressMode::ClampToEdge,
            mag_filter: wgpu::FilterMode::Linear,
            min_filter: wgpu::FilterMode::Linear,
            ..Default::default()
        });
        let layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("craft-atlas-bind-layout"),
            entries: &[
                wgpu::BindGroupLayoutEntry {
                    binding: 0,
                    visibility: wgpu::ShaderStages::FRAGMENT,
                    ty: wgpu::BindingType::Sampler(wgpu::SamplerBindingType::Filtering),
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 1,
                    visibility: wgpu::ShaderStages::FRAGMENT,
                    ty: wgpu::BindingType::Texture {
                        sample_type: wgpu::TextureSampleType::Float { filterable: true },
                        view_dimension: wgpu::TextureViewDimension::D2,
                        multisampled: false,
                    },
                    count: None,
                },
            ],
        });
        Self {
            atlas: ShelfAtlas::new(),
            sampler,
            layout,
            texture: None,
            bind_group: None,
        }
    }

    pub fn bind_group_layout(&self) -> &wgpu::BindGroupLayout {
        &self.layout
    }

    pub fn image_count(&self) -> usize {
        self.atlas.registered_ids().len()
    }

    pub fn registered_ids(&self) -> HashSet<String> {
        self.atlas.registered_ids()
    }

    pub fn has(&self, asset_id: &str) -> bool {
        self.atlas.contains(asset_id)
    }

    pub fn uv_rect(&self, asset_id: &str) -> Option<[f32; 4]> {
        self.atlas.uv_rect(asset_id)
    }

    pub fn register_rgba8(
        &mut self,
        device: &wgpu::Device,
        queue: &wgpu::Queue,
        asset_id: &str,
        width: u32,
        height: u32,
        rgba: &[u8],
    ) -> Result<(), String> {
        self.atlas.register_rgba8(asset_id, width, height, rgba)?;
        self.upload_atlas(device, queue)?;
        Ok(())
    }

    fn upload_atlas(&mut self, device: &wgpu::Device, queue: &wgpu::Queue) -> Result<(), String> {
        if !self.atlas.is_dirty() {
            return Ok(());
        }
        self.atlas.rebuild()?;
        let texture = device.create_texture(&wgpu::TextureDescriptor {
            label: Some("craft-atlas-texture"),
            size: wgpu::Extent3d {
                width: ATLAS_SIZE,
                height: ATLAS_SIZE,
                depth_or_array_layers: 1,
            },
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format: wgpu::TextureFormat::Rgba8UnormSrgb,
            usage: wgpu::TextureUsages::TEXTURE_BINDING | wgpu::TextureUsages::COPY_DST,
            view_formats: &[],
        });
        queue.write_texture(
            wgpu::TexelCopyTextureInfo {
                texture: &texture,
                mip_level: 0,
                origin: wgpu::Origin3d::ZERO,
                aspect: wgpu::TextureAspect::All,
            },
            self.atlas.pixels(),
            wgpu::TexelCopyBufferLayout {
                offset: 0,
                bytes_per_row: Some(4 * ATLAS_SIZE),
                rows_per_image: Some(ATLAS_SIZE),
            },
            wgpu::Extent3d {
                width: ATLAS_SIZE,
                height: ATLAS_SIZE,
                depth_or_array_layers: 1,
            },
        );
        let view = texture.create_view(&wgpu::TextureViewDescriptor::default());
        let bind_group = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("craft-atlas-bind-group"),
            layout: &self.layout,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: wgpu::BindingResource::Sampler(&self.sampler),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: wgpu::BindingResource::TextureView(&view),
                },
            ],
        });
        self.texture = Some(texture);
        self.bind_group = Some(bind_group);
        Ok(())
    }

    pub fn bind_group(&self) -> Option<&wgpu::BindGroup> {
        self.bind_group.as_ref()
    }
}

pub fn upload_textured_vertices(device: &wgpu::Device, vertices: &[TexturedVertex]) -> wgpu::Buffer {
    device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
        label: Some("textured-vertex-buffer"),
        contents: bytemuck::cast_slice(vertices),
        usage: wgpu::BufferUsages::VERTEX,
    })
}
