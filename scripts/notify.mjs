import { localhostLocales } from '../../../../../../src/scripts/i18n.mjs'
import { notify as fount_notify } from '../../../../../../src/scripts/notify.mjs'
import { charname, username, GentianAphrodite } from '../charbase.mjs'

/**
 * 可通知渠道的数组。
 * @type {any[]}
 */
let notifyAbleChannels = []

/**
 * 基础通知渠道。
 * @type {any}
 */
const baseNotifyChannel = {}

/**
 * 初始化基础通知渠道。
 */
function initBaseNotifyChannel() {
	if (baseNotifyChannel.chat_name) return
	Object.assign(baseNotifyChannel, {
		supported_functions: {
			markdown: false,
			mathjax: false,
			html: false,
			unsafe_html: false,
			files: false,
			add_message: true,
		},
		char: GentianAphrodite,
		chat_name: 'base_notify',
		char_id: charname,
		username,
		Charname: '龙胆',
		UserCharname: username,
		locales: localhostLocales,
		time: new Date(),
		chat_log: [],
		/**
		 * @param {any} entry
		 */
		AddChatLogEntry: entry => fount_notify(charname, entry.content),
		other_chars: {},
		plugins: {},
		/**
		 * @returns {any}
		 */
		Update: () => {
			baseNotifyChannel.time = new Date()
			baseNotifyChannel.chat_log = []
			return baseNotifyChannel
		},
		chat_scoped_char_memory: {},
		extension: {},
	})
}

/**
 * 使用一个可用的通知渠道执行一个函数。
 * @param {Function} func - 要执行的函数，它将接收一个更新后的渠道对象作为参数。
 * @returns {Promise<any>} - 函数的返回值。
 */
export async function UseNofityAbleChannel(func) {
	initBaseNotifyChannel()
	for (const channel of [...notifyAbleChannels, baseNotifyChannel]) try {
		return await func(await channel.Update())
	}
	catch (err) {
		console.error(err)
	}
}

/**
 * 添加一个新的可通知渠道。
 * @param {object} channel - 要添加的渠道对象。
 */
export function addNotifyAbleChannel(channel) {
	if (notifyAbleChannels.some(c => c.chat_name === channel.chat_name))
		notifyAbleChannels = notifyAbleChannels.filter(c => c.chat_name !== channel.chat_name)
	notifyAbleChannels.unshift(channel)
	notifyAbleChannels = notifyAbleChannels.slice(0, 13)
}
