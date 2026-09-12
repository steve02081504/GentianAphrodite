import process from 'node:process'

/**
 * 捕获主屏幕的截图。
 * @returns {Promise<Buffer>} - PNG 格式的屏幕截图 Buffer。
 */
export async function captureScreen() {
	if (process.platform === 'linux' && !process.env.DISPLAY)
		throw new Error('Cannot capture screen: No DISPLAY environment variable.')
	const { Monitor } = await import('npm:node-screenshots')
	const monitors = Monitor.all()
	const mainMonitor = monitors[0]
	const image = await mainMonitor.captureImage()

	return await image.toPng()
}
