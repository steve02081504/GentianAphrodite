import { Buffer } from 'node:buffer'
import fs from 'node:fs/promises'
import path from 'node:path'

import mimetype from 'npm:mime-types'
import wavefile from 'npm:wavefile'

import { chardir, charname } from '../charbase.mjs'
import { checkVoiceSentinel } from '../event_engine/voice_sentinel.mjs'
import { unlockAchievement } from '../scripts/achievements.mjs'

export function setConfigEndpoints(router) {
	router.post(`/api/chars/${charname}/saveAudioFile`, async (req, res) => {
		const { filePath, samples } = req.body
		try {
			const finalPath = path.join(chardir, filePath)
			await fs.mkdir(path.dirname(finalPath), { recursive: true })

			// Convert Float32Array to Int16Array
			const int16Samples = new Int16Array(samples.length)
			for (let i = 0; i < samples.length; i++) {
				const s = Math.max(-1, Math.min(1, samples[i]))
				int16Samples[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
			}

			const wav = new wavefile.WaveFile()
			wav.fromScratch(1, 16000, '16', int16Samples)
			await fs.writeFile(finalPath, wav.toBuffer())

			res.status(200).json({ message: 'File saved successfully' })
			checkVoiceSentinel()
			unlockAchievement('set_reference_voice')
		}
		catch (error) {
			console.error(error)
			res.status(500).json({ message: 'Failed to save file', error: error.message })
		}
	})

	router.post(`/api/chars/${charname}/saveFile`, async (req, res) => {
		const { filePath, content } = req.body
		try {
			const finalPath = path.join(chardir, filePath)

			await fs.mkdir(path.dirname(finalPath), { recursive: true })
			const base64Data = content.split(',')[1]
			const buffer = Buffer.from(base64Data, 'base64')
			await fs.writeFile(finalPath, buffer)

			res.status(200).json({ message: 'File saved successfully' })
			unlockAchievement('set_reference_photo')
		}
		catch (error) {
			console.error(error)
			res.status(500).json({ message: 'Failed to save file', error: error.message })
		}
	})

	router.get(`/api/chars/${charname}/getFile`, async (req, res) => {
		const { filePath } = req.query
		try {
			const finalPath = path.join(chardir, filePath)
			await fs.access(finalPath) // Check if file exists
			const fileContent = await fs.readFile(finalPath)
			const ext = path.extname(finalPath).toLowerCase()
			const mimeType = mimetype.lookup(ext) || 'application/octet-stream'
			res.setHeader('Content-Type', mimeType)
			res.send(fileContent)
		}
		catch (error) {
			if (error.code === 'ENOENT')
				res.status(404).json({ message: 'File not found' })
			else {
				console.error(error)
				res.status(500).json({ message: 'Failed to get file', error: error.message })
			}
		}
	})
}
