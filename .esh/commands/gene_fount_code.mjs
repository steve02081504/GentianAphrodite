import CardFileInfo from "../../src/cardinfo.mjs"
import { world_info_logic, world_info_position, WorldInfoEntry } from "../../src/charData.mjs"
import { simplized } from "../../src/chs2t.mjs"
import { is_bothscope, is_userscope, remove_bothscope, remove_userscope, unmake_scope, unpack_key_scope } from "../../src/key_scope.mjs"
import { parseRegexFromString } from "../../src/tools.mjs"
import { is_WILogicNode } from "../../src/WILN.mjs"

CardFileInfo.readDataFiles()

let commonWIs = CardFileInfo.character_book.entries.filter(entry => entry.enabled)
let WILNs = commonWIs.filter(entry => is_WILogicNode(entry.content))
commonWIs = commonWIs.filter(entry => !is_WILogicNode(entry.content))
let depthWIs = commonWIs.filter(entry => entry.extensions.position == world_info_position.atDepth)
commonWIs = commonWIs.filter(entry => entry.extensions.position != world_info_position.atDepth)

let WILNmap = {
	'<-<WI推理节点：任意文本>->': 'true',
	'<-<WI推理节点：输入言语-纯中文-深度2>->': 'logical_results.pure_chinese_input',
	'<-<WI推理节点：色情描绘-深度3>->': 'logical_results.in_nsfw',
	'<-<WI推理节点：调制模式-深度2>->': 'logical_results.in_hypnosis',
	'<-<WI推理节点：调制退出-深度2>->': 'logical_results.hypnosis_exit',
	'<-<WI推理节点：助手功能-深度4>->': 'logical_results.in_assist',
	'<-<WI推理节点：助手功能sub-深度4>->': 'logical_results.in_subassist',
	'<-<WI推理节点：战斗-深度4>->': 'logical_results.in_fight',
	'<-<WI推理节点：外来prompt-深度4>->': 'logical_results.prompt_input',
}
/**
 * @param {string[]} keyList
 * @param {string} scope
 * @param {WorldInfoEntry} entrie
 * @returns
 */
function BuildKeyListCode(keyList, scope, entrie) {
	keyList = keyList.map(key => parseRegexFromString(key) ?
		key :
		`"${key.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
	)
	let functionname = 'match_keys'
	let selectiveLogic = entrie.extensions.selectiveLogic
	if (selectiveLogic == world_info_logic.AND_ALL || selectiveLogic == world_info_logic.NOT_ALL)
		functionname = 'match_keys_all'
	return `${functionname}(args, [${keyList.join(",")}], '${scope}'${entrie.extensions.scan_depth != 4 ? ", " + entrie.extensions.scan_depth : ""})`
}
/**
 * @param {string[]} keyList
 * @param {WorldInfoEntry} entrie
 * @param {*} selectiveLogic
 * @returns
 */
function randerKeyListCodes(keyList, entrie, selectiveLogic) {
	let codes = []
	let WILNkeys = keyList.filter(is_WILogicNode)
	keyList = keyList.filter(k => !is_WILogicNode(k))
	let unpack_key_scope_mapper = (entrie.extensions?.scope ? unmake_scope : unpack_key_scope).bind(null, entrie)
	keyList = [...new Set(keyList.map(simplized))].map(unpack_key_scope_mapper).sort()

	WILNkeys.forEach(key => {
		if (WILNmap[key]) codes.push(WILNmap[key])
		else codes.push(`/* ${key} */`)
	})

	let user_scope_keys = keyList.filter(is_userscope).map(remove_userscope)
	if (user_scope_keys.length) codes.push(BuildKeyListCode(user_scope_keys, 'user', entrie))
	let both_scope_keys = keyList.filter(is_bothscope).map(remove_bothscope)
	if (both_scope_keys.length) codes.push(BuildKeyListCode(both_scope_keys, 'both', entrie))
	let common_keys = keyList.filter(k => !is_userscope(k) && !is_bothscope(k))
	if (common_keys.length) codes.push(BuildKeyListCode(common_keys, 'any', entrie))

	selectiveLogic ??= entrie.extensions?.selectiveLogic
	if (selectiveLogic == world_info_logic.NOT_ALL || selectiveLogic == world_info_logic.NOT_ANY)
		codes = codes.map(code => code.startsWith('/* ') ? `/* not ${code.slice(3)}` : `!${code}`)
	if (selectiveLogic == world_info_logic.AND_ALL || selectiveLogic == world_info_logic.NOT_ANY)
		codes = codes.join(' &&\n')
	else
		codes = codes.join(' ||\n')
	return codes
}
/**
 * @param {WorldInfoEntry} entrie
 */
function randerKeyLists(entrie) {
	let codes = ''
	if (entrie.secondary_keys.length > 1)
		codes += '(' + randerKeyListCodes(entrie.secondary_keys, entrie) + ') &&\n'
	else if (entrie.secondary_keys.length)
		codes += randerKeyListCodes(entrie.secondary_keys, entrie) + ' &&\n'
	if (entrie.keys.length > 1)
		codes += '(' + randerKeyListCodes(entrie.keys, entrie, world_info_logic.AND_ANY) + ')'
	else if (entrie.keys.length)
		codes += randerKeyListCodes(entrie.keys, entrie, world_info_logic.AND_ANY)
	return codes
}
let result_code = ''
WILNs.forEach(entry => {
	if (WILNmap[entry.content]) {
		result_code += `
if(${randerKeyLists(entry)})
	${WILNmap[entry.content]} = true
`
	}
	else
		result_code += `
if(${randerKeyLists(entry)})
	;// now ${entry.content} is true, do something.
`
})
function randerCommonWIs(entry) {
		result_code += `
if(${randerKeyLists(entry)})
	result += \`\\
${entry.content.replace(/\\/g, '\\\\').replace(/`/g, '\\`').
	replace(/{{random\s?::?([^}]+)}}/gi, (_, listString) => {
		// Split on either double colons or comma. If comma is the separator, we are also trimming all items.
		const list = listString.includes('::')
			? listString.split('::')
			// Replaced escaped commas with a placeholder to avoid splitting on them
			: listString.replace(/\\,/g, '##�COMMA�##').split(',').map(item => item.trim().replace(/##�COMMA�##/g, ','))
		return "${random('" + list.join("','") + "')}"
	}).
	replace(/{{user}}/gi, '${args.UserCharname}').
	replace(/{{char}}/gi, '${args.Charname}')
}
\`
`
}
commonWIs.forEach(randerCommonWIs)
result_code += `
// ${depthWIs.length} depth WIs
`
depthWIs.forEach(entry => {
	result_code += `// ${entry.extensions.depth} depth ${entry.extensions.role} role WI\n`
	randerCommonWIs(entry)
})
console.log(result_code)

