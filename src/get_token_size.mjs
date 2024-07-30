import { Tiktoken } from "tiktoken/lite"
import o2000k_base from "tiktoken/encoders/o200k_base"

var encoder = new Tiktoken(o2000k_base.bpe_ranks, o2000k_base.special_tokens, o2000k_base.pat_str)

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

export {
	encoder,
	get_token_size,
	encoder_free
}
