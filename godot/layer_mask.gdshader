shader_type canvas_item;
render_mode unshaded, blend_premul_alpha;

uniform sampler2D clip_texture : repeat_disable, filter_linear;
uniform vec4 content_rect;
uniform vec4 clip_rect;
uniform bool use_clip_texture = false;
uniform bool straight_texture = false;
varying vec4 modulation;

void vertex() {
	modulation = COLOR;
}

float reconstruction_weight(float distance) {
	float x = abs(distance);
	if (x < 0.00001) {
		return 1.0;
	}
	if (x >= 3.0) {
		return 0.0;
	}
	float angle = 3.141592653589793 * x;
	return sin(angle) * sin(angle / 3.0) / (angle * angle / 3.0);
}

void fragment() {
	ivec2 size = textureSize(TEXTURE, 0);
	vec2 position = UV * vec2(size) - vec2(0.5);
	ivec2 base = ivec2(floor(position));
	vec2 fraction = fract(position);
	vec4 composed = vec4(0.0);
	vec2 center_distance = abs(position - round(position));
	if (max(center_distance.x, center_distance.y) < 0.001) {
		composed = texelFetch(TEXTURE, clamp(ivec2(round(position)), ivec2(0), size - ivec2(1)), 0);
		if (straight_texture) {
			composed.rgb *= composed.a;
		}
	} else if (max(length(dFdx(position)), length(dFdy(position))) > 1.001) {
		if (!straight_texture) {
			composed = texture(TEXTURE, UV);
		} else {
			for (int y = 0; y <= 1; y++) {
				for (int x = 0; x <= 1; x++) {
					ivec2 point = clamp(base + ivec2(x, y), ivec2(0), size - ivec2(1));
					vec4 value = texelFetch(TEXTURE, point, 0);
					value.rgb *= value.a;
					composed += value * (x == 0 ? 1.0 - fraction.x : fraction.x) * (y == 0 ? 1.0 - fraction.y : fraction.y);
				}
			}
		}
	} else {
		float total_weight = 0.0;
		for (int y = -2; y <= 3; y++) {
			for (int x = -2; x <= 3; x++) {
				ivec2 point = clamp(base + ivec2(x, y), ivec2(0), size - ivec2(1));
				vec4 value = texelFetch(TEXTURE, point, 0);
				if (straight_texture) {
					value.rgb *= value.a;
				}
				float weight = reconstruction_weight(float(x) - fraction.x) * reconstruction_weight(float(y) - fraction.y);
				composed += value * weight;
				total_weight += weight;
			}
		}
		composed /= total_weight;
		composed.a = clamp(composed.a, 0.0, 1.0);
		composed.rgb = clamp(composed.rgb, vec3(0.0), vec3(composed.a));
	}
	float coverage = 1.0;
	if (use_clip_texture) {
		vec2 local = content_rect.xy + UV * content_rect.zw;
		vec2 uv = (local - clip_rect.xy) / clip_rect.zw;
		float inside = step(0.0, uv.x) * step(0.0, uv.y) * step(uv.x, 1.0) * step(uv.y, 1.0);
		coverage = texture(clip_texture, uv).a * inside;
	}
	COLOR = vec4(composed.rgb * modulation.rgb, composed.a) * modulation.a * coverage;
}
