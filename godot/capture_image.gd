extends RefCounted

static func straight_alpha(image: Image) -> Image:
	image.convert(Image.FORMAT_RGBA8)
	var data: PackedByteArray = image.get_data()
	for offset: int in range(0, data.size(), 4):
		var alpha: int = data[offset + 3]
		if alpha > 0 and alpha < 255:
			for channel: int in range(3):
				data[offset + channel] = mini(255, roundi(float(data[offset + channel]) * 255.0 / alpha))
	return Image.create_from_data(image.get_width(), image.get_height(), false, Image.FORMAT_RGBA8, data)
