import CardFileInfo from "../../src/cardinfo.mjs"
import { keyScoreAdder } from "../../src/keyScore.mjs"
import { remove_simple_marcos } from "../../src/tools.mjs"
import { encoder, get_token_size } from "../../src/get_token_size.mjs"
import { promptBuilder } from "../../src/prompt_builder.mjs"
import { is_WILogicNode } from "../../src/WILN.mjs"

CardFileInfo.readDataFiles(); keyScoreAdder(CardFileInfo.character_book.entries)
let charData = CardFileInfo.metaData, enabledWIs = CardFileInfo.character_book.entries.filter(_ => _.enabled)
let greetings = [charData.first_mes, ...charData.alternate_greetings, ...charData.extensions.group_greetings]
let total_key_num = enabledWIs.map(_ => _.keys.length + _.secondary_keys.length).reduce((a, b) => a + b, 0)
let stat = {
	data_size: (JSON.stringify(CardFileInfo.v1metaData).length / 1024.0).toFixed(2) + 'KB',
	wibook_entries: {
		total: CardFileInfo.character_book.entries.length,
		enabled: {
			total: enabledWIs.length,
			bluelight: enabledWIs.filter(_ => _.constant).length,
			logic_node: enabledWIs.map(_ => _.content).filter(is_WILogicNode).length,
		},
		disabled: CardFileInfo.character_book.entries.length - enabledWIs.length,
	},
	key_num: {
		total: total_key_num,
		average: total_key_num / enabledWIs.length
	},
	token_size: {
		total: get_token_size(remove_simple_marcos([
			charData.description, charData.personality, charData.scenario, charData.mes_example,
			charData.system_prompt, charData?.extensions?.depth_prompt?.prompt,
			...greetings,
			...enabledWIs.map(_ => _.content),
		].filter(_ => _).join('\n')).replace(/\n+/g, '\n')),
		base: get_token_size(promptBuilder(charData, 'hello')),
		corpus: get_token_size(enabledWIs.filter(_ => _.comment.startsWith('语料')).map(_ => _.content)),
		normal: greetings.map(greeting => get_token_size(promptBuilder(charData, [
			{
				role: 'assistant',
				content: greeting
			},
			{
				role: 'user',
				content: 'hello'
			}
		]))).reduce((a, b) => a + b, 0)/greetings.length,
	},
	greetings_num: {
		total: greetings.length,
		common: charData.alternate_greetings.length + 1,
		group: charData.extensions.group_greetings.length,
	}
}
encoder.free()
console.dir(stat, { depth: null })
