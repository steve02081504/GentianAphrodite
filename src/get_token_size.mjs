import llama3Tokenizer from 'llama3-tokenizer-js'
import { styleText } from 'util'

function encode (text) {
	return llama3Tokenizer.encode(text,{eos:false,bos:false})
}
function decode (tokens) {
	return llama3Tokenizer.decode(tokens)
}
function decode_single (token) {
	return llama3Tokenizer.decode([token])
}
function free() {}
let encoder = {
	encode,
	decode,
	decode_single,
	free
}

function get_token_size(obj) {
	if (!obj) return 0
	if (Object(obj) instanceof String) return encode(obj).length
	let aret = 0
	for (let key in obj) aret += get_token_size(obj[key])
	return aret
}
function split_by_tokenize(text) {
	let tokens = encode(text)
	let result = []
	for (let token of tokens) result.push(decode_single(token))
	return result
}

let color_list = `
black
red
green
yellow
blue
magenta
cyan
white
gray
redBright
greenBright
yellowBright
blueBright
magentaBright
cyanBright
whiteBright
`.split('\n').filter(e => e)

function colorize_by_tokenize(object) {
	if (Object(object) instanceof String) {
		let string_arr = split_by_tokenize(object)
		let color_index = 0
		let result = []
		for (let string of string_arr) {
			result.push(styleText(color_list[color_index], string))
			color_index++
			color_index%=color_list.length
		}
		return result.join('')
	}
	else if (object instanceof Array) return object.map(e => colorize_by_tokenize(e))
	else if (object instanceof Object) {
		let result = {}
		for (let key in object) result[key] = colorize_by_tokenize(object[key])
		return result
	}
	else return object
}

export {
	encoder,
	get_token_size,
	split_by_tokenize,
	colorize_by_tokenize
}
