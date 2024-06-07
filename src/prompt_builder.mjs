import sha256 from 'crypto-js/sha256.js';
import { WorldInfoEntry, v2CharData } from "./charData.mjs";
import { evaluateMacros } from "./engine/marco.mjs";
import { GetActivedWorldInfoEntries } from "./engine/world_info.mjs";
import { get_token_size } from "./get_token_size.mjs";

export let chat_metadata = {
	chat_log: []
}
export function saveMetadataDebounced() {}
export function getChatIdHash() {
	if (chat_metadata.chat_log.length)
		sha256(JSON.stringify(chat_metadata.chat_log[chat_metadata.chat_log.length - 1])).toString();
	return 'bro'
}
export function getStringHash(str) {
	return sha256(str).toString();
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
	let mes_examples = charData.mes_example.split(/<START>/gi).filter(e => e)
	if (Object(chatLog) instanceof String)
		chatLog = [{
			role: "user",
			content: chatLog
		}]

	let WIs = charData?.character_book?.entries ?
		GetActivedWorldInfoEntries(charData.character_book.entries, chatLog, env) :
		[]
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
	let constant_WIs = WIs.filter(e => e.constant)
	WIs = WIs.filter(e => !e.constant)
	for (let WI of constant_WIs)
		aret["WIs_" + WI.position].push(WI)
	let token_now = get_token_size(aret)

	while (token_now < token_budget && WIs.length > 0) {
		let WI = WIs.pop()
		aret["WIs_" + WI.position].push(WI)
		token_now += get_token_size(WI.content)
	}
	aret.WIs_before_char = aret.WIs_before_char.sort((a, b) => a.insertion_order - b.insertion_order).map(e => e.content)
	aret.WIs_after_char = aret.WIs_after_char.sort((a, b) => a.insertion_order - b.insertion_order).map(e => e.content)

	while (token_now < token_budget && mes_examples.length > 0) {
		let mes_example = mes_examples.pop()
		aret.mes_examples.push(mes_example)
		token_now += get_token_size(mes_example)
	}
	return aret
}
