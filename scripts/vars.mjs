import fs from 'node:fs'
import path from 'node:path'

import { loadJsonFileIfExists, saveJsonFile } from '../../../../../../src/scripts/json_loader.mjs'
import { chardir } from '../charbase.mjs'

const varsMap = {}
/**
 * Retrieves a variable from the varsMap, loading it from a JSON file if it does not exist.
 * If the variable is not found, it is initialized with the provided default value.
 *
 * @template T
 * @param {string} name - The name of the variable to retrieve.
 * @param {T} [vdefault={}] - The default value to use if the variable is not found.
 * @returns {T} The variable's value from varsMap or the default value.
 */
export function getVar(name, vdefault = {}) {
	return varsMap[name] ??= loadJsonFileIfExists(path.join(chardir, 'vars', `${name}.json`), vdefault)
}
export function saveVar(name, data = varsMap[name]) {
	fs.mkdirSync(path.join(chardir, 'vars'), { recursive: true })
	saveJsonFile(path.join(chardir, 'vars', `${name}.json`), varsMap[name] = data)
}
export function saveVars() {
	for (const name in varsMap) saveVar(name)
}
