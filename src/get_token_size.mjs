import { Tiktoken } from "tiktoken/lite";
import o2000k_base from "tiktoken/encoders/o200k_base";

var encoder = new Tiktoken(o2000k_base.bpe_ranks, o2000k_base.special_tokens, o2000k_base.pat_str);

function get_token_size(str_array) {
	if (!str_array) return 0
	if (str_array instanceof Array) str_array = str_array.filter(_ => _?.length).join('\n')
	return encoder.encode(str_array).length
}
function encoder_free() {
	encoder.free()
}

export {
	get_token_size,
	encoder_free
}
