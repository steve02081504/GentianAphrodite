import { read } from './character-card-parser.mjs';
import { arraysEqual, remove_simple_marcos } from './tools.mjs';
import lzString from 'lz-string';
import get_token_size from './get_token_size.mjs';


export function char_grader(arg, progress_stream = console.log) {
	progress_stream("Initializing...")
	let cardsize = 0;
	if (arg instanceof ArrayBuffer || arg instanceof Uint8Array) {
		cardsize = arg.byteLength
		arg = read(arg);
	}
	if (Object(arg) instanceof String) arg = JSON.parse(arg.replace(/\\r\\n/g, '\\n'));
	/** @type {import('./charData.mjs').v1CharData} */
	let char = arg
	var score_details = {
		name: char.name,
		tags: char?.tags || [],
		index: char?.creatorcomment,
		logs: [],
		score: 0
	}
	progress_stream("Removeing useless datas...")
	char = remove_simple_marcos(char)
	let format_text = char.description
	if (char?.data?.character_book?.entries) {
		char.data.character_book.entries = char.data.character_book.entries.filter(_ => _.keys !== undefined)
		for (const entry of char.data.character_book.entries) {
			entry.keys = entry.keys.filter(_ => _.length > 0).sort()
			entry.secondary_keys = entry.secondary_keys.filter(_ => _.length > 0).sort()
			if (!entry.constant && !entry.keys.length) entry.enabled = false
		}
		char.data.character_book.entries = char.data.character_book.entries.filter(_ => _.enabled && _.content).sort((a, b) => a.insertion_order - b.insertion_order)
		progress_stream("Marging WI data...")
		let new_book = []
		let index = 0
		for (const entry of char.data.character_book.entries) {
			let last_entry = new_book[index - 1]
			if (
				last_entry &&
				arraysEqual(entry.keys, last_entry.keys) &&
				arraysEqual(entry.secondary_keys, last_entry.secondary_keys) &&
				entry.constant === last_entry.constant &&
				entry.position === last_entry.position
			) {
				last_entry.content += '\n' + entry.content
			}
			else {
				new_book.push(entry)
				index++
			}
		}
		char.data.character_book.entries = new_book
		format_text += char.data.character_book.entries.filter(_ => _.constant).map(_ => _.content).join('\n')
	}
	progress_stream("Grading...")
	function BaseGrading(title, data, data_type = 'tokens', scale = 1, base_score = 0, pow = 1) {
		let score = Math.pow(data, pow) * scale + base_score
		if (isNaN(score)) throw new Error(`NaN generated in BaseGrading, args: ${title}, ${data}, ${data_type}, ${scale}, ${base_score}, ${pow}`)
		score_details.score += score
		progress_stream(`${title}: ${data} ${data_type}, ${score} scores.`)
		score_details.logs.push({
			type: title,
			score: score
		})
		return data
	}
	function BaseGradingByTokenSize(title, str_array, scale = 1, base_score = 0, pow = 1) {
		let size = get_token_size(str_array)
		return BaseGrading(title, size, 'tokens', scale, base_score, pow)
	}
	function do_reparation(title, size, scale = 1, reparation_scale = 1 / 1.03) {
		let diff = Math.pow(size, reparation_scale) * scale
		if (isNaN(diff))
			throw new Error(`NaN generated in do_reparation, args: ${title}, ${size}, ${scale}, ${reparation_scale}`)
		score_details.score -= diff
		score_details.logs.push({
			type: `${title} too large`,
			score: -diff
		})
		progress_stream(`[reparation] ${title}: ${-diff} scores.`)
		return diff
	}
	function GradingByTokenSize(title, str_array, scale = 1, reparation_startsize = 450, reparation_scale = 1 / 1.03) {
		let size = BaseGradingByTokenSize(title, str_array, scale)
		if (size >= reparation_startsize)
			do_reparation(title + ' too large', size, scale, reparation_scale)
		return size
	}
	let format_text_length = get_token_size(format_text)
	GradingByTokenSize('description & constant WI infos', [
		format_text
	], 1, 9037)
	char.mes_example = char.mes_example || ""
	char.mes_example = char.mes_example.split(/<START>/i)
	BaseGradingByTokenSize('mes_example', char.mes_example, 0.65)
	let superLargeMes = char.mes_example.filter(_ => get_token_size(_) > 2500)
	if (superLargeMes.length)
		do_reparation('some mes_example is too large', superLargeMes.map(_ => get_token_size(_)).reduce((a, b) => a + b), 0.65)
	GradingByTokenSize('personality & scenario', [
		char.personality, char.scenario
	], 0.5)
	let charData = char.data
	GradingByTokenSize('system_prompt & depth_prompt', [
		charData?.system_prompt, charData?.extensions?.depth_prompt?.prompt
	], 0.3)
	if (format_text.includes('\n    ') || format_text.includes('\n\t\t')) {
		let yaml_score = format_text.match(/\n\s+-\s*\S/g)?.length || 0
		let json_score_p1 = format_text.match(/\"\,\s*\n/g)?.length || 0
		let json_score_p2 = format_text.match(/\{\s*\n/g)?.length || 0
		let json_score = json_score_p1 + json_score_p2
		let xml_score = format_text.match(/<([^>]*)>[^<]*<(\/|\\)\1>/g)?.length || 0
		let format_str = ''
		let all_score = yaml_score + json_score + xml_score
		if (yaml_score) {
			format_str += 'yaml'
			if (yaml_score != all_score) format_str += `(${yaml_score / all_score});`
		}
		if (json_score) {
			format_str += 'json'
			if (json_score != all_score) format_str += `(${json_score / all_score});`
		}
		if (xml_score) {
			format_str += 'xml'
			if (xml_score != all_score) format_str += `(${xml_score / all_score});`
		}
		if (format_str) {
			format_str = format_str.split(';').filter(_ => _).join('; ')
			let format_scale = (json_score * 4 + xml_score * 1.7 + yaml_score * 3.2) / format_text_length * 10
			while (format_scale > 1) format_scale /= 10
			let scale = 1 - Math.min(format_scale, 0.72)
			score_details.score *= scale
			score_details.logs.push({
				type: `format: ${format_str}`,
				scale: scale
			})
			progress_stream(`[reparation] format: ${format_str}, all scores reduced as scale ${scale}.`)
		}
	}

	let related_names = [
		char.name, 'char', 'user', '你'
	]
	let related_regex = new RegExp(`(${related_names.join('|')})`, 'g')
	let is_persona_card_x = format_text.match(related_regex)?.length
	if (format_text.includes('not a specific character, but an Role Play Game system'))
		is_persona_card_x /= 6
	let is_persona_card_y = format_text_length / 97
	let is_persona_card = is_persona_card_x >= is_persona_card_y
	progress_stream(`[info] ${char.name} is ${is_persona_card ? '' : 'not '} a persona card: x=${is_persona_card_x}, y=${is_persona_card_y}`)

	let wibook_entries = char?.data?.character_book?.entries?.filter?.(_ => !_.constant)
	wi_grading: if (wibook_entries?.length) {
		function get_entrie_names(entries) {
			let named_entries = entries.filter(_ => _.comment && !_.tanji)
			let no_name_len = entries.length - named_entries.length
			let aret = named_entries.map(_ => _.comment).join(', ')
			if (no_name_len) {
				if (aret) aret += `and`
				aret += `${no_name_len} unnamed entrie${no_name_len > 1 ? 's' : ''}`
			}
			return aret
		}
		BaseGrading('greenWI_entries', wibook_entries.length, 'green entries', 5)
		let key_array = []
		for (let entry of wibook_entries) {
			entry.keys = [...new Set(entry.keys)]
			entry.secondary_keys = [...new Set(entry.secondary_keys)]
			key_array.push(...entry.keys)
			key_array.push(...entry.secondary_keys)
			let warning_keys = []
			if (entry.extensions.match_whole_words !== false)
				for (let key of [...entry.keys, ...entry.secondary_keys])
					if (/\p{Unified_Ideograph}/u.test(key))
						warning_keys.push(key)
			let entry_name = get_entrie_names([entry])
			if (warning_keys.length)
				progress_stream(`[warning] the key${warning_keys.length > 1 ? 's' : ''} '${warning_keys.join("', '")}' of WI entry '${entry_name}' contains Chinese like character, but match_whole_words is not false, that's may not be what you want.`)
			let is_LN = !/$<-(<WI(推理节点|推理節點|LogicalNode)(：|:)([\\s\\S]+?)>|[0-9a-z]{6})->\s*^/g.test(entry.content)
			if (!entry.extensions.prevent_recursion && !is_LN)
				progress_stream(`[warning] the WI entry '${entry_name}' not an WI LogicalNode and not set prevent_recursion, that's may not be what you want.`)
			entry.tokenized_size = get_token_size(entry.content)
		}
		let unique_keys = [...new Set(key_array)]
		let key_num = unique_keys.length
		BaseGrading('unique_key_num', key_num, 'unique keys', 2, 0, 1 / 1.15)
		key_num = key_array.length - key_num;
		BaseGrading('multi_time_key_num', key_num, 'multi time keys', 0.4)
		for (let key of unique_keys)
			if (key.match(/、|，/gi))
				progress_stream(`[warning] the key '${key}' contains '、' or '，', that's may not be what you want, use ',' instead?`)
		let gWI_size = wibook_entries.map(_ => _.tokenized_size).reduce((a, b) => a + b)
		let gWI_score = Math.pow(gWI_size, 1 / 1.15)
		BaseGrading("greenWI_total_token_size", gWI_size, "token size", 1, 20, 1 / 1.15)

		let quoted_regex = /(\"[^\"]+\")|([\”\“][^\”\“]+[\”\“])/g
		function is_related(entry) {
			let str = entry.content
			let matched = str.replace(quoted_regex, '').match(related_regex)
			return matched?.length > entry.tokenized_size / 201
		}
		let unrelated_entries = wibook_entries.filter(_ => _.tokenized_size > 27 && !is_related(_))
		if (is_persona_card && unrelated_entries.length / wibook_entries.length >= 0.7) {
			do_reparation('greenWI too much unrelated entries', gWI_score, 1.4, 1)
			break wi_grading
		}
		if (is_persona_card) {
			if (unrelated_entries.length > 0) {
				let size = unrelated_entries.map(_ => _.tokenized_size).reduce((a, b) => a + b)
				let diff = Math.pow(gWI_size - size, 1 / 1.15)
				gWI_score = Math.abs(gWI_score - diff)
				do_reparation(`greenWI ${get_entrie_names(unrelated_entries)} not directly related to ${char.name} or user`, gWI_score)
				gWI_size -= size
			}
			wibook_entries = wibook_entries.filter(_ => !unrelated_entries.includes(_))
			char.data.character_book.entries = wibook_entries
		}

		let superLargeEntries = wibook_entries.filter(_ => _.tokenized_size > 2310)
		if (superLargeEntries.length > 0) {
			let size = superLargeEntries.map(_ => _.tokenized_size).reduce((a, b) => a + b)
			let diff = Math.pow(gWI_size - size, 1 / 1.15)
			gWI_score = Math.abs(gWI_score - diff)
			do_reparation(`greenWI ${get_entrie_names(superLargeEntries)} too large`, gWI_score)
			gWI_size -= size
		}
		wibook_entries = wibook_entries.filter(_ => !superLargeEntries.includes(_))
	}
	if (charData?.alternate_greetings)
		BaseGrading('alternate_greetings', charData.alternate_greetings.length, 'alternate greetings', 30)
	if (charData?.extensions?.group_greetings?.length)
		BaseGrading('group_greetings', charData.extensions.group_greetings.length, 'group greetings', 20)
	// 通过gzip压缩人物数据来得知数据冗余度，比较压缩率来同步缩放分数
	let gzip_text = [
		char.description, char.mes_example,
		char.personality, char.scenario,
		charData?.system_prompt, charData?.extensions?.depth_prompt?.prompt,
		...(char?.data?.character_book?.entries?.map?.(_ => _.content) || []),
		...(charData?.alternate_greetings || []),
		...(charData?.extensions?.group_greetings || []),
	].filter(_ => _?.length).join('\n')
	if (gzip_text.length) { // wtf
		let compressed = lzString.compressToUTF16(gzip_text)
		let compress_ratio = compressed.length / gzip_text.length
		score_details.score *= compress_ratio
		score_details.logs.push({
			type: 'compress_ratio',
			scale: compress_ratio
		})
		progress_stream(`compress_ratio: ${compress_ratio}, all scores scaled as ${compress_ratio}.`)
	}

	if (cardsize) {
		let cardsizeMB = cardsize / 1024 / 1024
		score_details.score += cardsizeMB
		BaseGrading('card size', cardsizeMB, 'MB', 0.5)
		if (cardsizeMB > 100)
			do_reparation('card size too large', cardsizeMB)
	}
	char.creatorcomment = char.creatorcomment || ""
	let cleard_creatorcomment = char.creatorcomment.split('\n').filter(
		_ => (!_.match(/http|Discord|GitHub|类脑|Telegram|社区/i)) && _.trim().length
	).join('\n')
	if (cleard_creatorcomment)
		BaseGrading('creatorcomment', get_token_size(cleard_creatorcomment), 'bytes', 1 / 125, 5)
	else {
		let diff = -50
		score_details.score += diff
		score_details.logs.push({
			type: 'creatorcomment not found',
			score: diff
		})
		progress_stream(`creatorcomment not found: ${diff} scores.`)
	}
	char.tags = char.tags || []
	let cleard_tags = char.tags.filter(
		_ => (!_.match(/、|·|，|\\|\//g)) && _.trim().length
	)
	if (cleard_tags?.length)
		BaseGrading('tags', cleard_tags.length, 'tags', 3)
	else {
		let diff = -7
		score_details.score += diff
		score_details.logs.push({
			type: 'tags not found',
			score: diff
		})
		progress_stream(`tags not found: ${diff} scores.`)
	}
	return score_details
}
