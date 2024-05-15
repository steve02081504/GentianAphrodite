import { v2CharWIbook2WIjson } from "../../src/WIjsonMaker.mjs"
import fs from 'fs';
import path from "path";

export default {
	ext: 'json',
	VerIdUpdater: (charVer) => `${charVer}-WI`,
	CharInfoHandler: (CharInfo, SavePath) => {
		let WIjsonData = v2CharWIbook2WIjson(CharInfo.data.character_book);
		delete WIjsonData.originalData;
		fs.writeFileSync(path.dirname(SavePath) + `/${CharInfo.data.character_book.name}.json`, JSON.stringify(WIjsonData))
	}
}
