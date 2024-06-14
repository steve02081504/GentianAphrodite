import yaml from 'yaml'
import fs from 'fs'
import { nicerWriteFileSync } from './tools.mjs'
/** @type {yaml.ToStringOptions} */
const yamlConfig = {
	lineWidth: Number.POSITIVE_INFINITY
}
//fuck ya, ill use tab everywhere
/**
 * Converts a tab indent able YAML string to an object.
 * @param {string} yamlStr
 * @returns {object}
 */
function yamlParse(yamlStr) {
	yamlStr = yamlStr.replace(/\n\t+/g, m => m.replace(/\t/g, '  '))
	yamlStr = yamlStr.replace(/\n\t+-\t\|/g, m => m.replace('-\t|', '- |'))
	return yaml.parse(yamlStr, yamlConfig)
}
/**
 * Converts an object to a tab indented YAML string.
 * @param {object} yamlObj
 * @returns {string}
 */
function yamlStringify(yamlObj) {
	let yamlStr = yaml.stringify(yamlObj, yamlConfig)
	yamlStr = yamlStr.replace(/\n(  )+/g, m => m.replace(/  /g, '\t'))
	yamlStr = yamlStr.replace(/\n\t+- \|/g, m => m.replace('- |', '-\t|'))
	return yamlStr
}

/**
 * Reads a YAML file synchronously and parses it into an object.
 *
 * @param {string} filePath - The path to the YAML file.
 * @return {object} The parsed YAML object.
 */
function yamlReadFileSync(filePath, encoding = 'utf8') {
	return yamlParse(fs.readFileSync(filePath, encoding))
}

/**
 * Writes an object to a YAML file synchronously.
 *
 * @param {string} filePath - The path to the YAML file.
 * @param {object} yamlObj - The object to write to the YAML file.
 * @return {void}
 */
function yamlWriteFileSync(filePath, yamlObj, encoding = 'utf8') {
	nicerWriteFileSync(filePath, yamlStringify(yamlObj), encoding)
}

export default {
	config: yamlConfig,
	parse: yamlParse,
	stringify: yamlStringify,
	readFileSync: yamlReadFileSync,
	writeFileSync: yamlWriteFileSync
}
