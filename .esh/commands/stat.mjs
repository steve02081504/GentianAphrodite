import CardFileInfo from "../../src/cardinfo.mjs";
import { keyScoreAdder } from "../../src/keyScore.mjs";
import { get_encoding } from "tiktoken";

var encoder = get_encoding('o200k_base');
function simple_marco_remover(str) {
	return str.replace(/{{\/\/([\s\S]*?)}}/g, '').
	replace(/\{\{user\}\}/gi, 'user').
	replace(/\{\{char\}\}/gi, 'char');
}
CardFileInfo.readDataFiles();
keyScoreAdder(CardFileInfo.character_book.entries)
let charData = CardFileInfo.metaData, enabledWIs = CardFileInfo.character_book.entries.filter(_ => _.enabled)
let stat = {
	data_size: (JSON.stringify(CardFileInfo.v1metaData).length / 1024.0).toFixed(2) + 'KB',
	enabled_wibook_entries: enabledWIs.length,
	disabled_wibook_entries: CardFileInfo.character_book.entries.length - enabledWIs.length,
	key_num: enabledWIs.map(_ => _.keys.length + _.secondary_keys.length).reduce((a, b) => a + b, 0),
	total_token_size: encoder.encode(simple_marco_remover([
		charData.description, charData.personality, charData.scenario, charData.mes_example,
		charData.system_prompt, charData.extensions.depth_prompt.prompt,
		charData.first_mes, ...charData.alternate_greetings, ...charData.extensions.group_greetings,
		...enabledWIs.map(_ => _.content),
	].join('\n')).replace(/\n+/g, '\n')).length
}
encoder.free();
console.log(stat);
