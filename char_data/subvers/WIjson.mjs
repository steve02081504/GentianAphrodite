import { v2CharWIbook2WIjson } from "../../src/WIjsonMaker.mjs"
import path from "path"
import { nicerWriteFileSync } from "../../src/tools.mjs"

export default {
	ext: 'json',
	VerIdUpdater: charVer => `${charVer}-WI`,
	CharInfoHandler: (CharInfo, SavePath) => {
		let WIjsonData = v2CharWIbook2WIjson(CharInfo.data.character_book)
		delete WIjsonData.originalData
		nicerWriteFileSync(path.dirname(SavePath) + `/${CharInfo.data.character_book.name}.json`, JSON.stringify(WIjsonData))
	}
}
