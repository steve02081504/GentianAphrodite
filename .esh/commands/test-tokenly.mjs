import { CardFileInfo } from "../../src/cardinfo.mjs"
import { colorize_by_tokenize, encoder_free } from "../../src/get_token_size.mjs"
import { keyScoreAdder } from "../../src/keyScore.mjs"
import { promptBuilder } from "../../src/prompt_builder.mjs"
import { print } from "../../src/print.mjs"

CardFileInfo.readDataFiles()
keyScoreAdder(CardFileInfo.character_book.entries)
let result = promptBuilder(CardFileInfo.metaData, process.argv[2] || 'Have a nice pee.')
for (let key in result) if (!result[key]?.length) delete result[key]
result = colorize_by_tokenize(result)
encoder_free()
print(result)
