import { char_grader } from "../../src/char_grader.mjs"
import { CardFileInfo } from "../../src/cardinfo.mjs"
import { encoder } from "../../src/get_token_size.mjs"

CardFileInfo.readDataFiles()
let result = await char_grader(CardFileInfo.v1metaData)
encoder.free()
console.log(`\nfinal score: ${result.score}`)
