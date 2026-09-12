import { francAll } from 'npm:franc'

import { base_match_keys } from './match.mjs'

/**
 * 使用 franc 判断文本是否为指定语言，并检查置信度是否达到阈值。
 * @param {string} text - 要检测的文本。
 * @param {string} lang - 语言代码。
 * @param {number} [threshold=0.9] - 置信度阈值。
 * @returns {boolean} - 如果是指定语言且置信度达到阈值则返回 true，否则返回 false。
 */
function is_Franc_threshold(text, lang, threshold = 0.9) {
	if (text.length < 13) return false
	const result = francAll(text, { minLength: 0 })
	if (result.filter(item => item[1] >= 0.9).length > 9) return false
	return result.find(item => item[0] === lang)?.[1] >= threshold
}

/**
 * 判断文本是否为英文。
 * @param {string} text - 要检测的文本。
 * @returns {boolean} - 如果是英文则返回 true，否则返回 false。
 */
export function is_English(text) {
	return base_match_keys(text, [
		'all', 'and', 'as', 'be', 'but', 'by', 'can', 'could', 'die', 'do', 'from', 'go', 'happy', 'have', 'he', 'in', 'info', 'it', 'know', 'make', 'man', 'more', 'no', 'of', 'on', 'only', 'other', 'out', 'say', 'she', 'should', 'state', 'than', 'into', 'that', 'the', 'there', 'they', 'this', 'time', 'to', 'up', 'we', 'well', 'what', 'when', 'which', 'who', 'why', 'will', 'with', 'world', 'you'
	]) > 2 || is_Franc_threshold(text, 'eng')
}

/**
 * 判断文本是否为日文。
 * @param {string} text - 要检测的文本。
 * @returns {boolean} - 如果是日文则返回 true，否则返回 false。
 */
export function is_Japanese(text) {
	return base_match_keys(text, [/[\u3040-\u30FF]/]) > 2 && is_Franc_threshold(text, 'jpn')
}

/**
 * 判断文本是否为韩文。
 * @param {string} text - 要检测的文本。
 * @returns {boolean} - 如果是韩文则返回 true，否则返回 false。
 */
export function is_Korean(text) {
	return base_match_keys(text, [/[\uAC00-\uD7A3]/]) > 2 && is_Franc_threshold(text, 'kor')
}

/**
 * 判断文本是否为法文。
 * @param {string} text - 要检测的文本。
 * @returns {boolean} - 如果是法文则返回 true，否则返回 false。
 */
export function is_French(text) {
	return base_match_keys(text, [/[\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u01FF]/]) > 1 && is_Franc_threshold(text, 'fra')
}

/**
 * 判断文本是否为西班牙文。
 * @param {string} text - 要检测的文本。
 * @returns {boolean} - 如果是西班牙文则返回 true，否则返回 false。
 */
export function is_Spanish(text) {
	return base_match_keys(text, [/[\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u00FF]/]) > 1 && is_Franc_threshold(text, 'spa')
}

/**
 * 判断文本是否为俄文。
 * @param {string} text - 要检测的文本。
 * @returns {boolean} - 如果是俄文则返回 true，否则返回 false。
 */
export function is_Russian(text) {
	return base_match_keys(text, [/[\u0400-\u04FF]/]) > 1 && is_Franc_threshold(text, 'rus')
}

/**
 * 判断文本是否为德文。
 * @param {string} text - 要检测的文本。
 * @returns {boolean} - 如果是德文则返回 true，否则返回 false。
 */
export function is_German(text) {
	return base_match_keys(text, [/[\u00C0-\u017F]/]) > 1 && is_Franc_threshold(text, 'deu')
}

/**
 * 判断文本是否为印地文。
 * @param {string} text - 要检测的文本。
 * @returns {boolean} - 如果是印地文则返回 true，否则返回 false。
 */
export function is_Hindi(text) {
	return base_match_keys(text, [/[\u0900-\u0A7F]/]) > 1 && is_Franc_threshold(text, 'hin')
}

/**
 * 判断文本是否为瑞典文。
 * @param {string} text - 要检测的文本。
 * @returns {boolean} - 如果是瑞典文则返回 true，否则返回 false。
 */
export function is_Swedish(text) {
	return base_match_keys(text, [/[ÄÅÖäåö]/]) && is_Franc_threshold(text, 'swe')
}

/**
 * 判断文本是否为中文。
 * @param {string} text - 要检测的文本。
 * @returns {boolean} - 如果是中文则返回 true，否则返回 false。
 */
export function is_Chinese(text) {
	return base_match_keys(text, [/[\u4E00-\u9FFF]/]) > 1 && is_Franc_threshold(text, 'cmn')
}

/**
 * 判断文本是否为葡萄牙文。
 * @param {string} text - 要检测的文本。
 * @returns {boolean} - 如果是葡萄牙文则返回 true，否则返回 false。
 */
export function is_Portuguese(text) {
	return is_Franc_threshold(text, 'por')
}

/**
 * 判断文本是否为意大利文。
 * @param {string} text - 要检测的文本。
 * @returns {boolean} - 如果是意大利文则返回 true，否则返回 false。
 */
export function is_Italian(text) {
	return is_Franc_threshold(text, 'ita')
}

/**
 * 判断文本是否基本上只包含中文。
 * @param {string} text - 要检测的文本。
 * @returns {boolean} - 如果主要是中文则返回 true，否则返回 false。
 */
export function is_PureChinese(text) {
	if (is_Franc_threshold(text, 'cmn', 0.9)) return true
	if (is_English(text) || is_Japanese(text) || is_Korean(text) || is_French(text) || is_Spanish(text) || is_Russian(text) || is_German(text) || is_Hindi(text) || is_Swedish(text) || is_Portuguese(text) || is_Italian(text)) return false
	return true
}
