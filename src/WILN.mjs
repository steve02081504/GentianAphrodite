import { parseRegexFromString } from "./tools.mjs"
import sha256 from 'crypto-js/sha256.js'

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
 * Compiles the WI Logic Nodes in the given object into a unique string.
 *
 * @template T
 * @param {T} obj
 * @param {string} sign
 * @returns {T}
 */
export function WILogicNodeCompiler(obj, sign) {
	return JSON.parse(JSON.stringify(obj).replace(/<-<WI(推理节点|推理節點|LogicalNode)(：|:)([\s\S]+?)>->/gu, key =>
		'<-' + sha256(sign + key).toString().substring(0, 6) + '->'
	))
}

/**
 * Determines if the given string is a compiled WI Logic Node.
 *
 * @param {string} str - The string to check.
 * @return {boolean} Returns true if the string is a compiled WI Logic Node, false otherwise.
 */
export function is_CompiledWILogicNode(str) {
	return /^<-[0-9a-z]{6}->$/gu.test(str)
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
