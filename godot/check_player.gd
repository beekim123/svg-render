extends SceneTree

const PlayerScript = preload("res://layer_player.gd")

func _initialize() -> void:
	var player: Node2D = PlayerScript.new()
	root.add_child(player)
	player.load_data({
		"width": 80, "height": 60,
		"root": {"node": 0, "matrix": [2, 0, 0, 2, 0, 0], "opacity": 1, "children": [
			{"node": 7, "matrix": [1, 0, 0, 1, 0, 0], "opacity": 1, "rect": [-12, 0, 24, 12], "children": []},
			{"node": 8, "matrix": [1, 0, 0, 1, 0, 0], "opacity": 1, "rect": [-12, 0, 24, 12], "children": []}
		]},
		"times": [0, 20, 40], "kind": "循环", "period": 40, "duration": 40,
		"tracks": [
			{"node": 7, "property": "transform", "values": [[1, 0, 0, 1, -10, 4], [1, 0, 0, 1, 10, 8], [1, 0, 0, 1, -10, 4]]},
			{"node": 7, "property": "opacity", "values": [0, 1, 0]},
			{"node": 8, "property": "transform", "values": [[1, 0, 0, 1, 0, 0], [0, 1, -1, 0, 0, 0], [1, 0, 0, 1, 0, 0]]}
		]
	}, "")
	player.seek(10)
	var layer: Node2D = player.layers[7]
	assert(layer.transform.origin.is_equal_approx(Vector2(0, 6)))
	assert(player.layers[0].transform * layer.transform.origin == Vector2(0, 12))
	assert(is_equal_approx(layer.modulate.a, 0.5))
	var rotated: Node2D = player.layers[8]
	assert(rotated.transform.x.is_equal_approx(Vector2(sqrt(0.5), sqrt(0.5))))
	assert(rotated.transform.get_scale().is_equal_approx(Vector2.ONE))
	player.seek(20)
	assert(layer.transform.origin.is_equal_approx(Vector2(10, 8)))
	assert(is_equal_approx(layer.modulate.a, 1.0))
	assert(is_equal_approx(player.action_time(50), 10.0))
	player.kind = "播一次"
	assert(is_equal_approx(player.action_time(50), 40.0))
	player.kind = "进场后循环"
	player.duration = 60.0
	assert(is_equal_approx(player.action_time(70), 30.0))
	assert(is_equal_approx(player.action_time(10), 10.0))
	player.free()
	print("Godot值表播放：20ms插值、嵌套矩阵、组透明度、循环和终帧通过")
	quit()
