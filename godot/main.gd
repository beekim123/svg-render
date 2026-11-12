extends Node2D

const PlayerScript = preload("res://layer_player.gd")
const CaptureImage = preload("res://capture_image.gd")
const COLUMNS: int = 12
const CELL: Vector2 = Vector2(104, 64)
const GRID_ORIGIN: Vector2 = Vector2(16, 62)

var _options: Dictionary = {}
var _directory: String = ""
var _assets: Array = []
var _players: Array[Node2D] = []
var _labels: Array[Label] = []
var _actions: Array[int] = []
var _status: Label
var _started: int = 0
var _measured_frames: int = 0
var _measured_seconds: float = 0.0
var _label_clock: float = 0.0

func _ready() -> void:
	var args: PackedStringArray = OS.get_cmdline_user_args()
	for index: int in range(0, args.size(), 2):
		_options[args[index].trim_prefix("--")] = args[index + 1]
	_directory = str(_options.get("bundles", ProjectSettings.globalize_path("res://../out/mac/新画法/layers")))
	if DisplayServer.get_name() != "headless":
		_place_window()
	if _options.has("plan"):
		set_process(false)
		_capture_plan(str(_options.plan))
		return
	_assets = JSON.parse_string(FileAccess.get_file_as_string(_directory.path_join("index.json"))).assets
	_create_grid()
	_started = Time.get_ticks_msec()

func _place_window() -> void:
	var screen: int = DisplayServer.window_get_current_screen()
	var size: Vector2i = Vector2i(1280, 720)
	var origin: Vector2i = DisplayServer.screen_get_position(screen)
	var screen_size: Vector2i = DisplayServer.screen_get_size(screen)
	DisplayServer.window_set_current_screen(screen)
	DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_WINDOWED)
	DisplayServer.window_set_size(size)
	DisplayServer.window_set_position(origin + (screen_size - size) / 2)
	DisplayServer.window_set_vsync_mode(DisplayServer.VSYNC_ENABLED)

func _create_grid() -> void:
	var heading: Label = Label.new()
	heading.text = "SVG 分层播放 · 点击素材切换动作"
	heading.position = Vector2(16, 10)
	heading.add_theme_font_size_override("font_size", 20)
	add_child(heading)
	_status = Label.new()
	_status.position = Vector2(16, 36)
	add_child(_status)
	for index: int in range(_assets.size()):
		var asset: Dictionary = _assets[index]
		var origin: Vector2 = GRID_ORIGIN + Vector2(index % COLUMNS, index / COLUMNS) * CELL
		var player: Node2D = PlayerScript.new()
		add_child(player)
		player.position = origin + Vector2(6, 0)
		var action_index: int = 0
		for candidate: int in range(asset.actions.size()):
			if asset.actions[candidate].name == "待机":
				action_index = candidate
		player.load_bundle(_directory.path_join(asset.actions[action_index].bundle))
		player.scale = Vector2.ONE * minf(88.0 / player.asset_size.x, 44.0 / player.asset_size.y)
		_players.append(player)
		_actions.append(action_index)
		var label: Label = Label.new()
		label.position = origin + Vector2(0, 45)
		label.add_theme_font_size_override("font_size", 10)
		label.text = str(asset.name) + " · " + str(asset.actions[action_index].name)
		add_child(label)
		_labels.append(label)

func _input(event: InputEvent) -> void:
	if not event is InputEventMouseButton or not event.pressed or event.button_index != MOUSE_BUTTON_LEFT:
		return
	var cell: Vector2 = (event.position - GRID_ORIGIN) / CELL
	var column: int = int(floorf(cell.x))
	var row: int = int(floorf(cell.y))
	if column < 0 or column >= COLUMNS or row < 0:
		return
	var index: int = row * COLUMNS + column
	if index >= _assets.size():
		return
	var asset: Dictionary = _assets[index]
	_actions[index] = (_actions[index] + 1) % asset.actions.size()
	var action: Dictionary = asset.actions[_actions[index]]
	_players[index].load_bundle(_directory.path_join(action.bundle))
	_labels[index].text = str(asset.name) + " · " + str(action.name)

func _process(delta: float) -> void:
	if _status == null:
		return
	var elapsed: int = Time.get_ticks_msec() - _started
	if elapsed > 2000:
		_measured_frames += 1
		_measured_seconds += delta
	_label_clock += delta
	if _label_clock > 0.5:
		_label_clock = 0.0
		_status.text = "%d 件 · %.1f FPS · Skia 纹理 / 20ms 值表" % [_assets.size(), Engine.get_frames_per_second()]
	var benchmark: int = int(_options.get("benchmark-ms", 0))
	if benchmark > 0 and elapsed >= benchmark + 2000:
		set_process(false)
		var result: Dictionary = {"assets": _assets.size(), "frames": _measured_frames, "seconds": _measured_seconds, "fps": _measured_frames / _measured_seconds}
		var output: String = str(_options.get("benchmark-out", _directory.path_join("fps.json")))
		_write_json(output, result)
		print(JSON.stringify(result))
		if _options.has("preview"):
			await RenderingServer.frame_post_draw
			get_viewport().get_texture().get_image().save_png(str(_options.preview))
		get_tree().quit()

func _capture_plan(filename: String) -> void:
	var plan: Array = JSON.parse_string(FileAccess.get_file_as_string(filename))
	var viewport: SubViewport = SubViewport.new()
	viewport.transparent_bg = true
	viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	add_child(viewport)
	var player: Node2D = PlayerScript.new()
	player.playing = false
	viewport.add_child(player)
	var current: String = ""
	for index: int in range(plan.size()):
		var frame: Dictionary = plan[index]
		if current != frame.bundle:
			current = frame.bundle
			player.load_bundle(_directory.path_join(current))
		var scale: float = float(frame.scale)
		viewport.size = Vector2i(player.asset_size * scale)
		player.scale = Vector2.ONE * scale
		player.seek(float(frame.time))
		await RenderingServer.frame_post_draw
		await RenderingServer.frame_post_draw
		var output: String = str(frame.output)
		DirAccess.make_dir_recursive_absolute(output.get_base_dir())
		var image: Image = CaptureImage.straight_alpha(viewport.get_texture().get_image())
		var error: Error = image.save_png(output)
		if error != OK:
			push_error("截图失败：%s (%s)" % [output, error])
			get_tree().quit(1)
			return
		if (index + 1) % 20 == 0:
			print("Godot截图 %d/%d" % [index + 1, plan.size()])
	print("Godot截图：%d帧" % plan.size())
	get_tree().quit()

func _write_json(filename: String, data: Dictionary) -> void:
	DirAccess.make_dir_recursive_absolute(filename.get_base_dir())
	var file: FileAccess = FileAccess.open(filename, FileAccess.WRITE)
	file.store_string(JSON.stringify(data, "\t") + "\n")
