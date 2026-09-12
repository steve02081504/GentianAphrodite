/**
 * 将持续时间字符串转换为毫秒数。
 * @param {string} durationString - 持续时间字符串，例如 "3 days 2 hours"。
 * @returns {number} - 毫秒数。
 */
export function parseDuration(durationString) {
	const dict = {
		seconds: 1000,
		sec: 1000,
		s: 1000,
		minutes: 60 * 1000,
		min: 60 * 1000,
		m: 60 * 1000,
		hours: 60 * 60 * 1000,
		hour: 60 * 60 * 1000,
		h: 60 * 60 * 1000,
		days: 24 * 60 * 60 * 1000,
		day: 24 * 60 * 60 * 1000,
		d: 24 * 60 * 60 * 1000,
		weeks: 7 * 24 * 60 * 60 * 1000,
		week: 7 * 24 * 60 * 60 * 1000,
		wk: 7 * 24 * 60 * 60 * 1000,
		w: 7 * 24 * 60 * 60 * 1000,
		months: 30 * 24 * 60 * 60 * 1000,
		month: 30 * 24 * 60 * 60 * 1000,
		mo: 30 * 24 * 60 * 60 * 1000,
		years: 365 * 24 * 60 * 60 * 1000,
		year: 365 * 24 * 60 * 60 * 1000,
		y: 365 * 24 * 60 * 60 * 1000,
		century: 100 * 365 * 24 * 60 * 60 * 1000,
		cent: 100 * 365 * 24 * 60 * 60 * 1000,
		c: 100 * 365 * 24 * 60 * 60 * 1000,
		秒: 1000,
		分钟: 60 * 1000,
		分: 60 * 1000,
		小时: 60 * 60 * 1000,
		时: 60 * 60 * 1000,
		时辰: 2 * 60 * 60 * 1000,
		天: 24 * 60 * 60 * 1000,
		日: 24 * 60 * 60 * 1000,
		星期: 7 * 24 * 60 * 60 * 1000,
		周: 7 * 24 * 60 * 60 * 1000,
		月: 30 * 24 * 60 * 60 * 1000,
		年: 365 * 24 * 60 * 60 * 1000,
		世纪: 100 * 365 * 24 * 60 * 60 * 1000,
	}

	let duration = 0
	for (const unit in dict) {
		const match = durationString.match(new RegExp(`(?<value>\\d+)${unit}`))
		if (match?.groups?.value) {
			duration += Number(match.groups.value) * dict[unit]
			durationString = durationString.replace(match[0], '')
		}
	}
	if (durationString.trim())
		throw new Error('Invalid duration input')

	return duration
}

const timeToStrSetting = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }

/**
 * 将日期对象格式化为本地化的日期时间字符串。
 * @param {Date|number} date - 要格式化的日期对象或时间戳。
 * @param {string} [locale] - 用于格式化的区域设置字符串。
 * @param {object} [setting=timeToStrSetting] - `toLocaleString` 的选项对象。
 * @returns {string} - 格式化后的日期时间字符串。
 */
export function timeToStr(date, locale, setting = timeToStrSetting) {
	if (['C', 'POSIX'].includes(locale) || !locale) locale = undefined
	return new Date(date).toLocaleString(locale, setting)
}

const MS_PER_SECOND = 1000
const MS_PER_MINUTE = MS_PER_SECOND * 60
const MS_PER_HOUR = MS_PER_MINUTE * 60
const MS_PER_DAY = MS_PER_HOUR * 24

// 翻译和区域设置特定配置
const translations = {
	'zh-CN': {
		day: '天', days: '天',
		hour: '小时', hours: '小时',
		minute: '分钟', minutes: '分钟',
		second: '秒', seconds: '秒',
		millisecond: '毫秒', milliseconds: '毫秒',
		separator: '',         // 不同时间单位之间的分隔符 (例如 "1天2小时" 中间没有分隔符)
		numberUnitSpace: false // 数字和单位之间是否需要空格 (例如 "1天" 中间没有空格)
	},
	'en-US': {
		day: 'day', days: 'days',
		hour: 'hour', hours: 'hours',
		minute: 'minute', minutes: 'minutes',
		second: 'second', seconds: 'seconds',
		millisecond: 'millisecond', milliseconds: 'milliseconds',
		separator: ' ',       // 不同时间单位之间的分隔符 (例如 "1 day 2 hours" 中间有空格)
		numberUnitSpace: true // 数字和单位之间是否需要空格 (例如 "1 day" 中间有空格)
	}
}

/**
 * 将毫秒差转换为本地化的、人类可读的持续时间字符串。
 * @param {number} diff - 毫秒差。
 * @param {string} [locale='en-US'] - 用于本地化的区域设置字符串。
 * @returns {string} - 格式化后的持续时间字符串。
 */
export function timeToTimeStr(diff, locale = 'en-US') {
	const effectiveLocale = translations[locale] ? locale : 'en-US'
	const unitConfig = translations[effectiveLocale]

	const days = Math.floor(diff / MS_PER_DAY)
	let remainder = diff % MS_PER_DAY

	const hours = Math.floor(remainder / MS_PER_HOUR)
	remainder %= MS_PER_HOUR

	const minutes = Math.floor(remainder / MS_PER_MINUTE)
	remainder %= MS_PER_MINUTE

	const seconds = Math.floor(remainder / MS_PER_SECOND)
	const milliseconds = remainder % MS_PER_SECOND

	const timeComponents = [
		{ value: days, singular: unitConfig.day, plural: unitConfig.days },
		{ value: hours, singular: unitConfig.hour, plural: unitConfig.hours },
		{ value: minutes, singular: unitConfig.minute, plural: unitConfig.minutes },
		{ value: seconds, singular: unitConfig.second, plural: unitConfig.seconds },
		{ value: milliseconds, singular: unitConfig.millisecond, plural: unitConfig.milliseconds },
	]

	const parts = []
	for (const component of timeComponents)
		if (component.value > 0) {
			const unitName = component.value == 1 ? component.singular : component.plural
			const valueStr = component.value

			if (unitConfig.numberUnitSpace)
				parts.push(`${valueStr} ${unitName}`)
			else
				parts.push(`${valueStr}${unitName}`)
		}

	return parts.join(unitConfig.separator)
}
