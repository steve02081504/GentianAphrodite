/**
 * @fileoverview
 * 一个基于 PvRecorder 的智能语音哨兵模块。
 * 当侦测到声音时，会将其录制下来。如果声音与主人音色匹配，则会触发AI进行回应。
 */

import { Buffer } from 'node:buffer'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { PvRecorder } from 'npm:@picovoice/pvrecorder-node'
import Meyda from 'npm:meyda'
import wavefile from 'npm:wavefile'
import 'npm:@steve02081504/virtual-console'

import { chardir, charname } from '../charbase.mjs'
import { config as charConfig } from '../config/index.mjs'
import { GetReply } from '../reply_gener/index.mjs'

import { initRealityChannel, RealityChannel } from './index.mjs'

// --- 配置中心 (Configuration) ---
const CONFIG = {
	// --- 阈值与触发器 (Thresholds & Triggers) ---
	thresholds: {
		QUIET_STD_MULTIPLIER: 1.0,  // 安静阈值 = 平均RMS + (标准差 * N)。
		LOUD_STD_MULTIPLIER: 3.5,   // 响亮阈值 = 平均RMS + (标准差 * N)。
		MIN_QUIET_THRESHOLD: 50,    // 动态计算后的最低安静阈值，防止在极静环境下过于敏感。
		MIN_LOUD_THRESHOLD: 100,    // 动态计算后的最低响亮阈值。
	},
	triggers: {
		CONSECUTIVE_LOUD_FRAMES: 4, // 触发录音所需的【连续】响亮帧数。
		PRE_BUFFER_FRAME_COUNT: 15, // 预缓冲的帧数。
		SILENCE_TAIL_FRAME_COUNT: 3, // 录音末尾保留的静音帧数。
		LOUD_ACTIVITY_THRESHOLD: 0.4, // 当近期响亮帧比例超过此值时，转为静默监测。
	},
	// --- 时间与持续性 (Timing & Duration) ---
	timing: {
		INITIALIZATION_MS: 10 * 1000,    // 环境噪音分析时长。
		QUIET_PERIOD_FOR_ARMING_MS: 2.5 * 1000, // 从“监控中”切换到“武装”所需的静音时长。
		SILENCE_TIMEOUT_MS: 1.5 * 1000,      // 录音期间，结束录音的静音超时。
		MAX_RECORDING_MS: 3 * 60 * 1000,    // 单次录音最大时长。
		MIN_RECORDING_MS: 2 * 1000,         // 修剪后，录音的最小时长。
		IN_RECORDING_VALIDATION_INTERVAL_MS: 1000, // 录音中途验证间隔。
		LOUD_ACTIVITY_WINDOW_MS: 90 * 1000, // 用于计算响亮帧比例的时间窗口。
	},
	// --- 文件与格式 (File & Format) ---
	files: {
		REFERENCE_WAV: join(chardir, 'vars/master-voice-reference.wav'),
	},
	audio: {
		FRAME_LENGTH: 512,
		SAMPLE_RATE: 16000,
		CHANNELS: 1,
	},
	// --- 音色匹配 (Voice Matching) ---
	voiceMatch: {
		MFCC_SIMILARITY_THRESHOLD: 0.7,   // 0.7 较宽松，0.8-0.85 更严格。
		MATCHING_RATIO_THRESHOLD: 0.72,   // 录音中，有声帧匹配音色的最低比例。
		REFERENCE_RMS_MULTIPLIER: 0.5,    // 提取参考音色时，使用 (安静阈值 * N) 作为有效声音门槛。
	},
	// --- 显示配置 (Display) ---
	display: {
		CLI_BAR_MAX_LENGTH: 50,
		CLI_BAR_RMS_SCALING_FACTOR: 30,
	},
}

// --- 状态管理中心 (State Management) ---

function createInitialRecordingStats() {
	return {
		totalRms: 0, frameCount: 0, totalLoudFrames: 0, matchingLoudFrames: 0,
		longestInternalSilenceFrames: 0, // 记录到目前为止的最长连续静音帧数
		currentSilenceStreakFrames: 0,   // 当前正在持续的连续静音帧数
	}
}

function createInitialState() {
	return {
		state: 'INITIALIZING', // INITIALIZING, MONITORING_QUIET, ARMED, RECORDING
		recorder: null,
		referenceMfccs: null,
		referenceFileMtime: null,
		dynamicThresholds: {
			quiet: CONFIG.thresholds.MIN_QUIET_THRESHOLD,
			loud: CONFIG.thresholds.MIN_LOUD_THRESHOLD,
		},
		initRmsList: [],
		quietStartTime: null,
		lastLoudTime: null,
		armingBuffer: [],
		recordingBuffer: [],
		recordingStartTime: null,
		consecutiveLoudFrames: 0,
		lastValidationCheckTime: 0,
		activityLog: [],
		currentRecordingStats: createInitialRecordingStats(),
		recorderRetryCount: 0,
		avgEnvRms: 0,
	}
}

let sentinelState = createInitialState()

// --- 工具函数 (Utility Functions) ---

const calculateRMS = int16Array => Math.sqrt(int16Array.reduce((sum, val) => sum + val * val, 0) / int16Array.length)
const int16ToFloat32 = int16Array => Float32Array.from(int16Array, v => v / 32768)
const calculateMean = data => data.reduce((sum, value) => sum + value, 0) / data.length
const calculateStdDev = (data, mean) => Math.sqrt(calculateMean(data.map(value => (value - mean) ** 2)))

function cosineSimilarity(vecA, vecB) {
	let dotProduct = 0, normA = 0, normB = 0
	// 从 i = 1 开始，忽略第一个主要反映音量大小的MFCC系数(C0)，专注于音色本身的比较
	const len = Math.min(vecA.length, vecB.length)
	for (let i = 1; i < len; i++) {
		dotProduct += vecA[i] * vecB[i]
		normA += vecA[i] ** 2
		normB += vecB[i] ** 2
	}
	return normA === 0 || normB === 0 ? 0 : dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

/**
 * 检查当前帧是否符合参考音色。
 * @param {Int16Array} frame - 当前帧的 Int16 数据
 * @returns {boolean} - 是否符合音色
 */
function isFrameMatchingVoice(frame) {
	if (!sentinelState.referenceMfccs || sentinelState.referenceMfccs.length === 0) return false
	const frameFloat = int16ToFloat32(frame)
	const mfcc = Meyda.extract('mfcc', frameFloat)
	if (!mfcc) return false

	let maxSimilarity = 0
	for (const refMfcc of sentinelState.referenceMfccs)
		maxSimilarity = Math.max(maxSimilarity, cosineSimilarity(mfcc, refMfcc))

	return maxSimilarity > CONFIG.voiceMatch.MFCC_SIMILARITY_THRESHOLD
}

// --- 文件与后期处理 ---

function loadReferenceMfcc() {
	const refPath = CONFIG.files.REFERENCE_WAV
	if (!existsSync(refPath)) {
		console.error(`❌ Reference audio file does not exist: ${refPath}.`)
		sentinelState.referenceFileMtime = null
		return null
	}
	try {
		const refWav = new wavefile.WaveFile(readFileSync(refPath))

		// --- 验证音频格式 ---
		if (refWav.fmt.sampleRate !== CONFIG.audio.SAMPLE_RATE) {
			console.error(`❌ Reference audio sample rate mismatch. Requires ${CONFIG.audio.SAMPLE_RATE} Hz, but file is ${refWav.fmt.sampleRate} Hz.`)
			return null
		}
		if (refWav.fmt.numChannels !== CONFIG.audio.CHANNELS) {
			console.error(`❌ Reference audio channel count mismatch. Requires ${CONFIG.audio.CHANNELS} (mono), but file is ${refWav.fmt.numChannels} channels.`)
			return null
		}

		let refSamples
		const allSamples = refWav.getSamples(false, Int16Array)

		if (refWav.fmt.numChannels > 1)
			// 立体声文件，按原逻辑取第一个声道
			refSamples = allSamples[0]
		else
			// 单声道文件，返回的就是样本数组本身
			refSamples = allSamples

		const mfccs = []

		// --- 自适应阈值计算 ---
		// 1. 计算参考音频每一帧的 RMS
		const frames = []
		for (let i = 0; i + CONFIG.audio.FRAME_LENGTH <= refSamples.length; i += CONFIG.audio.FRAME_LENGTH) {
			const buffer = refSamples.subarray(i, i + CONFIG.audio.FRAME_LENGTH)
			frames.push({ buffer, rms: calculateRMS(buffer) })
		}

		if (frames.length === 0) {
			console.error('❌ Reference audio file contains no valid audio frames (file might be too short).')
			return null
		}

		// 2. 基于 RMS 分布计算一个动态阈值，以区分语音和静音
		const frameRmsValues = frames.map(f => f.rms)
		const avgRefRms = calculateMean(frameRmsValues)
		const stdDevRefRms = calculateStdDev(frameRmsValues, avgRefRms)
		// 将高于 (平均值 + 0.5 * 标准差) 的帧视为有效语音
		const referenceRmsThreshold = avgRefRms + stdDevRefRms * 0.5

		// 3. 使用自适应阈值提取 MFCC
		for (const frame of frames)
			if (frame.rms > referenceRmsThreshold) {
				const mfcc = Meyda.extract('mfcc', int16ToFloat32(frame.buffer))
				if (mfcc) mfccs.push(mfcc)
			}

		if (mfccs.length === 0) {
			console.error('❌ Failed to extract MFCC from reference audio. Please check file content and volume (file might be too quiet or only contains noise).')
			return null
		}
		console.log(`📊 Reference voice MFCC feature set loaded (${mfccs.length} feature vectors).`)
		const { mtime } = statSync(refPath)
		sentinelState.referenceFileMtime = mtime
		return mfccs
	} catch (err) {
		console.error(`❌ Failed to load reference audio: ${err.message}`)
		return null
	}
}

async function finishRecordingSession(now) {
	console.log('🏁 Recording session ended, performing final validation...')
	const { currentRecordingStats, referenceMfccs, recordingBuffer } = sentinelState

	// --- 简化裁剪逻辑 ---
	// 动态超时已在 handleRecordingState 中处理，这里只需进行最后的裁剪。
	// 我们找到最后一个有效声音帧，并在其后保留一小段固定的静音作为缓冲。
	const lastLoudFrameIndex = recordingBuffer.findLastIndex(f => f.rms > sentinelState.dynamicThresholds.quiet)
	const silenceTailFrameCount = CONFIG.triggers.SILENCE_TAIL_FRAME_COUNT // 使用配置中定义的固定尾巴

	console.log(`✂️  Trimming recording, keeping ${silenceTailFrameCount} frames as silence tail.`)

	const trimmedFramesRaw = lastLoudFrameIndex === -1 ? [] : recordingBuffer.slice(0, Math.min(
		lastLoudFrameIndex + 1 + silenceTailFrameCount,
		recordingBuffer.length,
	))

	const trimmedDurationMs = (trimmedFramesRaw.length * CONFIG.audio.FRAME_LENGTH / CONFIG.audio.SAMPLE_RATE) * 1000
	if (trimmedDurationMs < CONFIG.timing.MIN_RECORDING_MS) {
		console.log(`🗑️  Final validation failed: trimmed duration (${trimmedDurationMs.toFixed(0)}ms) too short.`)
		transitionToState('ARMED', now)
		return
	}

	const matchingRatio = currentRecordingStats.totalLoudFrames > 0
		? currentRecordingStats.matchingLoudFrames / currentRecordingStats.totalLoudFrames : 0
	const isMatch = referenceMfccs && matchingRatio >= CONFIG.voiceMatch.MATCHING_RATIO_THRESHOLD

	console.log(`ℹ️  Recording validation complete. Voice match ratio: ${matchingRatio.toFixed(2)}.`)

	// --- 将录音添加到现实频道 ---
	const trimmedFrames = trimmedFramesRaw.map(f => f.buffer)
	const totalLength = trimmedFrames.reduce((sum, arr) => sum + arr.length, 0)
	const totalSamples = new Int16Array(totalLength)
	let offset = 0
	for (const int16Array of trimmedFrames) {
		totalSamples.set(int16Array, offset)
		offset += int16Array.length
	}

	const wav = new wavefile.WaveFile()
	wav.fromScratch(CONFIG.audio.CHANNELS, CONFIG.audio.SAMPLE_RATE, '16', totalSamples)
	const audioBuffer = Buffer.from(wav.toBuffer().buffer)
	const logEntry = {
		name: 'system',
		role: 'system',
		content: isMatch
			? '检测到可能与主人的声音相似的声音，请求识别和处理。'
			: '检测到来自未知来源的声音，已记录。',
		files: [{
			name: `voice-recording-${new Date().toISOString()}.wav`,
			mime_type: 'audio/wav',
			buffer: audioBuffer
		}],
		charVisibility: [charname],
	}

	if (isMatch) {
		console.log('🎤 Voice matched! Triggering AI...')
		try {
			const result = await GetReply({
				...RealityChannel,
				chat_log: [...RealityChannel.chat_log, logEntry],
				extension: {
					...RealityChannel.extension,
					is_internal: true,
					enable_prompts: {
						CodeRunner: true,
						fileChange: true,
					}
				}
			})
			result.logContextBefore.push(logEntry)
			await RealityChannel.AddChatLogEntry(result)
		} catch (err) {
			console.error('🎤 Error during AI reply:', err)
		}
	} else {
		console.log('🎤 Voice not matched. Only recorded.')
		await RealityChannel.AddChatLogEntry(logEntry)
	}

	transitionToState('ARMED', now)
}

// --- 核心状态机逻辑 (State Machine Logic) ---

function transitionToState(newState, now) {
	const oldState = sentinelState.state
	if (oldState === newState) return

	sentinelState.state = newState
	console.log(`🚦 State change: ${oldState} -> ${newState}`)

	switch (newState) {
		case 'ARMED':
			sentinelState.quietStartTime = null
			sentinelState.lastLoudTime = null
			sentinelState.recordingBuffer = []
			sentinelState.armingBuffer = []
			sentinelState.recordingStartTime = null
			sentinelState.consecutiveLoudFrames = 0
			sentinelState.lastValidationCheckTime = 0
			sentinelState.activityLog = []
			sentinelState.currentRecordingStats = createInitialRecordingStats()
			break
		case 'MONITORING_QUIET':
			sentinelState.quietStartTime = now
			break
		case 'RECORDING':
			sentinelState.recordingStartTime = now
			sentinelState.lastLoudTime = now
			sentinelState.lastValidationCheckTime = now
			for (const frame of sentinelState.armingBuffer)
				processFrameForRecording(frame)

			sentinelState.armingBuffer = []
			break
		case 'INITIALIZING':
			sentinelState.initRmsList = []
			break
	}
}

function processFrameForRecording(frameData) {
	sentinelState.recordingBuffer.push(frameData)
	const stats = sentinelState.currentRecordingStats
	stats.totalRms += frameData.rms
	stats.frameCount++

	if (frameData.rms > sentinelState.dynamicThresholds.quiet) {
		stats.totalLoudFrames++
		if (isFrameMatchingVoice(frameData.buffer))
			stats.matchingLoudFrames++
	}
}

function handleInitializingState(now) {
	if (now - (sentinelState.initStartTime || (sentinelState.initStartTime = now)) >= CONFIG.timing.INITIALIZATION_MS) {
		const avgRms = calculateMean(sentinelState.initRmsList)
		sentinelState.avgEnvRms = avgRms
		const stdDev = calculateStdDev(sentinelState.initRmsList, avgRms)
		sentinelState.dynamicThresholds.quiet = Math.max(CONFIG.thresholds.MIN_QUIET_THRESHOLD, avgRms + stdDev * CONFIG.thresholds.QUIET_STD_MULTIPLIER)
		sentinelState.dynamicThresholds.loud = Math.max(CONFIG.thresholds.MIN_LOUD_THRESHOLD, avgRms + stdDev * CONFIG.thresholds.LOUD_STD_MULTIPLIER)

		console.log('📝 Dynamic thresholds calculated:')
		console.log(`   Average RMS: ${avgRms.toFixed(2)} | Standard Deviation: ${stdDev.toFixed(2)}`)
		console.log(`   Quiet Threshold: ${sentinelState.dynamicThresholds.quiet.toFixed(0)}`)
		console.log(`   Loud Threshold: ${sentinelState.dynamicThresholds.loud.toFixed(0)}`)

		sentinelState.referenceMfccs = loadReferenceMfcc()
		transitionToState('ARMED', now)
	}
}

function handleMonitoringQuietState(rms, now) {
	if (rms > sentinelState.dynamicThresholds.quiet)
		sentinelState.quietStartTime = now
	else if (now - sentinelState.quietStartTime >= CONFIG.timing.QUIET_PERIOD_FOR_ARMING_MS)
		transitionToState('ARMED', now)

}

function handleArmedState(frameData, now) {
	const isLoud = frameData.rms > sentinelState.dynamicThresholds.loud

	// --- 近期高激活检测 ---
	sentinelState.activityLog.push({ timestamp: now, isLoud })
	const windowStart = now - CONFIG.timing.LOUD_ACTIVITY_WINDOW_MS
	// 清理超出时间窗口的旧数据
	while (sentinelState.activityLog.length > 0 && sentinelState.activityLog[0].timestamp < windowStart)
		sentinelState.activityLog.shift()

	// 仅在有足够时间跨度的数据时才进行计算，避免窗口初期误判
	const activityDuration = now - (sentinelState.activityLog[0]?.timestamp || now)
	if (activityDuration > CONFIG.timing.LOUD_ACTIVITY_WINDOW_MS / 2) {
		const loudFramesInWindow = sentinelState.activityLog.filter(f => f.isLoud).length
		const loudPercentage = loudFramesInWindow / sentinelState.activityLog.length
		if (loudPercentage > CONFIG.triggers.LOUD_ACTIVITY_THRESHOLD) {
			console.log(`⏳ Recent activity ratio too high (${(loudPercentage * 100).toFixed(1)}%), switching to silent monitoring to avoid continuous false triggers.`)
			transitionToState('MONITORING_QUIET', now)
			return
		}
	}

	sentinelState.armingBuffer.push(frameData)
	if (sentinelState.armingBuffer.length > CONFIG.triggers.PRE_BUFFER_FRAME_COUNT)
		sentinelState.armingBuffer.shift()

	if (isLoud) {
		sentinelState.consecutiveLoudFrames++
		if (sentinelState.consecutiveLoudFrames >= CONFIG.triggers.CONSECUTIVE_LOUD_FRAMES) {
			console.log('💥 Detected continuous high volume! Starting recording...')
			transitionToState('RECORDING', now)
		}
	} else
		sentinelState.consecutiveLoudFrames = 0

}

async function handleRecordingState(frameData, now) {
	processFrameForRecording(frameData)
	const stats = sentinelState.currentRecordingStats

	// --- 实时追踪内部静音 ---
	if (frameData.rms > sentinelState.dynamicThresholds.quiet) {
		// 侦测到声音，意味着静音中断
		sentinelState.lastLoudTime = now

		// 如果刚刚结束了一段静音，检查它是否是史上最长的
		if (stats.currentSilenceStreakFrames > 0) {
			stats.longestInternalSilenceFrames = Math.max(
				stats.longestInternalSilenceFrames,
				stats.currentSilenceStreakFrames,
			)
			// 重置当前静音计数
			stats.currentSilenceStreakFrames = 0
		}
	} else
		// 还在静音中，累加计数
		stats.currentSilenceStreakFrames++


	// --- 动态计算静音超时时长 ---
	const frameDurationMs = (CONFIG.audio.FRAME_LENGTH / CONFIG.audio.SAMPLE_RATE) * 1000
	// 动态延时 = 已知的最长停顿 * 1.5
	const dynamicTimeoutExtensionMs = stats.longestInternalSilenceFrames * frameDurationMs * 1.5
	// 有效超时 = max(基础超时, 动态延时)，同时设置一个上限防止无限等待
	const effectiveTimeoutMs = Math.min(
		Math.max(CONFIG.timing.SILENCE_TIMEOUT_MS, dynamicTimeoutExtensionMs),
		7000, // 超时上限为 7 秒，可按需调整
	)

	// --- 使用动态超时来判断是否结束 ---
	if (now - sentinelState.recordingStartTime >= CONFIG.timing.MAX_RECORDING_MS) {
		console.log('🕒 Maximum recording duration reached.')
		await finishRecordingSession(now)
	} else if (now - sentinelState.lastLoudTime >= effectiveTimeoutMs) {
		console.log(`🔇 Continuous silence detected (dynamic timeout: ${(effectiveTimeoutMs / 1000).toFixed(2)}s).`)
		await finishRecordingSession(now)
	}
}

// --- 主程序 (Main Application) ---

async function restartRecorder() {
	if (sentinelState.recorder) sentinelState.recorder.release()
	await new Promise(resolve => setTimeout(resolve, 1000))

	try {
		sentinelState.recorder = new PvRecorder(CONFIG.audio.FRAME_LENGTH, -1)
		sentinelState.recorder.start()
		console.log('✅ Recorder restarted.')
		sentinelState.recorderRetryCount = 0
		return true
	} catch (err) {
		console.error(`❌ Failed to restart recorder: ${err.message}.`)
		sentinelState.recorderRetryCount++
		return false
	}
}

function updateCliDisplay(rms) {
	const bar = '█'.repeat(Math.min(CONFIG.display.CLI_BAR_MAX_LENGTH, Math.floor(rms / CONFIG.display.CLI_BAR_RMS_SCALING_FACTOR)))
	let statusDisplay = `[状态: ${sentinelState.state.padEnd(16)}] RMS: ${rms.toFixed(0).padEnd(5)} | ${bar}`

	if (sentinelState.state === 'ARMED' && sentinelState.consecutiveLoudFrames > 0)
		statusDisplay += ` (Loud streak: ${sentinelState.consecutiveLoudFrames}/${CONFIG.triggers.CONSECUTIVE_LOUD_FRAMES})`
	else if (sentinelState.state === 'RECORDING') {
		const { currentRecordingStats, recordingStartTime } = sentinelState
		const recordingDuration = ((Date.now() - recordingStartTime) / 1000).toFixed(1)
		const ratio = currentRecordingStats.totalLoudFrames > 0
			? (currentRecordingStats.matchingLoudFrames / currentRecordingStats.totalLoudFrames).toFixed(2) : 'N/A'
		statusDisplay += ` (Recording: ${recordingDuration}s | Match: ${ratio})`
	}
	console.freshLine('status-line', statusDisplay)
}

let isRunning = false

async function sentinelLoop() {
	while (isRunning) {
		let frame
		try {
			if (!sentinelState.recorder) {
				console.error('❌ Recorder not initialized.')
				await new Promise(resolve => setTimeout(resolve, 5000))
				continue
			}
			frame = await sentinelState.recorder.read()
		} catch (error) {
			if (!isRunning) return
			console.error(`❌ Failed to read audio frame: ${error.message}.`)
			if (sentinelState.recorderRetryCount < 5) {
				console.log('🕒 Attempting to restart recorder in 1 minute...')
				await new Promise(resolve => setTimeout(resolve, 60 * 1000))
				console.log('⏳ Attempting to restart recorder...')
				if (!await restartRecorder()) continue
			} else {
				console.error('❌ Recorder restart failed multiple times, stopping sentinel.')
				isRunning = false
			}
			continue
		}

		const now = Date.now()
		const rms = calculateRMS(frame)
		const frameData = { buffer: frame, rms }

		// updateCliDisplay(rms)

		switch (sentinelState.state) {
			case 'INITIALIZING':
				sentinelState.initRmsList.push(rms)
				handleInitializingState(now)
				break
			case 'MONITORING_QUIET':
				handleMonitoringQuietState(rms, now)
				break
			case 'ARMED':
				handleArmedState(frameData, now)
				break
			case 'RECORDING':
				await handleRecordingState(frameData, now)
				break
		}
	}
}

export function stopVoiceSentinel() {
	if (!isRunning) return
	console.log('👋 Shutting down audio sentinel...')
	isRunning = false
	if (sentinelState.recorder) {
		sentinelState.recorder.release()
		sentinelState.recorder = null
	}
	console.log('🎤 Audio sentinel stopped.')
}

export async function checkVoiceSentinel() {
	// Stop conditions
	if (!existsSync(CONFIG.files.REFERENCE_WAV)) {
		stopVoiceSentinel()
		return isRunning
	}

	// If running, check for updates
	if (isRunning)
		try {
			const { mtime } = statSync(CONFIG.files.REFERENCE_WAV)
			// If mtime is newer, reload the reference MFCCs
			if (sentinelState.referenceFileMtime && mtime.getTime() > sentinelState.referenceFileMtime.getTime()) {
				console.log('🔄 Detected voice reference file update, reloading features...')
				sentinelState.referenceMfccs = loadReferenceMfcc() // This also updates the mtime in the state
			}
		} catch (err) {
			console.error('❌ Error checking voice reference file update, stopping sentinel:', err.message)
			stopVoiceSentinel()
		}
	else
		// If not running, start it
		startVoiceSentinel()

	return isRunning
}

function startVoiceSentinel() {
	if (charConfig.disable_voice_sentinel) {
		console.log('🎤 Audio sentinel is disabled by config.')
		return
	}
	if (isRunning) {
		console.log('🎤 Audio sentinel already running.')
		return
	}

	// --- 前置条件检查 ---
	if (!existsSync(CONFIG.files.REFERENCE_WAV)) {
		console.log(`🎤 Audio sentinel: Reference audio (${CONFIG.files.REFERENCE_WAV}) does not exist, cannot start.`)
		return
	}

	console.log('🚀 Starting audio sentinel...')
	sentinelState = createInitialState() // 重置状态
	isRunning = true

	try {
		sentinelState.recorder = new PvRecorder(CONFIG.audio.FRAME_LENGTH, -1)
		sentinelState.recorder.start()
		console.log(`🎤 PvRecorder microphone source created (sample rate: ${sentinelState.recorder.sampleRate}).`)
		console.log(`🔬 Initializing... Analyzing ambient noise (${CONFIG.timing.INITIALIZATION_MS / 1000} seconds)...`)
		sentinelLoop().catch(err => {
			console.error('❌ Sentinel main loop exited with error:', err)
			stopVoiceSentinel()
		})
	} catch (err) {
		console.error(`❌ Failed to start recorder: ${err.message}`)
		isRunning = false
	}
}

/**
 * 初始化语音监视器。
 * 检查是否已存在语音监视器，如果不存在，则创建一个新的语音监视器。
 */
export function initializeVoiceSentinel() {
	initRealityChannel()
	startVoiceSentinel()
}
