import CardFileInfo from "../../src/cardinfo.mjs"
import { keyScoreAdder } from "../../src/keyScore.mjs"
import { remove_simple_marcos } from "../../src/tools.mjs"
import { encoder, get_token_size } from "../../src/get_token_size.mjs"
import { promptBuilder } from "../../src/prompt_builder.mjs"

CardFileInfo.readDataFiles(); keyScoreAdder(CardFileInfo.character_book.entries)
let charData = CardFileInfo.metaData, enabledWIs = CardFileInfo.character_book.entries.filter(_ => _.enabled)
let greetings = [charData.first_mes, ...charData.alternate_greetings, ...charData.extensions.group_greetings]
let stat = {
	data_size: (JSON.stringify(CardFileInfo.v1metaData).length / 1024.0).toFixed(2) + 'KB',
	wibook_entries: {
		total: CardFileInfo.character_book.entries.length,
		enabled: {
			total: enabledWIs.length,
			bluelight: enabledWIs.filter(_ => _.constant).length,
		},
		disabled: CardFileInfo.character_book.entries.length - enabledWIs.length,
	},
	key_num: enabledWIs.map(_ => _.keys.length + _.secondary_keys.length).reduce((a, b) => a + b, 0),
	total_token_size: get_token_size(remove_simple_marcos([
		charData.description, charData.personality, charData.scenario, charData.mes_example,
		charData.system_prompt, charData?.extensions?.depth_prompt?.prompt,
		...greetings,
		...enabledWIs.map(_ => _.content),
	].filter(_ => _).join('\n')).replace(/\n+/g, '\n')),
	base_token_size: get_token_size(promptBuilder(charData, 'hello')),
	normal_token_size: greetings.map(greeting => get_token_size(promptBuilder(charData, [
		{
			role: 'assistant',
			content: greeting
		},
		{
			role: 'user',
			content: 'hello'
		}
	]))).reduce((a, b) => a + b, 0)/greetings.length,
	greetings_num: greetings.length,
}
encoder.free()
console.dir(stat, { depth: null })
