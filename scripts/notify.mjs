import { localhostLocales } from '../../../../../../src/scripts/i18n.mjs'
import { notify as fount_notify } from '../../../../../../src/scripts/notify.mjs'
import { charname, username, GentianAphrodite } from '../charbase.mjs'

let notifyAbleChannels = []

const baseNotifyChannel = {}

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
		AddChatLogEntry: (entry) => fount_notify(charname, entry.content),
		other_chars: {},
		plugins: {},
		Update: () => {
			baseNotifyChannel.time = new Date()
			baseNotifyChannel.chat_log = []
			return baseNotifyChannel
		},
		chat_scoped_char_memory: {},
		extension: {},
	})
}

export async function UseNofityAbleChannel(func) {
	initBaseNotifyChannel()
	for (const channel of [...notifyAbleChannels, baseNotifyChannel]) try {
		return await func(await channel.Update())
	}
	catch (err) {
		console.error(err)
	}
}

export function addNotifyAbleChannel(channel) {
	if (notifyAbleChannels.some(c => c.chat_name === channel.chat_name))
		notifyAbleChannels = notifyAbleChannels.filter(c => c.chat_name !== channel.chat_name)
	notifyAbleChannels.unshift(channel)
	notifyAbleChannels = notifyAbleChannels.slice(0, 13)
}
