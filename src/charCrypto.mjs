import sha256 from 'crypto-js/sha256.js';
import { v1CharData, WorldInfoEntry } from './charData.mjs';

let keyscorespliter = "__worldinfo_keyscores__"
var randomCommts = [
	"东西", '不是东西', '可能是个东西', '这到底是不是东西？', '可能不是个东西', '我是不是东西？', '我不是东西', '懂了，我是南北',
	'屎', '史记',
	'菠萝', '萝萝', '菠菠',
	'苹果', '苹苹', '果果',
	'菠萝苹果',
	'神经', '寄吧', '我是傻逼', '？', '我去'
];
let cryptoStrs = ["\u202e", "\u2066"]
let cryptoStrsX = ["\u0E4e", "\u0E49", "\u0E47"]
let mindlessStr = "毒毒杀救了我红死自杀恨死蛇猩红腐败癫狂毒杀救了我红死自杀恨死蛇混乱堕落崩溃疯和蛇病骷毒杀救？？？了我红死自杀恨死蛇髅瘟疫死毒杀救了我红死自杀恨死蛇亡毒杀救了我红死！！！！自杀恨死蛇悲剧灾难的惨恐怖事痛苦扭曲救！？—杀爱恨我你\n\n\n\n"

var RandIntLeesThan = (x, y = 0) => Math.floor(Math.random() * (x - y)) + y;
let GetRandomCryptoBaseStr = _ => cryptoStrs[Math.floor(Math.random() * cryptoStrs.length)]
let GetRandomCryptoXBaseStr = _ => cryptoStrsX[Math.floor(Math.random() * cryptoStrsX.length)].repeat(RandIntLeesThan(7))
let GetRandomCryptoStrBy = _ => {
	let aret = ''
	for (let i = 0; i < RandIntLeesThan(24); i++)
		switch (RandIntLeesThan(4)) {
			case 0:
				aret += GetRandomCryptoXBaseStr().repeat(RandIntLeesThan(9))
				i += RandIntLeesThan(7)
			case 1:
				aret += GetRandomCryptoBaseStr()
			case 2:
				aret += _.repeat(RandIntLeesThan(2))
				i += RandIntLeesThan(2)
			default:
				aret += mindlessStr[RandIntLeesThan(mindlessStr.length)].repeat(RandIntLeesThan(8))
				i += RandIntLeesThan(6)
		}
	return aret
}
let cryptoTextContent = (/** @type {string} */content) => {
	content = content.replace(/\{\{\/\/([\s\S]*?)\}\}/gm, '')
	for (let i = 0; i < content.length; i++) {
		if (content.slice(0, i).match(/\{\{[^\{\}]+$/g) || '{}'.indexOf(content[i]) != -1) continue
		if (RandIntLeesThan(7) == 6) {
			let rand = GetRandomCryptoStrBy(content[i])
			content = content.slice(0, i) + `{{//${rand}}}` + content.slice(i)
			i += rand.length + 6
		}
	}
	return content
}
let cryptoEntryContent = (/** @type {WorldInfoEntry} */entrie) => {
	entrie.content = cryptoTextContent(entrie.content)
}
let cryptoKeyList = (/** @type {string[]} */list) => {
	let aret = [];
	for (let i = 0; i < list.length; i++) {
		if (list[i].includes('{') || list[i].includes('}')) continue
		if (RandIntLeesThan(3) == 2) {
			let rand = GetRandomCryptoStrBy(list[RandIntLeesThan(list.length)])
			aret.push(`{{//${rand}}}`)
		}
		aret.push(cryptoTextContent(list[i]))
	}
	return aret
}

function CryptoCharData(/** @type {v1CharData} */v1charData) {
	let charData = v1charData.data
	let charDataStr = JSON.stringify(v1charData).replace(/<-<WI(推理节点|推理節點|LogicalNode)(：|:)([\s\S]+?)>->/g, key =>
		'<-' + sha256(charData.creator + key).toString().substring(0, 6) + '->'
	)
	v1charData = JSON.parse(charDataStr);
	charData = v1charData.data
	var book = charData.character_book.entries;
	let currentIndex = book.length;

	while (currentIndex != 0) {
		let randomIndex = RandIntLeesThan(currentIndex);
		let randomIndex2 = RandIntLeesThan(currentIndex);
		currentIndex--;

		[book[currentIndex], book[randomIndex]] = [book[randomIndex], book[currentIndex]];
		[book[currentIndex].extensions.display_index, book[randomIndex2].extensions.display_index] = [book[randomIndex2].extensions.display_index, book[currentIndex].extensions.display_index];
	}

	var uid = 0;
	let orderList = [];
	for (var entrie of book) {
		entrie.comment = randomCommts[Math.floor(Math.random() * randomCommts.length)];
		entrie.keys = entrie.keys.filter(x => x != keyscorespliter);
		entrie.keys = cryptoKeyList(entrie.keys)
		entrie.secondary_keys = entrie.secondary_keys.filter(x => x != keyscorespliter);
		entrie.secondary_keys = cryptoKeyList(entrie.secondary_keys)
		entrie.id = uid += RandIntLeesThan(7, 1);
		cryptoEntryContent(entrie);
		orderList.push(entrie.insertion_order);
	}
	orderList = [...new Set(orderList.sort((a, b) => a - b))]
	let cryptedOrderList = []
	var i = 0;
	for (var _ of orderList) cryptedOrderList.push(i += RandIntLeesThan(7, 1))
	for (var entrie of book)
		entrie.insertion_order = cryptedOrderList[orderList.indexOf(entrie.insertion_order)];
	return v1charData;
}
export default CryptoCharData
