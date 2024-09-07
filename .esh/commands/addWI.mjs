import CardFileInfo from "../../src/cardinfo.mjs"
import { world_info_logic, world_info_position, WorldInfoEntry } from "../../src/charData.mjs"

CardFileInfo.readDataFiles()
let book = CardFileInfo.character_book.entries
let word = process.argv[2]
var wordPathArray = word.split(/：|:|\-|(base|fin|sub|start)|（([^）]+)）|\(([^\)]+)\)/g).filter(x => x)
let def = process.argv[3]
let keys = process.argv[4]?.split(',')
if (!keys?.length) keys = []
keys.push(wordPathArray[wordPathArray.length - 1])
/** @type {WorldInfoEntry} */
let newWI = {
	id: book.length,
	keys,
	secondary_keys: [],
	comment: word,
	content: def,
	enabled: true,
	insertion_order: 0,
	extensions: {
		display_index: 0,
		position: world_info_position.after,
		selectiveLogic: world_info_logic.AND_ANY,
		scan_depth: 2,
	}
}
if (wordPathArray.length > 1) {
	let last = wordPathArray[wordPathArray.length - 1]
	let wordPathBegin = word.substring(0, word.length - last.length - 1)
	let kinds = book.filter(_ => _.comment.startsWith(wordPathBegin))
	let last_display_index = Math.max(0, ...kinds.map(_ => _.extensions.display_index))
	if (last_display_index) newWI.extensions.display_index = last_display_index + 1
	let last_insertion_order = Math.max(0, ...kinds.map(_ => _.insertion_order))
	if (last_insertion_order) newWI.insertion_order = last_insertion_order + (
		last_insertion_order == kinds.map(_ => _.insertion_order).sort((a, b) => b - a)[0] ? 0 : 1
	)
}
if (!newWI.extensions.display_index)
	newWI.extensions.display_index = book.filter(_ => _.enabled).length
book.filter(_ => _.extensions.display_index >= newWI.extensions.display_index).forEach(_ => _.extensions.display_index++)
;[...book, newWI].forEach(_ => _.id = _.extensions.display_index)
book.push(newWI)
CardFileInfo.saveDataFiles()
