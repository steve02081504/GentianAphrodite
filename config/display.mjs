/* global geti18n, partpath, parturl */
// Common elements
/**
 * 将 Blob 对象转换为 Base64 编码的 Data URL 字符串。
 * @param {Blob} blob - 要转换的 Blob 对象。
 * @returns {Promise<string>} - 包含 Base64 编码数据 URL 的 Promise。
 */
function blobToBase64(blob) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader()
		/**
		 * 处理文件读取完成事件。
		 * @returns {void}
		 */
		reader.onloadend = () => resolve(reader.result)
		reader.onerror = reject
		reader.readAsDataURL(blob)
	})
};

/**
 * 将 Blob 数据保存到服务器。
 * @param {string} fileName - 要保存的文件名。
 * @param {Blob} blob - 要保存的 Blob 数据。
 * @param {HTMLElement} statusElement - 用于显示状态的 HTML 元素。
 * @returns {Promise<boolean>} - 如果保存成功则返回 true，否则返回 false。
 */
const saveFile = async (fileName, blob, statusElement) => {
	const base64Data = await blobToBase64(blob)
	statusElement.textContent = geti18n('GentianAphrodite.config.saving')
	try {
		const response = await fetch(`/api${parturl}/saveFile`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				filePath: fileName,
				content: base64Data
			}),
		})
		if (!response.ok) {
			const error = await response.json()
			throw new Error(error.message || geti18n('GentianAphrodite.config.failed_to_save_file_generic'))
		}
		const result = await response.json()
		statusElement.textContent = geti18n('GentianAphrodite.config.file_saved', { fileName })
		console.log('File saved successfully', result)
		return true
	}
	catch (error) {
		console.error('Error saving file:', error)
		statusElement.textContent = geti18n('GentianAphrodite.config.save_failed', { errorMessage: error.message })
		return false
	}
}

/**
 * 将原始音频数据保存到服务器。
 * @param {string} fileName - 要保存的文件名。
 * @param {AudioBuffer} audioBuffer - 包含音频数据的 AudioBuffer。
 * @param {HTMLElement} statusElement - 用于显示状态的 HTML 元素。
 * @returns {Promise<boolean>} - 如果保存成功则返回 true，否则返回 false。
 */
const saveRawAudio = async (fileName, audioBuffer, statusElement) => {
	const samples = audioBuffer.getChannelData(0)
	statusElement.textContent = geti18n('GentianAphrodite.config.saving')
	try {
		const response = await fetch(`/api${parturl}/saveAudioFile`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				filePath: fileName,
				samples: Array.from(samples),
			}),
		})
		if (!response.ok) {
			const error = await response.json()
			throw new Error(error.message || geti18n('GentianAphrodite.config.failed_to_save_audio_file_generic'))
		}
		const result = await response.json()
		statusElement.textContent = geti18n('GentianAphrodite.config.file_saved', { fileName })
		console.log('Audio file saved successfully', result)
		return true
	}
	catch (error) {
		console.error('Error saving audio file:', error)
		statusElement.textContent = geti18n('GentianAphrodite.config.save_failed', { errorMessage: error.message })
		return false
	}
}

// --- Audio Section ---
const recordButton = document.getElementById('recordButton')
const stopButton = document.getElementById('stopButton')
const recordingStatus = document.getElementById('recordingStatus')
const audioPlayback = document.getElementById('audioPlayback')
const audioStatus = document.getElementById('audioStatus')
let mediaRecorder
let audioChunks = []
let audioStream = null

/**
 * 处理 MediaRecorder 的数据可用事件，将音频数据块添加到 audioChunks 数组。
 * @param {BlobEvent} event - 包含音频数据块的事件对象。
 */
function handleRecorderDataAvailable(event) {
	audioChunks.push(event.data)
}

/**
 * 处理 MediaRecorder 的停止事件，处理录制的音频数据并保存。
 * @async
 * @returns {Promise<void>}
 */
async function handleRecorderStop() {
	recordingStatus.textContent = geti18n('GentianAphrodite.config.processing_recording')
	try {
		const webmBlob = new Blob(audioChunks, { type: 'audio/webm' })
		if (!webmBlob.size) throw new Error(geti18n('GentianAphrodite.config.empty_recording_file'))

		const renderedBuffer = await resampleAudio(webmBlob)
		const success = await saveRawAudio('vars/master-voice-reference.wav', renderedBuffer, recordingStatus)

		if (success) {
			loadPreview('vars/master-voice-reference.wav', audioPlayback, audioStatus, 'audio')
			audioStatus.textContent = geti18n('GentianAphrodite.config.new_reference_voice_saved_and_loaded')
		}
	}
	catch (error) {
		console.error('Error processing or saving recording:', error)
		recordingStatus.textContent = geti18n('GentianAphrodite.config.processing_failed', { errorMessage: error.message })
	}
	finally {
		audioChunks = []
		if (audioStream)
			audioStream.getTracks().forEach(track => track.stop())
	}
}

// --- Photo Section ---
const photoInput = document.getElementById('photoInput')
const savePhotoButton = document.getElementById('savePhotoButton')
const imagePreview = document.getElementById('imagePreview')
const photoStatus = document.getElementById('photoStatus')
const uploadStatus = document.getElementById('uploadStatus')
const cameraButton = document.getElementById('cameraButton')
const cameraView = document.getElementById('cameraView')
const videoElement = document.getElementById('videoElement')
const captureButton = document.getElementById('captureButton')
let selectedPhotoFile = null
let videoStream = null

/**
 * 从服务器加载并显示文件预览。
 * @param {string} filePath - 要加载的文件的路径。
 * @param {HTMLImageElement|HTMLAudioElement} element - 用于显示预览的 HTML 元素。
 * @param {HTMLElement} statusElement - 用于显示状态的 HTML 元素。
 * @param {'audio'|'photo'} type - 文件类型。
 * @returns {Promise<void>}
 */
const loadPreview = async (filePath, element, statusElement, type) => {
	statusElement.textContent = geti18n('GentianAphrodite.config.loading_preview')
	try {
		const response = await fetch(`/api${parturl}/getFile?filePath=${encodeURIComponent(filePath)}&t=${Date.now()}`)
		if (response.ok) {
			const blob = await response.blob()
			const url = URL.createObjectURL(blob)
			element.src = url
			if (type === 'audio') {
				element.classList.remove('hidden')
				statusElement.textContent = geti18n('GentianAphrodite.config.preview_loaded')
			}
			else if (type === 'photo') {
				element.classList.add('hidden') // Keep it hidden by default
				statusElement.textContent = geti18n('GentianAphrodite.config.reference_photo_set_click_to_toggle')
				statusElement.classList.add('cursor-pointer', 'hover:underline')
				/**
				 * 点击状态元素时切换图片预览的可见性。
				 * @returns {void}
				 */
				statusElement.onclick = () => element.classList.toggle('hidden')
			}
			else statusElement.textContent = geti18n('GentianAphrodite.config.preview_loaded')

		}
		else if (response.status === 404) {
			statusElement.textContent = geti18n('GentianAphrodite.config.no_reference_file_set')
			if (type === 'photo') {
				statusElement.classList.remove('cursor-pointer', 'hover:underline')
				statusElement.onclick = null
			}
		}
		else {
			const error = await response.json()
			throw new Error(error.message || `Failed to load ${type}`)
		}
	}
	catch (error) {
		console.error(`Error loading ${type}:`, error)
		statusElement.textContent = geti18n('GentianAphrodite.config.load_preview_failed', { errorMessage: error.message })
	}
}

loadPreview('vars/master-voice-reference.wav', audioPlayback, audioStatus, 'audio')
loadPreview('vars/master-photo-reference.png', imagePreview, photoStatus, 'photo')

/**
 * 对音频 Blob进行重采样。
 * @param {Blob} webmBlob - 要重采样的 WebM 音频 Blob。
 * @returns {Promise<AudioBuffer>} - 重采样后的 AudioBuffer。
 */
const resampleAudio = async webmBlob => {
	try {
		const audioContext = new (window.AudioContext || window.webkitAudioContext)()
		const decodedBuffer = await audioContext.decodeAudioData(await webmBlob.arrayBuffer())
		const targetSampleRate = 16000
		const offlineContext = new OfflineAudioContext(1, decodedBuffer.duration * targetSampleRate, targetSampleRate)
		const source = offlineContext.createBufferSource()
		source.buffer = decodedBuffer
		source.connect(offlineContext.destination)
		source.start(0)
		return await offlineContext.startRendering()
	}
	catch (error) {
		console.error('Failed to process audio:', error)
		throw new Error(geti18n('GentianAphrodite.config.audio_processing_failed', { errorMessage: error.message }))
	}
}

// --- Audio Logic ---
recordButton.addEventListener('click', handleRecordButtonClick)

/**
 * 处理录制按钮的点击事件，开始录音。
 * @async
 * @returns {Promise<void>}
 */
async function handleRecordButtonClick() {
	try {
		audioStream = await navigator.mediaDevices.getUserMedia({ audio: true })
		const recorder = new MediaRecorder(audioStream, { mimeType: 'audio/webm' })
		mediaRecorder = recorder // for stopButton to access

		recorder.ondataavailable = handleRecorderDataAvailable

		recorder.onstop = handleRecorderStop

		audioChunks = []
		recorder.start()
		recordButton.classList.add('hidden')
		stopButton.classList.remove('hidden')
		recordingStatus.textContent = geti18n('GentianAphrodite.config.recording_in_progress')
	}
	catch (error) {
		console.error('Error starting recording:', error)
		recordingStatus.textContent = geti18n('GentianAphrodite.config.cannot_start_recording', { errorMessage: error.message })
		if (audioStream)
			audioStream.getTracks().forEach(track => track.stop())

	}
}

stopButton.addEventListener('click', handleStopButtonClick)

/**
 * 处理停止按钮的点击事件，停止录音。
 */
function handleStopButtonClick() {
	if (mediaRecorder && mediaRecorder.state !== 'inactive')
		mediaRecorder.stop()

	recordButton.classList.remove('hidden')
	stopButton.classList.add('hidden')
	recordingStatus.textContent = geti18n('GentianAphrodite.config.recording_stopped')
}

// --- Photo Logic ---
/**
 * 停止摄像头视频流并隐藏摄像头视图。
 * @returns {void}
 */
const stopCamera = () => {
	if (videoStream) {
		videoStream.getTracks().forEach(track => track.stop())
		videoStream = null
	}
	cameraView.classList.add('hidden')
}

cameraButton.addEventListener('click', async () => {
	if (videoStream) {
		stopCamera()
		return
	}
	try {
		videoStream = await navigator.mediaDevices.getUserMedia({ video: true })
		videoElement.srcObject = videoStream
		cameraView.classList.remove('hidden')
		uploadStatus.textContent = geti18n('GentianAphrodite.config.camera_on')
	}
	catch (error) {
		console.error('Error accessing camera:', error)
		uploadStatus.textContent = geti18n('GentianAphrodite.config.cannot_access_camera', { errorMessage: error.message })
	}
})

captureButton.addEventListener('click', () => {
	const canvas = document.createElement('canvas')
	canvas.width = videoElement.videoWidth
	canvas.height = videoElement.videoHeight
	canvas.getContext('2d').drawImage(videoElement, 0, 0, canvas.width, canvas.height)
	canvas.toBlob(blob => {
		selectedPhotoFile = blob
		const url = URL.createObjectURL(blob)
		imagePreview.src = url
		imagePreview.classList.remove('hidden')
		photoStatus.textContent = geti18n('GentianAphrodite.config.photo_captured_click_to_save')
		photoStatus.classList.remove('cursor-pointer', 'hover:underline')
		photoStatus.onclick = null
		stopCamera()
	}, 'image/png')
})

photoInput.addEventListener('change', handlePhotoInputChange)

/**
 * 处理照片输入框的 change 事件，预览选定的照片。
 */
function handlePhotoInputChange() {
	stopCamera()
	selectedPhotoFile = photoInput.files[0]
	if (selectedPhotoFile) {
		const reader = new FileReader()
		/**
		 * 处理文件读取完成事件。
		 * @param {ProgressEvent<FileReader>} e - 文件读取事件对象。
		 */
		reader.onload = e => {
			imagePreview.src = e.target.result
			imagePreview.classList.remove('hidden')
			photoStatus.textContent = geti18n('GentianAphrodite.config.new_image_selected_click_to_save')
			photoStatus.classList.remove('cursor-pointer', 'hover:underline')
			photoStatus.onclick = null
		}
		reader.readAsDataURL(selectedPhotoFile)
	}
}

savePhotoButton.addEventListener('click', async () => {
	if (!selectedPhotoFile) {
		uploadStatus.textContent = geti18n('GentianAphrodite.config.please_select_or_take_photo_first')
		return
	}
	const success = await saveFile('vars/master-photo-reference.png', selectedPhotoFile, uploadStatus)
	if (success) {
		photoStatus.textContent = geti18n('GentianAphrodite.config.photo_updated')
		loadPreview('vars/master-photo-reference.png', imagePreview, photoStatus, 'photo')
		selectedPhotoFile = null
		photoInput.value = ''
	}
})
