import { Jieba, TfIdf } from 'npm:@node-rs/jieba'
import { dict, idf } from 'npm:@node-rs/jieba/dict.js'

const jieba = Jieba.withDict(dict)
const tfIdf = TfIdf.withDict(idf)

/**
 * @namespace jieba
 */
export default {
	/**
	 * 从文本中提取关键词。
	 * @param {string} text - 要提取关键词的文本。
	 * @param {number} num - 要提取的关键词数量。
	 * @returns {Array<{word: string, weight: number}>} - 一个包含关键词和权重的对象数组。
	 */
	extract: (text, num) => tfIdf.extractKeywords(jieba, text, num).map(({ keyword, weight }) => ({ word: keyword, weight: weight * 5 })),
}
