import fs from 'node:fs'
import path from 'node:path'

import { loadJsonFileIfExists, saveJsonFile } from '../../../../../../src/scripts/json_loader.mjs'
import { chardir } from '../charbase.mjs'

const varsMap = {}
/**
 * 从 varsMap 中检索一个变量，如果它不存在，则从 JSON 文件中加载它。
 * 如果找不到该变量，则使用提供的默认值对其进行初始化。
 * @template T
 * @param {string} name - 要检索的变量的名称。
 * @param {T} [vdefault={}] - 如果找不到变量，要使用的默认值。
 * @returns {T} - varsMap 中的变量值或默认值。
 */
export function getVar(name, vdefault = {}) {
	return varsMap[name] ??= loadJsonFileIfExists(path.join(chardir, 'vars', `${name}.json`), vdefault)
}
/**
 * 保存一个变量到 JSON 文件。
 * @param {string} name - 要保存的变量的名称。
 * @param {any} [data=varsMap[name]] - 要保存的数据。
 */
export function saveVar(name, data = varsMap[name]) {
	fs.mkdirSync(path.join(chardir, 'vars'), { recursive: true })
	saveJsonFile(path.join(chardir, 'vars', `${name}.json`), varsMap[name] = data)
}
/**
 * 保存所有已加载的变量。
 */
export function saveVars() {
	for (const name in varsMap) saveVar(name)
}
