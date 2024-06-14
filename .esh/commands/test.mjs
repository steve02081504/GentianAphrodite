import { CardFileInfo } from "../../src/cardinfo.mjs"
import { encoder_free } from "../../src/get_token_size.mjs"
import { keyScoreAdder } from "../../src/keyScore.mjs"
import { promptBuilder } from "../../src/prompt_builder.mjs"

CardFileInfo.readDataFiles()
keyScoreAdder(CardFileInfo.character_book.entries)
let result = promptBuilder(CardFileInfo.metaData, process.argv[2] || 'Have a nice pee.')
encoder_free()
for (let key in result) if (!result[key]?.length) delete result[key]
console.dir(result, { depth: null })
