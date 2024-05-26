import CardFileInfo from "../../src/cardinfo.mjs";

CardFileInfo.readCardInfo();
let adder = (a, b) => a + b
let stat = {
	data_size: (JSON.stringify(CardFileInfo.v1metaData).length / 1024.0).toFixed(2) + 'KB',
	wibook_entries_num: CardFileInfo.character_book.entries.length,
	key_num: CardFileInfo.character_book.entries.map(_ => _.keys.length + _.secondary_keys.length).reduce(adder, 0),
	total_token_size: [
		CardFileInfo.metaData.description,
		CardFileInfo.metaData.personality,
		CardFileInfo.metaData.first_mes,
		...CardFileInfo.metaData.alternate_greetings,
		...CardFileInfo.metaData.extensions.group_greetings,
		...CardFileInfo.character_book.entries.filter(_ => _.enabled).map(_ => _.content),
	].join('\n').replace(/{{\/\/([\s\S]*?)}}/g, '').replace(/\n+/g, '\n').length
}
console.log(stat);
