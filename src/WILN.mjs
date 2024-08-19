import { parseRegexFromString } from "./tools.mjs"

/**
 * Determines if the given string is a WI Logic Node.
 *
 * @param {string} str - The string to check.
 * @return {boolean} Returns true if the string is a WI Logic Node, false otherwise.
 */
export function is_WILogicNode(str) {
	return /^<-<WI(推理节点|推理節點|LogicalNode)(：|:)([\s\S]+?)>->\s*$/gu.test(str)
}

/**
 * Checks if a given key is a common key.
 *
 * @param {string} key - The key to check.
 * @return {boolean} Returns true if the key is a common key, false otherwise.
 */
export function is_common_key(key) {
	return !(is_WILogicNode(key) || parseRegexFromString(key))
}
