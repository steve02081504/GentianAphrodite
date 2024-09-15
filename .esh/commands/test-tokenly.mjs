import { CardFileInfo } from "../../src/cardinfo.mjs"
import { colorize_by_tokenize, encoder } from "../../src/get_token_size.mjs"
import { promptBuilder } from "../../src/prompt_builder.mjs"
import { print } from "../../src/print.mjs"

CardFileInfo.readDataFiles()
let result = promptBuilder(CardFileInfo.metaData, process.argv[2] || 'Have a nice pee.')
for (let key in result) if (!result[key]?.length) delete result[key]
result = colorize_by_tokenize(result)
encoder.free()
print(result)
