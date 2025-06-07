// This file will contain utility functions for matching.
import { escapeRegExp } from './tools.mjs'
import * as OpenCC from 'npm:opencc-js'
import { normalizeFancyText } from './fancytext.mjs'

const chT2S = OpenCC.Converter({ from: 'twp', to: 'cn' })
export function SimplifiyChinese(content) {
	return chT2S(content)
}

/**
 * A simpler version of SimplifiyContent that does not do any translation.
 * @param {string} content
 * @returns {[string, string, string]} The input, its simplified chinese version, and its normalized fancy text version
 */
export function SimpleSimplify(content) {
	const base_content = SimplifiyChinese(content)
	return [content, base_content, normalizeFancyText(base_content)]
}

export function base_match_keys(content, keys,
	matcher = (content, reg_keys) => {
		const contents = SimpleSimplify(content)
		return Math.max(...contents.map(content => reg_keys.filter(key => content.match(key)).length))
	}
) {
	// convert all keys to regexp, if it's have chinese like character, no match hole word
	keys.forEach(key => {
		if (key instanceof RegExp) key.lastIndex = 0
	})
	keys = keys.map(key =>
		key instanceof RegExp ? key :
			new RegExp(/\p{Unified_Ideograph}/u.test(key) ? escapeRegExp(key) : `\\b${escapeRegExp(key)}\\b`, 'ugi'))

	return matcher(content, keys)
}
