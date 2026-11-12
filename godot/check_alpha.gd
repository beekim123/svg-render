extends SceneTree

const CaptureImage = preload("res://capture_image.gd")

func _initialize() -> void:
	var image: Image = Image.create_from_data(3, 1, false, Image.FORMAT_RGBA8, PackedByteArray([128, 64, 32, 128, 20, 40, 60, 255, 0, 0, 0, 0]))
	var straight: Image = CaptureImage.straight_alpha(image)
	assert(straight.get_data() == PackedByteArray([255, 128, 64, 128, 20, 40, 60, 255, 0, 0, 0, 0]))
	print("截图颜色：半透明像素还原 straight alpha，实色与透明像素保持通过")
	quit()
