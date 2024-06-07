import { CardFileInfo } from "../../src/cardinfo.mjs";
import { encoder_free } from "../../src/get_token_size.mjs";
import { promptBuilder } from "../../src/prompt_builder.mjs";

CardFileInfo.readDataFiles();
let result = promptBuilder(CardFileInfo.metaData, process.argv[2] || 'Have a nice pee.');
encoder_free()
console.dir(result, { depth: null });
