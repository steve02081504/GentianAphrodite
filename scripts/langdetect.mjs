import { base_match_keys } from './match.mjs'
import { francAll } from 'npm:franc'

function is_Franc_threshold(text, lang, threshold = 0.9) {
	if (text.length < 13) return false
	const result = francAll(text, { minLength: 0 })
	if (result.filter(item => item[1] >= 0.9).length > 9) return false
	return result.find(item => item[0] === lang)?.[1] >= threshold
}

export function is_English(text) {
	return base_match_keys(text, [
		'all', 'and', 'as', 'be', 'but', 'by', 'can', 'could', 'die', 'do', 'from', 'go', 'happy', 'have', 'he', 'in', 'info', 'it', 'know', 'make', 'man', 'more', 'no', 'of', 'on', 'only', 'other', 'out', 'say', 'she', 'should', 'state', 'than', 'into', 'that', 'the', 'there', 'they', 'this', 'time', 'to', 'up', 'we', 'well', 'what', 'when', 'which', 'who', 'why', 'will', 'with', 'world', 'you'
	]) > 2 || is_Franc_threshold(text, 'eng')
}

export function is_Japanese(text) {
	return base_match_keys(text, [/[\u3040-\u30FF]/]) > 2 && is_Franc_threshold(text, 'jpn')
}

export function is_Korean(text) {
	return base_match_keys(text, [/[\uAC00-\uD7A3]/]) > 2 && is_Franc_threshold(text, 'kor')
}

export function is_French(text) {
	return base_match_keys(text, [/[\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u01FF]/]) > 1 && is_Franc_threshold(text, 'fra')
}

export function is_Spanish(text) {
	return base_match_keys(text, [/[\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u00FF]/]) > 1 && is_Franc_threshold(text, 'spa')
}

export function is_Russian(text) {
	return base_match_keys(text, [/[\u0400-\u04FF]/]) > 1 && is_Franc_threshold(text, 'rus')
}

export function is_German(text) {
	return base_match_keys(text, [/[\u00C0-\u017F]/]) > 1 && is_Franc_threshold(text, 'deu')
}

export function is_Hindi(text) {
	return base_match_keys(text, [/[\u0900-\u0A7F]/]) > 1 && is_Franc_threshold(text, 'hin')
}

export function is_Swedish(text) {
	return base_match_keys(text, [/[ÄÅÖäåö]/]) && is_Franc_threshold(text, 'swe')
}

export function is_Chinese(text) {
	return base_match_keys(text, [/[\u4E00-\u9FFF]/]) > 1 && is_Franc_threshold(text, 'cmn')
}

export function is_Portuguese(text) {
	return is_Franc_threshold(text, 'por')
}

export function is_Italian(text) {
	return is_Franc_threshold(text, 'ita')
}

export function is_PureChinese(text) {
	if (is_Franc_threshold(text, 'cmn', 0.9)) return true
	if (is_English(text) || is_Japanese(text) || is_Korean(text) || is_French(text) || is_Spanish(text) || is_Russian(text) || is_German(text) || is_Hindi(text) || is_Swedish(text) || is_Portuguese(text) || is_Italian(text)) return false
	return true
}
