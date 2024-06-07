import { char_grader } from "../../src/char_grader.mjs";
import { CardFileInfo } from "../../src/cardinfo.mjs";
import { encoder_free } from "../../src/get_token_size.mjs";

CardFileInfo.readDataFiles();
let result = char_grader(CardFileInfo.v1metaData);
encoder_free()
console.log(`\nfinal score: ${result.score}`);
