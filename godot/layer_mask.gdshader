shader_type canvas_item;
render_mode unshaded, blend_premul_alpha;

uniform sampler2D clip_texture : repeat_disable, filter_linear;
uniform vec4 content_rect;
uniform vec4 clip_rect;
uniform bool use_clip_texture = false;
varying vec4 modulation;

void vertex() {
	modulation = COLOR;
}

void fragment() {
	vec4 composed = texture(TEXTURE, UV);
	float coverage = 1.0;
	if (use_clip_texture) {
		vec2 local = content_rect.xy + UV * content_rect.zw;
		vec2 uv = (local - clip_rect.xy) / clip_rect.zw;
		float inside = step(0.0, uv.x) * step(0.0, uv.y) * step(uv.x, 1.0) * step(uv.y, 1.0);
		coverage = texture(clip_texture, uv).a * inside;
	}
	COLOR = vec4(composed.rgb * modulation.rgb, composed.a) * modulation.a * coverage;
}
