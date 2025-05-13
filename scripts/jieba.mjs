import { Jieba, TfIdf } from 'npm:@node-rs/jieba'
import { dict, idf } from 'npm:@node-rs/jieba/dict.js'

const jieba = Jieba.withDict(dict)
const tfIdf = TfIdf.withDict(idf)

export default {
	extract: (text, num) => tfIdf.extractKeywords(jieba, text, num).map(({ keyword, weight }) => ({ word: keyword, weight: weight * 5 })),
}
