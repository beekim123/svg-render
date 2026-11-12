extends SceneTree

func _initialize() -> void:
	call_deferred("_check")

func _check() -> void:
	var demo: Node2D = load("res://main.gd").new()
	root.add_child(demo)
	demo.set_process(false)
	assert(demo._assets.size() == 118)
	var index: int = -1
	for candidate: int in range(demo._assets.size()):
		if demo._assets[candidate].id == "新画法/mon_tree":
			index = candidate
	assert(index >= 0)
	var previous: int = demo._actions[index]
	var click: InputEventMouseButton = InputEventMouseButton.new()
	click.button_index = MOUSE_BUTTON_LEFT
	click.pressed = true
	click.position = Vector2(16, 62) + Vector2(index % 12, index / 12) * Vector2(104, 64) + Vector2(20, 20)
	demo._input(click)
	assert(demo._actions[index] != previous)
	assert(demo._labels[index].text.ends_with(demo._assets[index].actions[demo._actions[index]].name))
	demo.free()
	print("Godot网格：118件装载及点击切换动作通过")
	quit()
