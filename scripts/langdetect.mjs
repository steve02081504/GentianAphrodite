import { base_match_keys } from './match.mjs'

export function is_English(text) {
	return base_match_keys(text, [
		'all', 'and', 'as', 'be', 'but', 'by', 'can', 'could', 'die', 'do', 'from', 'go', 'happy', 'have', 'he', 'in', 'info', 'it', 'know', 'make', 'man', 'more', 'no', 'of', 'on', 'only', 'other', 'out', 'say', 'she', 'should', 'state', 'than', 'into', 'that', 'the', 'there', 'they', 'this', 'time', 'to', 'up', 'we', 'well', 'what', 'when', 'which', 'who', 'why', 'will', 'with', 'world', 'you'
	])
}

export function is_Japanese(text) {
	return base_match_keys(text, [/[\u3040-\u30FF]/])
}

export function is_Korean(text) {
	return base_match_keys(text, [/[\uAC00-\uD7A3]/])
}

export function is_French(text) {
	return base_match_keys(text, [/[\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u01FF]/])
}

export function is_Spanish(text) {
	return base_match_keys(text, [/[\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u00FF]/])
}

export function is_Russian(text) {
	return base_match_keys(text, [/[\u0400-\u04FF]/])
}

export function is_German(text) {
	return base_match_keys(text, [/[\u00C0-\u017F]/])
}

export function is_Hindi(text) {
	return base_match_keys(text, [/[\u0900-\u0A7F]/])
}

export function is_Swedish(text) {
	return base_match_keys(text, [/[ÄÅÖäåö]/])
}

export function is_Chinese(text) {
	return base_match_keys(text, [/[\u4E00-\u9FFF]/])
}

export function is_PureChinese(text) {
	return !is_English(text) && !is_Japanese(text) && !is_Korean(text) && !is_French(text) && !is_Spanish(text) && !is_Russian(text) && !is_German(text) && !is_Hindi(text) && !is_Swedish(text)
}
