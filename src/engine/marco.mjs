// from https://github.com/SillyTavern/SillyTavern
// license as AGPL-3.0 license

import seedrandom from "seedrandom"
import { getChatIdHash, getStringHash } from "../prompt_builder.mjs"
import { replaceVariableMacros } from "./value.mjs"
import moment from "moment/moment.js"
import { chat_metadata } from "../prompt_builder.mjs"

/**
 * Replaces banned words in macros with an empty string.
 * Adds them to textgenerationwebui ban list.
 * @param {string} inText Text to replace banned words in
 * @returns {string} Text without the "banned" macro
 */
function bannedWordsReplace(inText) {
	if (!inText) return ''


	const banPattern = /{{banned "(.*)"}}/gi

	inText = inText.replaceAll(banPattern, '')
	return inText
}

function getTimeSinceLastMessage() {
	const now = moment()

	const chat = chat_metadata.chat_log
	if (Array.isArray(chat) && chat.length > 0) {
		let lastMessage
		let takeNext = false

		for (let i = chat.length - 1; i >= 0; i--) {
			const message = chat[i]

			if (message.role === 'system') continue
			if (message.role === 'user' && takeNext) {
				lastMessage = message
				break
			}

			takeNext = true
		}

		if (lastMessage?.send_date) {
			const lastMessageDate = timestampToMoment(lastMessage.send_date)
			const duration = moment.duration(now.diff(lastMessageDate))
			return duration.humanize()
		}
	}

	return 'just now'
}

function randomReplace(input, emptyListPlaceholder = '') {
	const randomPattern = /{{random\s?::?([^}]+)}}/gi

	input = input.replace(randomPattern, (match, listString) => {
		// Split on either double colons or comma. If comma is the separator, we are also trimming all items.
		const list = listString.includes('::')
			? listString.split('::')
			// Replaced escaped commas with a placeholder to avoid splitting on them
			: listString.replace(/\\,/g, '##�COMMA�##').split(',').map(item => item.trim().replace(/##�COMMA�##/g, ','))

		if (list.length === 0) return emptyListPlaceholder

		const rng = seedrandom('added entropy.', { entropy: true })
		const randomIndex = Math.floor(rng() * list.length)
		return list[randomIndex]
	})
	return input
}

function pickReplace(input, rawContent, emptyListPlaceholder = '') {
	const pickPattern = /{{pick\s?::?([^}]+)}}/gi

	// We need to have a consistent chat hash, otherwise we'll lose rolls on chat file rename or branch switches
	// No need to save metadata here - branching and renaming will implicitly do the save for us, and until then loading it like this is consistent
	const chatIdHash = getChatIdHash()
	const rawContentHash = getStringHash(rawContent)

	return input.replace(pickPattern, (match, listString, offset) => {
		// Split on either double colons or comma. If comma is the separator, we are also trimming all items.
		const list = listString.includes('::')
			? listString.split('::')
			// Replaced escaped commas with a placeholder to avoid splitting on them
			: listString.replace(/\\,/g, '##�COMMA�##').split(',').map(item => item.trim().replace(/##�COMMA�##/g, ','))

		if (list.length === 0) return emptyListPlaceholder


		// We build a hash seed based on: unique chat file, raw content, and the placement inside this content
		// This allows us to get unique but repeatable picks in nearly all cases
		const combinedSeedString = `${chatIdHash}-${rawContentHash}-${offset}`
		const finalSeed = getStringHash(combinedSeedString)
		const rng = seedrandom(finalSeed)
		const randomIndex = Math.floor(rng() * list.length)
		return list[randomIndex]
	})
}

function diceRollReplace(input, invalidRollPlaceholder = '') {
	const rollPattern = /{{roll[ : ]([^}]+)}}/gi

	return input.replace(rollPattern, (match, matchValue) => {
		let formula = matchValue.trim()

		if (isDigitsOnly(formula)) formula = `1d${formula}`

		const isValid = droll.validate(formula)

		if (!isValid) {
			console.debug(`Invalid roll formula: ${formula}`)
			return invalidRollPlaceholder
		}

		const result = droll.roll(formula)
		return new String(result.total)
	})
}

/**
 * Returns the difference between two times. Works with any time format acceptable by moment().
 * Can work with {{date}} {{time}} macros
 * @param {string} input - The string to replace time difference macros in.
 * @returns {string} The string with replaced time difference macros.
 */
function timeDiffReplace(input) {
	const timeDiffPattern = /{{timeDiff::(.*?)::(.*?)}}/gi

	const output = input.replace(timeDiffPattern, (_match, matchPart1, matchPart2) => {
		const time1 = moment(matchPart1)
		const time2 = moment(matchPart2)

		const timeDifference = moment.duration(time1.diff(time2))
		return timeDifference.humanize()
	})

	return output
}

/**
 * Substitutes {{macro}} parameters in a string.
 * @param {string} content - The string to substitute parameters in.
 * @param {Object<string, *>} env - Map of macro names to the values they'll be substituted with. If the param
 * values are functions, those functions will be called and their return values are used.
 * @returns {string} The string with substituted parameters.
 */
export function evaluateMacros(content, env) {
	if (!content) return ''

	const rawContent = content

	// Legacy non-macro substitutions
	content = content.replace(/<USER>/gi, typeof env.user === 'function' ? env.user() : env.user)
	content = content.replace(/<BOT>/gi, typeof env.char === 'function' ? env.char() : env.char)
	content = content.replace(/<CHAR>/gi, typeof env.char === 'function' ? env.char() : env.char)
	content = content.replace(/<CHARIFNOTGROUP>/gi, typeof env.group === 'function' ? env.group() : env.group)
	content = content.replace(/<GROUP>/gi, typeof env.group === 'function' ? env.group() : env.group)

	// Short circuit if there are no macros
	if (!content.includes('{{')) return content

	content = diceRollReplace(content)
	content = replaceVariableMacros(content)
	content = content.replace(/{{newline}}/gi, '\n')
	content = content.replace(/\n*{{trim}}\n*/gi, '')
	content = content.replace(/{{noop}}/gi, '')
	content = content.replace(/{{input}}/gi, () => String($('#send_textarea').val()))

	// Substitute passed-in variables
	for (const varName in env) {
		if (!Object.hasOwn(env, varName)) continue

		const param = env[varName]
		content = content.replace(new RegExp(`{{${varName}}}`, 'gi'), param)
	}

	content = content.replace(/\{\{\/\/([\s\S]*?)\}\}/gm, '')

	content = content.replace(/{{time}}/gi, () => moment().format('LT'))
	content = content.replace(/{{date}}/gi, () => moment().format('LL'))
	content = content.replace(/{{weekday}}/gi, () => moment().format('dddd'))
	content = content.replace(/{{isotime}}/gi, () => moment().format('HH:mm'))
	content = content.replace(/{{isodate}}/gi, () => moment().format('YYYY-MM-DD'))

	content = content.replace(/{{datetimeformat +([^}]*)}}/gi, (_, format) => {
		const formattedTime = moment().format(format)
		return formattedTime
	})
	content = content.replace(/{{idle_duration}}/gi, () => getTimeSinceLastMessage())
	content = content.replace(/{{time_UTC([-+]\d+)}}/gi, (_, offset) => {
		const utcOffset = parseInt(offset, 10)
		const utcTime = moment().utc().utcOffset(utcOffset).format('LT')
		return utcTime
	})
	content = timeDiffReplace(content)
	content = bannedWordsReplace(content)
	content = randomReplace(content)
	content = pickReplace(content, rawContent)

	content = replaceVariableMacros(content)

	return content
}
