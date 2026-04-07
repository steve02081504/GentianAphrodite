import { Buffer } from 'node:buffer'
import fs from 'node:fs'
import path from 'node:path'

import mimetype from 'npm:mime-types'
import wavefile from 'npm:wavefile'

import { chardir, charurl } from '../charbase.mjs'
import { checkVoiceSentinel } from '../event_engine/voice_sentinel.mjs'
import { unlockAchievement } from '../scripts/achievements.mjs'

/**
 * 设置配置界面的 API 端点。
 * @param {import('express').Router} router - Express 路由器实例。
 */
export function setConfigEndpoints(router) {
	const apiUrl = `/api${charurl.replace(':', '\\:')}`
	router.post(`${apiUrl}/saveAudioFile`, async (req, res) => {
		const { filePath, samples } = req.body
		const finalPath = path.join(chardir, filePath)
		await fs.promises.mkdir(path.dirname(finalPath), { recursive: true })

		// Convert Float32Array to Int16Array
		const int16Samples = new Int16Array(samples.length)
		for (let i = 0; i < samples.length; i++) {
			const s = Math.max(-1, Math.min(1, samples[i]))
			int16Samples[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
		}

		const wav = new wavefile.WaveFile()
		wav.fromScratch(1, 16000, '16', int16Samples)
		await fs.promises.writeFile(finalPath, wav.toBuffer())

		res.status(200).json({ message: 'File saved successfully' })
		checkVoiceSentinel()
		unlockAchievement('set_reference_voice')
	})

	router.post(`${apiUrl}/saveFile`, async (req, res) => {
		const { filePath, content } = req.body
		const finalPath = path.join(chardir, filePath)

		await fs.promises.mkdir(path.dirname(finalPath), { recursive: true })
		const base64Data = content.split(',')[1]
		const buffer = Buffer.from(base64Data, 'base64')
		await fs.promises.writeFile(finalPath, buffer)

		res.status(200).json({ message: 'File saved successfully' })
		unlockAchievement('set_reference_photo')
	})

	router.get(`${apiUrl}/getFile`, async (req, res) => {
		const { filePath } = req.query
		const finalPath = path.join(chardir, filePath)
		if (!fs.existsSync(finalPath))
			return res.status(404).json({ message: 'File not found' })
		const fileContent = await fs.promises.readFile(finalPath)
		const ext = path.extname(finalPath).toLowerCase()
		const mimeType = mimetype.lookup(ext) || 'application/octet-stream'
		res.setHeader('Content-Type', mimeType)
		res.send(fileContent)
	})
}
