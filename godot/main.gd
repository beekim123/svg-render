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
var _redraw_times: Array[float] = []
var _redraws: int = 0
var _fallbacks: int = 0
var _frames_with_fallbacks: int = 0
var _slow_layers: Dictionary = {}

func _ready() -> void:
	process_priority = 1
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
		player.renderer_mode = str(_options.get("renderer", "skia"))
		var bundle: String = _directory.path_join(asset.actions[action_index].bundle)
		var data: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(bundle))
		player.scale = Vector2.ONE * minf(88.0 / float(data.width), 44.0 / float(data.height))
		player.load_data(data, bundle.get_base_dir())
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
	var redraw_ms: float = 0.0
	var fallbacks: int = 0
	var redraws: int = 0
	for index: int in range(_players.size()):
		var stats: Dictionary = _players[index].render_stats
		redraw_ms += float(stats.get("redraw_ms", 0.0))
		fallbacks += int(stats.get("fallbacks", 0))
		redraws += int(stats.get("redraws", 0))
		if elapsed > 2000:
			_record_slow_layers(stats, str(_assets[index].id))
	if elapsed > 2000:
		_measured_frames += 1
		_measured_seconds += delta
		_redraw_times.append(redraw_ms)
		_redraws += redraws
		_fallbacks += fallbacks
		if fallbacks > 0:
			_frames_with_fallbacks += 1
	_label_clock += delta
	if _label_clock > 0.5:
		_label_clock = 0.0
		_status.text = "%d 件 · %.1f FPS · Skia B2 / 8 ms · 重画 %.2f ms · 本帧退回 %d" % [_assets.size(), Engine.get_frames_per_second(), redraw_ms, fallbacks]
	var benchmark: int = int(_options.get("benchmark-ms", 0))
	if benchmark > 0 and elapsed >= benchmark + 2000:
		set_process(false)
		var result: Dictionary = {
			"assets": _assets.size(), "renderer": str(_options.get("renderer", "skia")),
			"frames": _measured_frames, "seconds": _measured_seconds,
			"fps": _measured_frames / _measured_seconds, "budget_ms": 8.0,
			"redraw_ms": _timing_summary(_redraw_times), "redraws": _redraws,
			"fallbacks": _fallbacks, "frames_with_fallbacks": _frames_with_fallbacks,
			"layers_over_8ms": _slow_layers.values()
		}
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
	player.quality_mode = true
	player.renderer_mode = str(_options.get("renderer", "skia"))
	viewport.add_child(player)
	var current: String = ""
	var data: Dictionary = {}
	var metrics: Array = []
	var redraw_times: Array[float] = []
	for index: int in range(plan.size()):
		var frame: Dictionary = plan[index]
		var changed: bool = current != frame.bundle
		if changed:
			current = frame.bundle
			data = JSON.parse_string(FileAccess.get_file_as_string(_directory.path_join(current)))
		var scale: float = float(frame.scale)
		viewport.size = Vector2i(Vector2(data.width, data.height) * scale)
		player.scale = Vector2.ONE * scale
		if changed:
			player.load_data(data, _directory.path_join(current).get_base_dir())
		player.seek(float(frame.time))
		var stats: Dictionary = player.render_stats.duplicate(true)
		stats["key"] = frame.key
		metrics.append(stats)
		redraw_times.append(float(stats.get("redraw_ms", 0.0)))
		_record_slow_layers(stats, str(frame.bundle))
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
	var metrics_file: String = str(_options.get("metrics-out", filename + ".metrics.json"))
	_write_json(metrics_file, {"quality": true, "frames": metrics.size(), "redraw_ms": _timing_summary(redraw_times), "layers_over_8ms": _slow_layers.values(), "samples": metrics})
	print("Godot截图：%d帧；质量模式重画均值 %.3f ms；%s" % [plan.size(), float(_timing_summary(redraw_times).mean), metrics_file])
	get_tree().quit()

func _record_slow_layers(stats: Dictionary, asset: String) -> void:
	for layer: Dictionary in stats.get("layers", []):
		var milliseconds: float = float(layer.ms)
		if milliseconds <= 8.0:
			continue
		var key: String = "%s/%s" % [asset, layer.node]
		if not _slow_layers.has(key) or milliseconds > float(_slow_layers[key].ms):
			_slow_layers[key] = {"asset": asset, "node": layer.node, "ms": milliseconds}

func _timing_summary(samples: Array[float]) -> Dictionary:
	if samples.is_empty():
		return {"mean": 0.0, "p95": 0.0, "max": 0.0}
	var ordered: Array[float] = samples.duplicate()
	ordered.sort()
	var total: float = 0.0
	for sample: float in samples:
		total += sample
	return {"mean": total / samples.size(), "p95": ordered[ceili(ordered.size() * 0.95) - 1], "max": ordered[-1]}

func _write_json(filename: String, data: Dictionary) -> void:
	DirAccess.make_dir_recursive_absolute(filename.get_base_dir())
	var file: FileAccess = FileAccess.open(filename, FileAccess.WRITE)
	file.store_string(JSON.stringify(data, "\t") + "\n")
