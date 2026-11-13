extends SceneTree

const PlayerScript = preload("res://layer_player.gd")
const IDENTITY: Array = [1, 0, 0, 1, 0, 0]

func _initialize() -> void:
	call_deferred("_check")

func _check() -> void:
	if not ClassDB.class_exists("SkiaLayerRenderer"):
		push_error("SkiaLayerRenderer 未载入")
		quit(1)
		return
	var directory: String = "/private/tmp/svg-render-runtime-player-check"
	DirAccess.make_dir_recursive_absolute(directory)
	var scene: Dictionary = {
		"width": 8, "height": 8,
		"root": {"node": 0, "reference": IDENTITY, "opacity": 1, "clips": [], "children": [
			{"draw": [{"type": "path", "path": "M0 0H4V4H0Z", "bounds": [0, 0, 4, 4], "matrix": IDENTITY, "opacity": 1, "clips": [], "fill": {"type": "color", "color": [1, 0, 0, 1]}}]}
		]}
	}
	var file: FileAccess = FileAccess.open(directory.path_join("runtime.json"), FileAccess.WRITE)
	file.store_string(JSON.stringify(scene))
	file.close()
	var player: Node2D = PlayerScript.new()
	player.playing = false
	player.quality_mode = true
	root.add_child(player)
	player.load_data({
		"width": 8, "height": 8, "runtimeScene": "runtime.json",
		"times": [0, 10], "kind": "播一次", "period": 0, "duration": 10,
		"tracks": [
			{"node": 0, "property": "transform", "values": [IDENTITY, [1, 0, 0, 1, 2, 0]]},
			{"node": 0, "property": "opacity", "values": [1, 0.5]}
		]
	}, directory)
	assert(player.using_runtime)
	assert(player.get_child_count() == 1)
	assert(player.get_child(0) is Sprite2D)
	var sprite: Sprite2D = player.get_child(0)
	var image: Image = player.runtime_image
	assert(image.get_size() == Vector2i(8, 8))
	assert(image.get_pixel(1, 1).r > 0.99)
	assert(image.get_pixel(5, 1).a == 0)
	player.seek(2.5)
	image = player.runtime_image
	assert(player.render_stats.redraws == 1)
	assert(image.get_pixel(0, 1).a > 0 and image.get_pixel(0, 1).a < 0.875)
	player.seek(5)
	image = player.runtime_image
	assert(image.get_pixel(0, 1).a == 0)
	assert(absf(image.get_pixel(2, 1).a - 0.75) < 0.01)
	player.scale = Vector2.ONE * 2
	player.seek(10)
	image = player.runtime_image
	assert(image.get_size() == Vector2i(16, 16))
	assert(sprite.scale == Vector2.ONE / 2)
	assert(image.get_pixel(3, 2).a == 0)
	assert(absf(image.get_pixel(5, 2).a - 0.5) < 0.01)
	player.free()
	DirAccess.remove_absolute(directory.path_join("runtime.json"))
	DirAccess.remove_absolute(directory)
	print("Godot运行时：无PNG装载、值表矩阵/透明度、1倍/2倍纹理通过")
	quit()
