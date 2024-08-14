import { Tiktoken } from "tiktoken/lite"
import o2000k_base from "tiktoken/encoders/o200k_base"
import { styleText } from 'util'

var encoder = new Tiktoken(o2000k_base.bpe_ranks, o2000k_base.special_tokens, o2000k_base.pat_str)
var text_decoder = new TextDecoder()

function get_token_size(obj) {
	if (!obj) return 0
	if (Object(obj) instanceof String) return encoder.encode(obj).length
	let aret = 0
	for (let key in obj) aret += get_token_size(obj[key])
	return aret
}
function encoder_free() {
	encoder.free()
}
function split_by_tokenize(text) {
	let tokens = encoder.encode(text)
	let result = []
	for (let token of tokens) result.push(text_decoder.decode(encoder.decode_single_token_bytes(token)))
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
	colorize_by_tokenize,
	encoder_free
}
