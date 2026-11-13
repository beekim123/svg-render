extends Node2D

const COMPOSITE_SHADER: Shader = preload("res://layer_mask.gdshader")

var layers: Dictionary = {}
var tracks: Array = []
var times: Array = []
var kind: String = "循环"
var period: float = 0.0
var duration: float = 0.0
var elapsed: float = 0.0
var playing: bool = true
var asset_size: Vector2 = Vector2.ZERO
var renderer_mode: String = "skia"
var quality_mode: bool = false
var using_runtime: bool = false
var render_stats: Dictionary = {}
var runtime_image: Image
var _directory: String = ""
var _texture_scale: float = 2.0
var _opacity_nodes: Dictionary = {}
var _runtime_renderer: RefCounted
var _runtime_sprite: Sprite2D
var _runtime_texture: ImageTexture

static func _decompose_matrix(m: Array) -> Array:
	var sx: float = sqrt(float(m[0]) * float(m[0]) + float(m[1]) * float(m[1]))
	var sy: float = sqrt(float(m[2]) * float(m[2]) + float(m[3]) * float(m[3]))
	var determinant: float = float(m[0]) * float(m[3]) - float(m[1]) * float(m[2])
	var direction: float = -1.0 if determinant < 0.0 else 1.0
	var rotation: float = atan2(float(m[1]), float(m[0])) if sx > 0.0 else (atan2(-float(m[2]), float(m[3])) if sy > 0.0 else 0.0)
	var skew: float = 0.0
	if sx > 0.0 and sy > 0.0:
		var dot_product: float = float(m[0]) * float(m[2]) + float(m[1]) * float(m[3])
		skew = atan2(-dot_product * direction, determinant * direction)
	return [rotation, sx, sy * direction, skew]

static func interpolate_matrix(a: Array, b: Array, w: float) -> Array:
	if w == 0.0:
		return a.duplicate()
	if w == 1.0:
		return b.duplicate()
	var first: Array = _decompose_matrix(a)
	var second: Array = _decompose_matrix(b)
	var delta_rotation: float = float(second[0]) - float(first[0])
	var delta_skew: float = float(second[3]) - float(first[3])
	var rotation: float = float(first[0]) + atan2(sin(delta_rotation), cos(delta_rotation)) * w
	var skew: float = float(first[3]) + atan2(sin(delta_skew), cos(delta_skew)) * w
	var sx: float = float(first[1]) + (float(second[1]) - float(first[1])) * w
	var sy: float = float(first[2]) + (float(second[2]) - float(first[2])) * w
	return [cos(rotation) * sx, sin(rotation) * sx, -sin(rotation + skew) * sy, cos(rotation + skew) * sy, float(a[4]) + (float(b[4]) - float(a[4])) * w, float(a[5]) + (float(b[5]) - float(a[5])) * w]

func load_bundle(filename: String) -> void:
	load_data(JSON.parse_string(FileAccess.get_file_as_string(filename)), filename.get_base_dir())

func load_data(data: Dictionary, directory: String) -> void:
	for child: Node in get_children():
		child.free()
	layers.clear()
	_opacity_nodes.clear()
	_runtime_renderer = null
	_runtime_sprite = null
	_runtime_texture = null
	render_stats.clear()
	runtime_image = null
	using_runtime = renderer_mode != "png" and data.has("runtimeScene")
	_directory = directory
	_texture_scale = float(data.get("textureScale", 2.0))
	asset_size = Vector2(data.width, data.height)
	tracks = data.tracks
	times = data.times
	kind = data.kind
	period = float(data.period)
	duration = float(data.duration)
	elapsed = 0.0
	for track: Dictionary in tracks:
		if track.property == "opacity":
			_opacity_nodes[int(track.node)] = true
	if using_runtime:
		if not ClassDB.class_exists("SkiaLayerRenderer"):
			push_error("SkiaLayerRenderer 未载入，请先构建 GDExtension")
			get_tree().quit(1)
			return
		_runtime_renderer = ClassDB.instantiate("SkiaLayerRenderer")
		_runtime_renderer.call("load_scene", ProjectSettings.globalize_path(directory.path_join(str(data.runtimeScene))))
		_runtime_sprite = Sprite2D.new()
		_runtime_sprite.centered = false
		_runtime_sprite.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
		add_child(_runtime_sprite)
	else:
		_compose(self, [0, 0, asset_size.x, asset_size.y], [_create_layer(data.root)])
	seek(0.0)

func _texture(filename: String) -> ImageTexture:
	return ImageTexture.create_from_image(Image.load_from_file(_directory.path_join(filename)))

func _matrix(values: Array) -> Transform2D:
	return Transform2D(Vector2(values[0], values[1]), Vector2(values[2], values[3]), Vector2(values[4], values[5]))

func _sprite(texture: Texture2D, rect: Array, raster_scale: float) -> Sprite2D:
	var sprite: Sprite2D = Sprite2D.new()
	sprite.texture = texture
	sprite.centered = false
	sprite.position = Vector2(rect[0], rect[1])
	sprite.scale = Vector2.ONE / raster_scale
	sprite.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
	var material: ShaderMaterial = ShaderMaterial.new()
	material.shader = COMPOSITE_SHADER
	sprite.material = material
	return sprite

func _compose(parent: Node2D, rect: Array, children: Array[Node2D], clip: Dictionary = {}, raster_scale: float = 2.0) -> void:
	var viewport: SubViewport = SubViewport.new()
	viewport.size = Vector2i(roundi(float(rect[2]) * raster_scale), roundi(float(rect[3]) * raster_scale))
	viewport.transparent_bg = true
	viewport.disable_3d = true
	viewport.gui_disable_input = true
	viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	var content: Node2D = Node2D.new()
	content.transform = Transform2D(Vector2(raster_scale, 0), Vector2(0, raster_scale), -Vector2(rect[0], rect[1]) * raster_scale)
	for child: Node2D in children:
		content.add_child(child)
	viewport.add_child(content)
	parent.add_child(viewport)
	var sprite: Sprite2D = _sprite(viewport.get_texture(), rect, raster_scale)
	var material: ShaderMaterial = ShaderMaterial.new()
	material.shader = COMPOSITE_SHADER
	if not clip.is_empty():
		material.set_shader_parameter("clip_texture", _texture(clip.file))
		material.set_shader_parameter("use_clip_texture", true)
		material.set_shader_parameter("content_rect", Vector4(rect[0], rect[1], rect[2], rect[3]))
		var mask_rect: Array = clip.rect
		material.set_shader_parameter("clip_rect", Vector4(mask_rect[0], mask_rect[1], mask_rect[2], mask_rect[3]))
	sprite.material = material
	parent.add_child(sprite)

func _create_layer(record: Dictionary) -> Node2D:
	if record.has("texture"):
		var sprite: Sprite2D = _sprite(_texture(record.texture), record.rect, float(record.get("rasterScale", _texture_scale)))
		(sprite.material as ShaderMaterial).set_shader_parameter("straight_texture", true)
		return sprite
	var node_id: int = int(record.node)
	var layer: Node2D = Node2D.new()
	layer.transform = _matrix(record.matrix)
	layer.modulate.a = float(record.opacity)
	layers[node_id] = layer
	var children: Array[Node2D] = []
	for child: Dictionary in record.children:
		children.append(_create_layer(child))
	var composite: bool = record.has("clips") or float(record.opacity) != 1.0 or _opacity_nodes.has(node_id)
	if composite:
		_compose(layer, record.rect, children, record.get("clips", {}), float(record.get("rasterScale", _texture_scale)))
	else:
		for child: Node2D in children:
			layer.add_child(child)
	return layer

func action_time(milliseconds: float) -> float:
	if kind == "循环" and period > 0.0:
		return fmod(milliseconds, period)
	if kind == "进场后循环" and period > 0.0:
		var intro: float = duration - period
		return milliseconds if milliseconds < intro else intro + fmod(milliseconds - intro, period)
	return minf(milliseconds, duration)

func seek(milliseconds: float) -> void:
	milliseconds = clampf(milliseconds, float(times[0]), float(times[-1]))
	var index: int = 0
	var following: int = times.size() - 1
	while index + 1 < following:
		var middle: int = (index + following) / 2
		if float(times[middle]) <= milliseconds:
			index = middle
		else:
			following = middle
	var weight: float = 0.0 if index == following else (milliseconds - float(times[index])) / (float(times[following]) - float(times[index]))
	var poses: Dictionary = {}
	var opacities: Dictionary = {}
	for track: Dictionary in tracks:
		var node_id: int = int(track.node)
		if track.property == "transform":
			var value: Array = interpolate_matrix(track.values[index], track.values[following], weight)
			if using_runtime:
				poses[node_id] = value
			else:
				layers[node_id].transform = _matrix(value)
		else:
			var value: float = lerpf(float(track.values[index]), float(track.values[following]), weight)
			if using_runtime:
				opacities[node_id] = value
			else:
				layers[node_id].modulate.a = value
	if using_runtime:
		_render_runtime(poses, opacities)

func _render_runtime(poses: Dictionary, opacities: Dictionary) -> void:
	var output_scale: float = minf(2.0, maxf(global_transform.x.length(), global_transform.y.length()))
	var result: Dictionary = _runtime_renderer.call("render", poses, opacities, output_scale, global_transform, quality_mode)
	var image: Image = result.image
	runtime_image = image
	if _runtime_texture == null or _runtime_texture.get_size() != Vector2(image.get_size()):
		_runtime_texture = ImageTexture.create_from_image(image)
		_runtime_sprite.texture = _runtime_texture
	else:
		_runtime_texture.update(image)
	_runtime_sprite.scale = Vector2.ONE / output_scale
	_runtime_sprite.position = result.get("offset", Vector2.ZERO)
	render_stats = result.duplicate()
	render_stats.erase("image")

func _process(delta: float) -> void:
	if playing:
		elapsed += delta * 1000.0
		seek(action_time(elapsed))
