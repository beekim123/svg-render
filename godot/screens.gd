extends SceneTree

func _initialize() -> void:
	for index: int in range(DisplayServer.get_screen_count()):
		var origin: Vector2i = DisplayServer.screen_get_position(index)
		var size: Vector2i = DisplayServer.screen_get_size(index)
		print(JSON.stringify({"screen": index, "position": [origin.x, origin.y], "size": [size.x, size.y], "scale": DisplayServer.screen_get_scale(index)}))
	quit()
