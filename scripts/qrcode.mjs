async function bufferToImageData(buffer) {
	try {
		const { createCanvas, loadImage } = await import('https://deno.land/x/canvas/mod.ts')
		const image = await loadImage(buffer) // 使用Canvas库加载Buffer
		const canvas = createCanvas(image.width(), image.height())
		const ctx = canvas.getContext('2d')
		ctx.drawImage(image, 0, 0)
		return {
			imageData: ctx.getImageData(0, 0, image.width(), image.height()),
			width: image.width(),
			height: image.height()
		}
	} catch (error) {
		console.error('Failed to load image buffer:', error)
		return null
	}
}

/**
 * 从图像 Buffer 中解码二维码内容
 * @param {Buffer} buffer - 图像的 Buffer 数据
 * @returns {Promise<string[]>} - 返回解码到的所有二维码内容字符串数组
 */
export async function decodeQrCodeFromBuffer(buffer) {
	const decodedContents = []

	// 1. 将 Buffer 转换为 ImageData (需要 canvas 库支持)
	const imageInfo = await bufferToImageData(buffer) // 使用辅助函数

	if (!imageInfo) {
		console.error('Failed to convert buffer to ImageData.')
		return decodedContents // 如果图像加载失败，返回空数组
	}

	const { imageData, width, height } = imageInfo

	try {
		const { grayscale, binarize, Detector, Decoder } = await import('npm:@nuintun/qrcode')
		// 2. 灰度化
		const luminances = grayscale(imageData)
		// 3. 二值化
		const binarized = binarize(luminances, width, height)
		// 4. 初始化探测器和解码器
		const detector = new Detector()
		const decoder = new Decoder()
		// 5. 探测二维码区域 (可能找到多个)
		const detected = detector.detect(binarized)

		let current = detected.next()

		// 6. 遍历所有探测到的区域并尝试解码
		while (!current.done) {
			let succeed = false
			const detect = current.value

			try {
				// 尝试解码当前区域
				const decoded = decoder.decode(detect.matrix)
				if (decoded.content)
					decodedContents.push(decoded.content) // 收集解码成功的内容

				succeed = true // 标记成功，有助于优化探测器后续查找
			} catch (decodeError) {
				// 解码失败，忽略这个区域，继续查找下一个
				// console.debug('QR Code decode failed for one region, skipping...');
			}

			// 继续查找下一个可能的区域，并告知探测器上一个是否成功
			current = detected.next(succeed)
		}
	} catch (error) {
		// 处理灰度化、二值化或探测过程中的错误
		console.error('Error during QR code processing:', error)
	}

	return decodedContents // 返回所有成功解码的内容
}
