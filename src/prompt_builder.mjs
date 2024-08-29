import sha256 from 'crypto-js/sha256.js'
import { WorldInfoEntry, extension_prompt_roles, regex_placement, v2CharData, world_info_position } from "./charData.mjs"
import { evaluateMacros } from "./engine/marco.mjs"
import { GetActivedWorldInfoEntries } from "./engine/world_info.mjs"
import { get_token_size } from "./get_token_size.mjs"
import { parseRegexFromString } from './tools.mjs'

export let chat_metadata = {
	chat_log: []
}
export function saveMetadataDebounced() { }
export function getChatIdHash() {
	if (chat_metadata.chat_log.length)
		sha256(JSON.stringify(chat_metadata.chat_log[chat_metadata.chat_log.length - 1])).toString()
	return 'bro'
}
export function getStringHash(str) {
	return sha256(str).toString()
}

export function promptBuilder(
	/** @type {v2CharData} */
	charData,
	/** @type {{role:string,content:string}[]} */
	chatLog,
	/** @type {{name:string,persona_content:string}} */
	userData = {
		name: 'steve',
	},
	/** @type {string} */
	modelName = 'wubalubadubdub',
	/** @type {number} */
	token_budget = Number.POSITIVE_INFINITY
) {
	let env = {
		char: charData.name,
		user: userData.name,
		model: modelName,
		charVersion: charData.character_version,
		char_version: charData.character_version,
	}
	if (Object(chatLog) instanceof String)
		chatLog = [{
			role: "user",
			content: chatLog
		}]

	let aret = {
		system_prompt: charData.system_prompt,
		personality: charData.personality,
		user_description: userData.persona_content,
		scenario: charData.scenario,
		/** @type {WorldInfoEntry[]} */
		WIs_before_char: [],
		char_description: charData.description,
		/** @type {WorldInfoEntry[]} */
		WIs_after_char: [],
		mes_examples: [],
		chat_log: chatLog
	}
	for (let key in aret) if (Object(aret[key]) instanceof String) aret[key] = evaluateMacros(aret[key], env)
	let WIs = charData?.character_book?.entries ?
		GetActivedWorldInfoEntries(charData.character_book.entries, chatLog, env) :
		[]
	if (charData?.extensions?.regex_scripts) {
		let WI_regex_scripts = charData.extensions.regex_scripts.filter(e => e.placement.includes(regex_placement.WORLD_INFO))
		for (let script of WI_regex_scripts) script.findRegex = parseRegexFromString(script.findRegex)
		for (let e of WIs)
			for (let script of WI_regex_scripts)
				e.content = e.content.replace(script.findRegex, script.replaceString)
		WIs = WIs.filter(e => e.content)
	}
	let mes_examples = charData.mes_example.split(/\n<START>/gi).map(e => e.trim()).filter(e => e)
	let before_EMEntries = []
	let after_EMEntries = []
	let ANTopEntries = []
	let ANBottomEntries = []
	let WIDepthEntries = []
	function add_WI(
		/** @type {WorldInfoEntry} */
		entry
	) {
		let content = entry.content
		switch (entry.extensions.position) {
			case world_info_position.atDepth: {
				const existingDepthIndex = WIDepthEntries.findIndex((e) => e.depth === (entry.depth ?? DEFAULT_DEPTH) && e.role === entry.extensions.role)
				if (existingDepthIndex !== -1)
					WIDepthEntries[existingDepthIndex].entries.unshift(content)
				else
					WIDepthEntries.push({
						depth: entry.extensions?.depth || 0,
						entries: [content],
						role: entry.extensions.role,
					})

				break
			}
			default:
				[
					aret.WIs_before_char,
					aret.WIs_after_char,
					ANTopEntries,
					ANBottomEntries,
					null,
					before_EMEntries,
					after_EMEntries
				][entry.extensions.position || 0].unshift(entry)
				break
		}
	}
	let constant_WIs = WIs.filter(e => e.constant)
	WIs = WIs.filter(e => !e.constant).sort((a, b) => a.extensions.position - b.extensions.position || a.insertion_order - b.insertion_order)
	for (let WI of constant_WIs) add_WI(WI)
	let token_now = get_token_size(aret)

	while (token_now < token_budget && WIs.length > 0) {
		let WI = WIs.pop()
		add_WI(WI)
		token_now += get_token_size(WI.content)
	}
	before_EMEntries = before_EMEntries.map(e => e.content)
	after_EMEntries = after_EMEntries.map(e => e.content)
	ANTopEntries = ANTopEntries.map(e => e.content)
	ANBottomEntries = ANBottomEntries.map(e => e.content)
	aret.WIs_before_char = aret.WIs_before_char.sort((a, b) => a.insertion_order - b.insertion_order).map(e => e.content)
	aret.WIs_after_char = aret.WIs_after_char.sort((a, b) => a.insertion_order - b.insertion_order).map(e => e.content)

	let aothr_notes = charData?.extensions?.depth_prompt?.prompt
	if(aothr_notes)
		aothr_notes = `${ANTopEntries.join('\n')}\n${aothr_notes}\n${ANBottomEntries.join('\n')}`.replace(/(^\n)|(\n$)/g, '')

	let new_chat_log = []
	for (let index = 0; index < chatLog.length; index++) {
		let WIDepth = WIDepthEntries.filter((e) => e.depth === index)
		for (let entrie of WIDepth) {
			let role = ['system', 'user', 'assistant'][entrie.role]
			new_chat_log.unshift({
				role: role,
				content: entrie.entries.join('\n'),
			})
		}
		if (charData?.extensions?.depth_prompt?.prompt && index == charData?.extensions?.depth_prompt?.depth)
			new_chat_log.unshift({
				role: charData?.extensions?.depth_prompt?.role,
				content: aothr_notes
			})

		const message = chatLog[index]
		new_chat_log.unshift(message)
	}
	aret.chat_log = new_chat_log

	mes_examples = [...before_EMEntries, ...mes_examples, ...after_EMEntries].filter(e => e)
	while (token_now < token_budget && mes_examples.length > 0) {
		let mes_example = mes_examples.pop()
		aret.mes_examples.push(mes_example)
		token_now += get_token_size(mes_example)
	}
	return aret
}
