import CardFileInfo from "../../src/cardinfo.mjs"

CardFileInfo.readDataFiles()
for (let v of [,'static','WIjson'])
	CardFileInfo.Build(v)
