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
var _directory: String = ""
var _texture_scale: float = 2.0
var _opacity_nodes: Dictionary = {}
var _base_transforms: Dictionary = {}

func load_bundle(filename: String) -> void:
	load_data(JSON.parse_string(FileAccess.get_file_as_string(filename)), filename.get_base_dir())

func load_data(data: Dictionary, directory: String) -> void:
	for child: Node in get_children():
		child.free()
	layers.clear()
	_base_transforms.clear()
	_opacity_nodes.clear()
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
	_compose(self, [0, 0, asset_size.x, asset_size.y], [_create_layer(data.root)])
	seek(0.0)

func _texture(filename: String) -> ImageTexture:
	return ImageTexture.create_from_image(Image.load_from_file(_directory.path_join(filename)))

func _matrix(values: Array) -> Transform2D:
	return Transform2D(Vector2(values[0], values[1]), Vector2(values[2], values[3]), Vector2(values[4], values[5]))

func _sprite(texture: Texture2D, rect: Array) -> Sprite2D:
	var sprite: Sprite2D = Sprite2D.new()
	sprite.texture = texture
	sprite.centered = false
	sprite.position = Vector2(rect[0], rect[1])
	sprite.scale = Vector2.ONE / _texture_scale
	sprite.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
	return sprite

func _compose(parent: Node2D, rect: Array, children: Array[Node2D], clip: Dictionary = {}) -> void:
	var viewport: SubViewport = SubViewport.new()
	viewport.size = Vector2i(ceili(float(rect[2]) * _texture_scale), ceili(float(rect[3]) * _texture_scale))
	viewport.transparent_bg = true
	viewport.disable_3d = true
	viewport.gui_disable_input = true
	viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	var content: Node2D = Node2D.new()
	content.transform = Transform2D(Vector2(_texture_scale, 0), Vector2(0, _texture_scale), -Vector2(rect[0], rect[1]) * _texture_scale)
	for child: Node2D in children:
		content.add_child(child)
	viewport.add_child(content)
	parent.add_child(viewport)
	var sprite: Sprite2D = _sprite(viewport.get_texture(), rect)
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
		return _sprite(_texture(record.texture), record.rect)
	var node_id: int = int(record.node)
	var layer: Node2D = Node2D.new()
	layer.transform = _matrix(record.matrix)
	layer.modulate.a = float(record.opacity)
	layers[node_id] = layer
	_base_transforms[node_id] = layer.transform
	var children: Array[Node2D] = []
	for child: Dictionary in record.children:
		children.append(_create_layer(child))
	var composite: bool = record.has("clips") or float(record.opacity) != 1.0 or _opacity_nodes.has(node_id)
	if composite:
		_compose(layer, record.rect, children, record.get("clips", {}))
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
	var last: int = times.size() - 1
	var index: int = mini(int(maxf(milliseconds, 0.0) / 20.0), last)
	var following: int = mini(index + 1, last)
	var weight: float = 0.0 if index == following else (milliseconds - float(times[index])) / (float(times[following]) - float(times[index]))
	for track: Dictionary in tracks:
		var node_id: int = int(track.node)
		var layer: Node2D = layers[node_id]
		if track.property == "transform":
			var first: Transform2D = _matrix(track.values[index])
			var second: Transform2D = _matrix(track.values[following])
			layer.transform = _base_transforms[node_id] * first.interpolate_with(second, weight)
		else:
			layer.modulate.a = lerpf(float(track.values[index]), float(track.values[following]), weight)

func _process(delta: float) -> void:
	if playing:
		elapsed += delta * 1000.0
		seek(action_time(elapsed))
