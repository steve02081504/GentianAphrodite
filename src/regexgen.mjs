import regexgen from "regexgen"
import { unicodeEscapeToChar } from "./tools.mjs"

function regexgen_ex_string(inputs) {
	let trie = new regexgen.Trie
	trie.addAll(inputs)
	trie.minimize()
	return unicodeEscapeToChar(trie.toString())
}

/**
 * Generates a regular expression that matches the given input strings.
 * @param {Array<string>} inputs
 * @param {string} flags
 * @return {RegExp}
 */
function regexgen_ex(inputs, flags) {
	return new RegExp(regexgen_ex_string(inputs), flags)
}
regexgen_ex.asString = regexgen_ex_string

export { regexgen_ex as regexgen, regexgen_ex as default }
