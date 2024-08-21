import { read } from './character-card-parser.mjs'
import { arraysEqual, deepCopy, parseRegexFromString, remove_simple_marcos } from './tools.mjs'
import lz from 'lz-string'
const { compressToUTF16 } = lz
import { GetV1CharDataFromV2, WorldInfoEntry, world_info_position, regex_placement } from './charData.mjs'
import { get_token_size, encoder } from './get_token_size.mjs'

const DEFAULT_DEPTH = 0

export async function char_grader(arg, progress_stream = console.log) {
	progress_stream("Initializing...")
	let cardsize = 0
	if (arg instanceof Blob) arg = new Uint8Array(await arg.arrayBuffer())
	if (arg instanceof ArrayBuffer || arg instanceof Uint8Array) {
		cardsize = arg.byteLength
		arg = read(arg)
	}
	if (Object(arg) instanceof String) arg = JSON.parse(arg.replace(/\\r\\n/g, '\\n'))
	/** @type {import('./charData.mjs').v1CharData} */
	let char = arg
	if (char.data && !char.description) char = GetV1CharDataFromV2(char.data)
	var score_details = {
		full_data: char,
		full_text: '',
		name: char.name,
		version: char?.data?.character_version,
		creator: char?.data?.creator,
		tags: char?.tags || [],
		index: char?.creatorcomment,
		logs: [],
		score: 0
	}
	progress_stream("Removeing useless datas...")
	char = remove_simple_marcos(char)
	let format_text = char.description || ''
	let wibook_entries = deepCopy(char.data?.character_book?.entries) || []
	if (char?.data?.character_book?.entries) {
		wibook_entries = wibook_entries.filter(_ => _.keys !== undefined)
		for (const entry of wibook_entries) {
			entry.keys = entry.keys.filter(_ => _.length > 0).sort()
			entry.secondary_keys = entry.secondary_keys.filter(_ => _.length > 0).sort()
			if (!entry.constant && !entry.keys.length) entry.enabled = false
		}
		wibook_entries = wibook_entries.filter(_ => _.enabled && _.content).sort((a, b) => a.insertion_order - b.insertion_order)
		progress_stream("Marging WI data...")
		let new_book = []
		let index = 0
		for (const entry of wibook_entries) {
			let last_entry = new_book[index - 1]
			if (
				last_entry &&
				arraysEqual(entry.keys, last_entry.keys) &&
				arraysEqual(entry.secondary_keys, last_entry.secondary_keys) &&
				entry.constant === last_entry.constant &&
				entry.position === last_entry.position
			)
				last_entry.content += '\n' + entry.content

			else {
				new_book.push(entry)
				index++
			}
		}
		new_book.forEach(entry => entry.tokenized_content = encoder.encode(entry.content))
		wibook_entries = new_book
		format_text += wibook_entries.filter(_ => _.constant).map(_ => _.content).filter(_ => _?.length).join('\n')
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
			type: title,
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
	let format_text_length = encoder.encode(format_text).length
	GradingByTokenSize('description & constant WI infos', [
		format_text
	], 1, 9037)
	char.mes_example = char.mes_example || ""
	char.mes_example = char.mes_example.split(/<START>/i)
	BaseGradingByTokenSize('mes_example', char.mes_example, 0.65)
	let superLargeMes = char.mes_example.filter(_ => encoder.encode(_).length > 2500)
	if (superLargeMes.length)
		do_reparation('some mes_example is too large', superLargeMes.map(_ => encoder.encode(_).length).reduce((a, b) => a + b), 0.65)
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
			do_reparation(`format: ${format_str}`, json_score * 4 + xml_score * 1.7 + yaml_score * 3.2)
		}
	}

	let related_names = [
		char.name, 'char', 'user', '你'
	]
	let related_regex = new RegExp(`(${related_names.join('|')})`, 'g')
	let quoted_regex = /(\"[^\"]+\")|([\”\“][^\”\“]+[\”\“])/g
	function is_related(entry) {
		let str = entry.content
		let matched = str.replace(quoted_regex, '').match(related_regex)
		return matched?.length > entry.tokenized_content.length / 201
	}
	let is_persona_card_x = format_text.match(related_regex)?.length || 1.8
	if (format_text.match(/not a specific character|Role Play Game system|RPG游戏系统|不是(一个|)特定(的|)角色|扮演[^\n]+(手机应用|app)/i))
		is_persona_card_x /= 6
	else if (format_text.split('\n').slice(0, 4).join('\n').match(/\b(character|assistant needs to advance the story using)\b/i))
		is_persona_card_x *= 1.5
	let is_persona_card_y = format_text_length / 97
	let is_persona_card = is_persona_card_x >= is_persona_card_y
	progress_stream(`[info] ${char.name} is ${is_persona_card ? '' : 'not '} a persona card: x=${is_persona_card_x}, y=${is_persona_card_y}`)

	let green_wibook_entries = wibook_entries.filter(_ => !_.constant)
	wi_grading: if (green_wibook_entries?.length) {
		let wibook_entries = green_wibook_entries
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
		let match_whole_words_missing_num = 0
		let prevent_recursion_missing_num = 0
		for (let entry of wibook_entries) {
			entry.keys = [...new Set(entry.keys)]
			entry.secondary_keys = [...new Set(entry.secondary_keys)]
			key_array.push(...entry.keys)
			key_array.push(...entry.secondary_keys)
			let warning_keys = []
			if (entry.extensions.match_whole_words !== false)
				for (let key of [...entry.keys, ...entry.secondary_keys])
					if (parseRegexFromString(key)) continue
					else if (/\p{Unified_Ideograph}/u.test(key))
						warning_keys.push(key)
			let entry_name = get_entrie_names([entry])
			if (warning_keys.length) {
				progress_stream(`[warning] the key${warning_keys.length > 1 ? 's' : ''} '${warning_keys.join("', '")}' of WI entry '${entry_name}' contains Chinese like character, but match_whole_words is not false, that's may not be what you want.`)
				match_whole_words_missing_num++
			}
			let is_LN = !/$<-(<WI(推理节点|推理節點|LogicalNode)(：|:)([\\s\\S]+?)>|[0-9a-z]{6})->\s*^/g.test(entry.content)
			if (!entry.extensions.prevent_recursion && !is_LN) {
				progress_stream(`[warning] the WI entry '${entry_name}' not an WI LogicalNode and not set prevent_recursion, that's may not be what you want.`)
				prevent_recursion_missing_num++
			}
		}
		if (match_whole_words_missing_num)
			do_reparation('match_whole_words missing', match_whole_words_missing_num, 7)
		if (prevent_recursion_missing_num)
			do_reparation('prevent_recursion missing', prevent_recursion_missing_num, 7)
		let unique_keys = [...new Set(key_array)]
		let key_num = unique_keys.length
		BaseGrading('unique_key_num', key_num, 'unique keys', 2, 0, 1 / 1.15)
		key_num = key_array.length - key_num
		BaseGrading('multi_time_key_num', key_num, 'multi time keys', 0.4)
		for (let key of unique_keys)
			if (key.match(/、|，/gi))
				progress_stream(`[warning] the key '${key}' contains '、' or '，', that's may not be what you want, use ',' instead?`)
		let gWI_size = wibook_entries.map(_ => _.tokenized_content.length).reduce((a, b) => a + b)
		let gWI_score = Math.pow(gWI_size, 1 / 1.15)
		BaseGrading("greenWI_total_token_size", gWI_size, "token size", 1, 20, 1 / 1.15)

		let unrelated_entries = wibook_entries.filter(_ => _.tokenized_content.length > 27 && !is_related(_))
		if (is_persona_card && unrelated_entries.length / wibook_entries.length >= 0.7) {
			do_reparation('greenWI too much unrelated entries', gWI_score, 1.4, 1)
			break wi_grading
		}
		if (is_persona_card) {
			if (unrelated_entries.length > 0) {
				let size = unrelated_entries.map(_ => _.tokenized_content.length).reduce((a, b) => a + b)
				let diff = Math.pow(gWI_size - size, 1 / 1.15)
				gWI_score = Math.abs(gWI_score - diff)
				do_reparation(`greenWI ${get_entrie_names(unrelated_entries)} not directly related to ${char.name} or user`, gWI_score)
				gWI_size -= size
			}
			wibook_entries = wibook_entries.filter(_ => !unrelated_entries.includes(_))
		}

		let superLargeEntries = wibook_entries.filter(_ => _.tokenized_content.length > 2310)
		if (superLargeEntries.length > 0) {
			let size = superLargeEntries.map(_ => _.tokenized_content.length).reduce((a, b) => a + b)
			let diff = Math.pow(gWI_size - size, 1 / 1.15)
			gWI_score = Math.abs(gWI_score - diff)
			do_reparation(`greenWI ${get_entrie_names(superLargeEntries)} too large`, gWI_score)
			gWI_size -= size
		}
		// wibook_entries = wibook_entries.filter(_ => !superLargeEntries.includes(_))
	}
	if (charData?.alternate_greetings)
		BaseGrading('alternate_greetings', charData.alternate_greetings.length, 'alternate greetings', 30)
	let group_greetings_set = new Set([...(charData?.extensions?.group_greetings ?? []), ...(charData?.group_only_greetings ?? [])].filter(x => x))
	if (group_greetings_set.size > 0)
		BaseGrading('group_greetings', group_greetings_set.size, 'group greetings', 20)
	// 通过gzip压缩人物数据来得知数据冗余度，比较压缩率来同步缩放分数
	let WIs = char.data?.character_book?.entries?.filter(_ => _.enabled) || []
	if (charData?.extensions?.regex_scripts) {
		let WI_regex_scripts = charData.extensions.regex_scripts.filter(e => e.placement.includes(regex_placement.WORLD_INFO))
		for (let script of WI_regex_scripts) script.findRegex = parseRegexFromString(script.findRegex)
		for (let e of WIs)
			for (let script of WI_regex_scripts)
				e.content = e.content.replace(script.findRegex, script.replaceString)
		WIs = WIs.filter(e => e.content)
	}
	let mes_examples = charData.mes_example.split(/\n<START>/gi).map(e => e.trim()).filter(e => e)
	let before_EMEntries = []
	let after_EMEntries = []
	let ANTopEntries = []
	let ANBottomEntries = []
	let WIDepthEntries = []
	let WIs_before_char = []
	let WIs_after_char = []
	function add_WI(
		/** @type {WorldInfoEntry} */
		entry
	) {
		let content = entry.content
		switch (entry.extensions.position) {
			case world_info_position.atDepth: {
				const existingDepthIndex = WIDepthEntries.findIndex((e) => e.depth === (entry.depth ?? DEFAULT_DEPTH) && e.role === entry.extensions.role)
				if (existingDepthIndex !== -1)
					WIDepthEntries[existingDepthIndex].entries.unshift(content)
				else
					WIDepthEntries.push({
						depth: entry.extensions?.depth || 0,
						entries: [content],
						role: entry.extensions.role,
					})

				break
			}
			default:
				[
					WIs_before_char,
					WIs_after_char,
					ANTopEntries,
					ANBottomEntries,
					null,
					before_EMEntries,
					after_EMEntries
				][entry.extensions.position].unshift(entry)
				break
		}
	}
	WIs = WIs.sort((a, b) => a.extensions.position - b.extensions.position || a.insertion_order - b.insertion_order)
	for (let WI of WIs) add_WI(WI)

	WIs_before_char = WIs_before_char.sort((a, b) => a.insertion_order - b.insertion_order).map(e => e.content)
	WIs_after_char = WIs_after_char.sort((a, b) => a.insertion_order - b.insertion_order).map(e => e.content)
	before_EMEntries = before_EMEntries.map(e => e.content)
	after_EMEntries = after_EMEntries.map(e => e.content)
	ANTopEntries = ANTopEntries.map(e => e.content)
	ANBottomEntries = ANBottomEntries.map(e => e.content)

	let aothr_notes = charData?.extensions?.depth_prompt?.prompt
	if (aothr_notes)
		aothr_notes = `${ANTopEntries.join('\n')}\n${aothr_notes}\n${ANBottomEntries.join('\n')}`.replace(/(^\n)|(\n$)/g, '')

	let new_chat_log = []
	for (let index = 0; index < 1000; index++) {
		let WIDepth = WIDepthEntries.filter((e) => e.depth === index)
		for (let entrie of WIDepth) {
			let role = ['system', 'user', 'assistant'][entrie.role]
			new_chat_log.unshift({
				role: role,
				content: entrie.entries.join('\n'),
			})
		}
		if (charData?.extensions?.depth_prompt?.prompt && index == charData?.extensions?.depth_prompt?.depth)
			new_chat_log.unshift({
				role: charData?.extensions?.depth_prompt?.role,
				content: aothr_notes
			})
	}

	mes_examples = [...before_EMEntries, ...mes_examples, ...after_EMEntries].filter(e => e)

	let gzip_text = [
		charData?.system_prompt,
		...WIs_before_char,
		char.personality, char.scenario,
		char.description,
		...WIs_after_char,
		...mes_examples,
		...new_chat_log.map(e => e.role + ':\n' + e.content),
		char.first_mes,
		...(charData?.alternate_greetings || []),
		...group_greetings_set,
	].filter(_ => _?.length).join('\n')
	if (gzip_text.length) { // wtf
		if (WIs.filter(_ => _.tanji).length == 0)
			score_details.full_text = gzip_text
		else {
			let disabled_WIs = char.data?.character_book?.entries?.filter(_ => !_.enabled)
			let rand_result = Math.floor(Math.random() * disabled_WIs.length)
			score_details.full_text = disabled_WIs[rand_result]?.content || ''
		}
		let compressed = compressToUTF16(gzip_text)
		let compress_ratio = compressed.length / gzip_text.length
		score_details.score *= compress_ratio
		score_details.logs.push({
			type: 'compress_ratio',
			scale: compress_ratio
		})
		progress_stream(`compress_ratio: ${compress_ratio}, all scores scaled as ${compress_ratio}.`)
		let img_regexs = [
			/data:image\/png;base64,/ig,
			/\w+\.(png|jpg|jpeg)/ig
		]
		let image_set = new Set()
		for (let regex of img_regexs) {
			let imgs = gzip_text.match(regex)
			if (imgs)
				for (let img of imgs)
					image_set.add(img)
		}
		let image_count = image_set.size
		if (image_count > 0) {
			// 通过png数量来追加分数
			BaseGrading('image count', image_count, 'pictures', 20, 0, 0.75)
			score_details.image_count = image_count
		}

		let video_regexs = [
			/data:video\/mp4;base64,/ig,
			/\w+\.(mp4|webm|mkv|mov|avi|flv|wmv|mpeg|mpg|3gp)/ig
		]
		let video_set = new Set()
		for (let regex of video_regexs) {
			let videos = gzip_text.match(regex)
			if (videos)
				for (let video of videos)
					video_set.add(video)
		}
		let video_count = video_set.size
		if (video_count > 0) {
			// 通过mp4数量来追加分数
			BaseGrading('video count', video_count, 'videos', 40, 0, 0.80)
			score_details.video_count = video_count
		}
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
		_ => (!_.match(/http|Discord|GitHub|类脑|Telegram|社区|盈利|作者|盗卡|脑瘫|改我卡|抄我卡|改卡|抄卡/i)) && _.trim().length && _ != "Creator's notes go here."
	).join('\n').replace(char.name, '').replace(char.data.creator, '')
	if (cleard_creatorcomment)
		BaseGrading('creatorcomment', encoder.encode(cleard_creatorcomment).length, 'bytes', 1 / 125, 5, 1 / 1.03)
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
	if (char.data.character_version.length > 13) {
		let diff = -9
		score_details.score += diff
		score_details.logs.push({
			type: 'character_version too long',
			score: diff
		})
		progress_stream(`character_version too long: ${diff} scores.`)
	}

	if (is_persona_card) {
		let content_text = ''
		if (wibook_entries.length)
			content_text = wibook_entries.filter(_ => _.enabled && (_.content.match(new RegExp(`name\\s*(:|：)\\s*${score_details.name}`, 'i')) || !_.content.match(/name\s*(:|：)/i)) && !_.content.includes('a NPC in this story') && !_.comment.startsWith('NPC ')).map(_ => _.content).filter(_ => _?.length).join('\n')
		content_text = [
			char.description, char.mes_example,
			char.personality, char.scenario,
			charData?.system_prompt, charData?.extensions?.depth_prompt?.prompt,
			content_text
		].filter(_ => _?.length).join('\n')
		function regex_prop_finder(prop_name, regexs, {
			match_do = _ => score_details[prop_name] = _,
			else_do = () => progress_stream(`[info] can't find the ${prop_name} of ${score_details.name}.`)
		} = {}) {
			let result
			for (const regex of regexs) {
				result = content_text.match(regex)
				if (result) break
			}
			if (result)
				return match_do(result.groups[prop_name])
			else
				return else_do()
		}
		regex_prop_finder('sex', [
			/(virginity|童贞|性经验)\s*(:|：)\s*(?<sex>处男|处女)/i,
			/(sex|gender|性别)\s*(:|：)\s*(?<sex>男|女|male|female|woman|man)/i,
			/(virginity|童贞|性经验)\s*(:|：)\s*"(?<sex>处男|处女)"/i,
			/(sex|gender|性别)\s*(:|：)\s*"(?<sex>男|女|male|female|woman|man)"/i,
		], {
			else_do: () => {
				if (char.tags.filter(_ => _.match(/^(男性|男性角色|male)$/i)).length)
					score_details.sex = 'male'
				else if (char.tags.filter(_ => _.match(/^(女性|女性角色|female)$/i)).length)
					score_details.sex = 'female'
				if (score_details.sex) return
				let male_match_words = 'man,boy,gentleman,him,he,his,Handsome,Abs,Muscle,Brawny,Dick,Fit,Strong,Dashing,Cold,male'.split(',')
				let male_match_words_chinese = '他的,腹肌,俊美,英俊,腹肌,肌肉,壮硕,大屌,健硕,强壮,潇洒,冷酷,稳重,大方,克制.坚韧,隐忍,包容'.split(',')
				let female_match_words = 'long hair,woman,girl,milf,she,her,hers,Female,Beautiful,cute,adorable,pretty,delicate,tits,boob,pigeon,plump,flirty,slutty,petite,heartfelt,sweet,sly,pussy,ponytail'.split(',')
				let female_match_words_chinese = '罩杯,长发,吹弹可破,少女,女生,萝莉,她,美丽,萌,可爱,漂亮,娇嫩,奶子,巨乳,乳鸽,丰满,妩媚,淫荡,娇小,心机,甜美,狡黠,平胸,女生,小穴,马尾'.split(',')
				let male_related_regex = new RegExp(`(\b(${male_match_words.join('|')})\b)|(${male_match_words_chinese.join('|')})`, 'gi')
				let female_related_regex = new RegExp(`(\b(${female_match_words.join('|')})\b)|(${female_match_words_chinese.join('|')})`, 'gi')
				let male_count = content_text.match(male_related_regex)?.length || 0
				let female_count = content_text.match(female_related_regex)?.length || 0
				if (male_count > female_count)
					score_details.sex = 'male'
				else if (male_count <= female_count)
					score_details.sex = 'female'
				progress_stream(`[info] sex of ${score_details.name}: ${score_details.sex}. (male_score: ${male_count}, female_score: ${female_count})`)
			}
		})
		regex_prop_finder('age', [
			/age\s*(:|：)\s*(About|around|)\s*(?<age>[\d\+]+(多|个月|月|周|天|小时|分钟|分|month|week|day|hour|minute|)(s|))/i,
			/年龄\s*(:|：)\s*(约|大约|)\s*(?<age>[\d\+]+(多|个月|月|周|天|小时|分钟|分|month|week|day|hour|minute|)(s|))/,
			/age\s*(:|：)\s*(About|around|)\s*"(?<age>[\d\+]+(多|个月|月|周|天|小时|分钟|分|month|week|day|hour|minute|)(s|))"/i,
			/年龄\s*(:|：)\s*(约|大约|)\s*"(?<age>[\d\+]+(多|个月|月|周|天|小时|分钟|分|month|week|day|hour|minute|)(s|))"/,
			/(?<age>[\d\+]+(多|))\s*岁/,
			/actual(:|：)(?<age>[\d\+]+(多|))\s*years old/i,
			/(?<age>[\d\+]+(多|))\s*years old/i,
			/活了(不下|)\s*(?<age>[\d\+]+(多|))\s*(年|岁|)/,
		])
		regex_prop_finder('blood_type', [
			/血型\s*(:|：)\s*(?<blood_type>(A|B|O|AB|\rh\+|rh\-)[^\n]*(A|B|O|AB|\rh\+|rh\-|))/i,
			/血型(算|)是\s*(?<blood_type>(A|B|O|AB|\rh\+|rh\-)[^\n]*(A|B|O|AB|\rh\+|rh\-|))/i,
			/blood\s*type\s*(:|：)\s*(?<blood_type>(A|B|O|AB|\rh\+|rh\-)[^\n]*(A|B|O|AB|\rh\+|rh\-|))/i,
			/blood\s*type\s*is\s*(?<blood_type>(A|B|O|AB|\rh\+|rh\-)[^\n]*(A|B|O|AB|\rh\+|rh\-|))/i
		])
		regex_prop_finder('tall', [
			/身(高|长)\s*(:|：|)\s*(约|大约|)\s*(?<tall>\d+\.?\d*\s*(cm|厘米|英尺|dm|m|km|光年|分米|米|千米|km|公里|英里|\s*foot|))/i,
			/height\s*(:|：)\s*(About|around|)\s*(?<tall>\d+\.?\d*\s*(cm|厘米|英尺|dm|m|km|光年|分米|米|千米|km|公里|英里|\s*foot|))/i,
			/height\s*is\s*(About|around|)\s*(?<tall>\d+\.?\d*\s*(cm|厘米|英尺|dm|m|km|光年|分米|米|千米|km|公里|英里|\s*foot|))/i,
			/tall\s*(:|：)\s*(About|around|)\s*(?<tall>\d+\.?\d*\s*(cm|厘米|英尺|dm|m|km|光年|分米|米|千米|km|公里|英里|\s*foot|))/i,
			/tall\s*is\s*(About|around|)\s*(?<tall>\d+\.?\d*\s*(cm|厘米|英尺|dm|m|km|光年|分米|米|千米|km|公里|英里|\s*foot|))/i,
			/height\s*(:|：)\s*"(About|around|)\s*(?<tall>\d+\.?\d*\s*(cm|厘米|英尺|dm|m|km|光年|分米|米|千米|km|公里|英里|\s*foot|))"/i,
			/tall\s*(:|：)\s*"(About|around|)\s*(?<tall>\d+\.?\d*\s*(cm|厘米|英尺|dm|m|km|光年|分米|米|千米|km|公里|英里|\s*foot|))"/i,
		])
		regex_prop_finder('weight', [
			/体重\s*(:|：|)\s*(约|大约|)\s*(?<weight>\d+\.?\d*\s*(kg|千克|公斤|g|克|斤|t|吨|))/i,
			/weight\s*(:|：)\s*(About|around|)\s*(?<weight>\d+\.?\d*\s*(kg|千克|公斤|g|克|斤|t|吨|))/i,
			/weight\s*is\s*(About|around|)\s*(?<weight>\d+\.?\d*\s*(kg|千克|公斤|g|克|斤|t|吨|))/i,
			/weight\s*(:|：)\s*"(About|around|)\s*(?<weight>\d+\.?\d*\s*(kg|千克|公斤|g|克|斤|t|吨|))"/i,
		])
		regex_prop_finder('birthday', [
			/(生日|birthday)[^\n]+(?<birthday>(\d+月(-|)\d+日)|((Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[^\d\n]+\d+(th|st|nd|rd)))/i,
		])
		regex_prop_finder('bwh', [
			/(?<bwh>\d+b-\d+w-\d+h)/i,
			/(bwh|三围|三维)\s*(:|：|)\s*(约|大约|)\s*(?<bwh>\d+-\d+-\d+)/i,
			/bwh\s*is\s*(About|around|)\s*(?<bwh>\d+-\d+-\d+)/i,
			/(bwh|三围|三维)\s*(:|：|)\s*"(About|around|约|大约|)\s*(?<bwh>\d+-\d+-\d+)"/i,
		], {
			else_do: _ => {
				let return_with_no_output = { match_do: _ => _, else_do: _ => _ }
				let beast = regex_prop_finder('beast', [
					/胸围\s*(:|：|)\s*(约|大约|)\s*(?<beast>\d+(cm|厘米|英尺|dm|m|km|光年|分米|米|千米|km|公里|英里|))/i,
					/beast\s*(:|：)\s*(About|around|)\s*(?<beast>\d+(cm|厘米|英尺|dm|m|km|光年|分米|米|千米|km|公里|英里|))/i,
					/beast\s*is\s*(About|around|)\s*(?<beast>\d+(cm|厘米|英尺|dm|m|km|光年|分米|米|千米|km|公里|英里|))/i,
					/胸围\s*(:|：|)\s*"(约|大约|)\s*(?<beast>\d+(cm|厘米|英尺|dm|m|km|光年|分米|米|千米|km|公里|英里|))"/i,
					/beast\s*(:|：)\s*"(About|around|)\s*(?<beast>\d+(cm|厘米|英尺|dm|m|km|光年|分米|米|千米|km|公里|英里|))"/i,
				], return_with_no_output)
				//腰围
				let waist = regex_prop_finder('waist', [
					/腰围\s*(:|：|)\s*(约|大约|)\s*(?<waist>\d+(cm|厘米|英尺|dm|m|km|光年|分米|米|千米|km|公里|英里|))/i,
					/waist\s*(:|：)\s*(About|around|)\s*(?<waist>\d+(cm|厘米|英尺|dm|m|km|光年|分米|米|千米|km|公里|英里|))/i,
					/waist\s*is\s*(About|around|)\s*(?<waist>\d+(cm|厘米|英尺|dm|m|km|光年|分米|米|千米|km|公里|英里|))/i,
					/腰围\s*(:|：|)\s*"(约|大约|)\s*(?<waist>\d+(cm|厘米|英尺|dm|m|km|光年|分米|米|千米|km|公里|英里|))"/i,
					/waist\s*(:|：)\s*"(About|around|)\s*(?<waist>\d+(cm|厘米|英尺|dm|m|km|光年|分米|米|千米|km|公里|英里|))"/i,
				], return_with_no_output)
				//臀围
				let hip = regex_prop_finder('hip', [
					/臀围\s*(:|：|)\s*(约|大约|)\s*(?<hip>\d+(cm|厘米|英尺|dm|m|km|光年|分米|米|千米|km|公里|英里|))/i,
					/hip\s*(:|：)\s*(About|around|)\s*(?<hip>\d+(cm|厘米|英尺|dm|m|km|光年|分米|米|千米|km|公里|英里|))/i,
					/hip\s*is\s*(About|around|)\s*(?<hip>\d+(cm|厘米|英尺|dm|m|km|光年|分米|米|千米|km|公里|英里|))/i,
					/臀围\s*(:|：|)\s*"(约|大约|)\s*(?<hip>\d+(cm|厘米|英尺|dm|m|km|光年|分米|米|千米|km|公里|英里|))"/i,
					/hip\s*(:|：)\s*"(About|around|)\s*(?<hip>\d+(cm|厘米|英尺|dm|m|km|光年|分米|米|千米|km|公里|英里|))"/i,
				], return_with_no_output)
				if (beast || waist || hip) {
					score_details.bwh = `${beast || '?'}b-${waist || '?'}w-${hip || '?'}h`
					progress_stream(`[info] bwh of ${score_details.name}: ${score_details.bwh}.`)
				}
				else
					progress_stream(`[info] can't find the bwh of ${score_details.name}.`)
			}
		})
	}
	return score_details
}
