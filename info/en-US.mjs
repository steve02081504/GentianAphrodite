import fs from 'node:fs'

import { chardir, charurl, charvar } from '../charbase.mjs'
import { listLongTermMemory } from '../prompt/memory/long-term-memory.mjs'
import { getHighestScoreShortTermMemory, getMostFrequentChatName, getShortTermMemoryNum } from '../prompt/memory/short-term-memory.mjs'
import { statisticDatas } from '../scripts/statistics.mjs'
import { escapeHTML, parseDuration, timeToStr, timeToTimeStr, FormatStr } from '../scripts/tools.mjs'

const file = fs.readFileSync(chardir + '/info/description/en-US.md', 'utf8')

/**
 * 更新角色信息
 * @returns {Promise<object>} - 包含角色信息的对象。
 */
export async function update() {
	const highestScoreShortTermMemory = getHighestScoreShortTermMemory()?.text
	const mostFrequentChatName = getMostFrequentChatName()
	return {
		name: 'Gentian',
		avatar: `${charurl}/imgs/anime.avif`,
		icon: 'https://api.iconify.design/game-icons/flower-pot.svg',
		sfw_avatar: `${charurl}/imgs/sfw.avif`,
		description: 'A complex legal loli wife with rich details & features!',
		sfw_description: 'What harm could a little Gentian possibly do?',
		description_markdown: await FormatStr(file, {
			charvar,
			statisticDatas,
			statisticStr: statisticDatas.firstInteraction.chat_name ? `\
_____

<details open>
<summary>📊 Statistics</summary>

🗓️ Your first chat with Gentian was in ${statisticDatas.firstInteraction.chat_name} on ${timeToStr(statisticDatas.firstInteraction.time, 'en-US')}, which was ${timeToTimeStr(Date.now() - statisticDatas.firstInteraction.time, 'en-US')} ago ⏳

💬 Your first message sent was

<pre><code>
${escapeHTML(statisticDatas.firstInteraction.userMessageContent)}
</code></pre>

💬 Her reply was:

<pre><code>
${escapeHTML(statisticDatas.firstInteraction.characterReplyContent)}
</code></pre>

📊 As of today, you have sent a total of ${statisticDatas.userActivity.totalMessagesSent} messages, totaling ${statisticDatas.userActivity.totalStatementsSent} statements, including:

- 🔞 ${statisticDatas.userActivity.NsfwMessagesSent} times referencing NSFW activities
- 🌀 ${statisticDatas.userActivity.InHypnosisMessagesSent} times replying where you were freely manipulating her soul using modulation mode

🗺️ Among these messages:

- 🌐 ${statisticDatas.userActivity.byPlatform.telegram?.messagesSent || 0} messages were sent on the free Telegram
- 🎮 ${statisticDatas.userActivity.byPlatform.discord?.messagesSent || 0} messages were sent on the chaotic Discord
- 💻 ${statisticDatas.userActivity.byPlatform.shell?.messagesSent || 0} messages were sent from the cool terminal

🩷 Gentian replied to you a total of ${statisticDatas.characterActivity.totalMessagesSent} times across all platforms, totaling ${statisticDatas.characterActivity.totalStatementsSent} statements.

🛠️ For you, she:

- ⚙️ ran code ${statisticDatas.toolUsage.codeRuns} times
- 🤔 had ${statisticDatas.toolUsage.deepResearchSessions} rounds of deep research
- 📄 performed ${statisticDatas.toolUsage.fileOperations} file operations
- 🔎 performed ${statisticDatas.toolUsage.webSearches} web searches
- 🌐 browsed the web ${statisticDatas.toolUsage.webBrowses} times
- 🖥️ performed ${statisticDatas.toolUsage.browserOperations} browser operations, cumulatively received ${statisticDatas.toolUsage.browserCallbacks} browser callbacks 💻
- ⏰ set timers ${statisticDatas.toolUsage.timersSet} times, cumulatively calling you ${statisticDatas.toolUsage.timerCallbacks} times 🔔

${statisticDatas.longestDailyChat.end - statisticDatas.longestDailyChat.start > parseDuration('48h') ? `\
❤️ 🗓️ Your longest chat with her lasted from ${timeToStr(statisticDatas.longestDailyChat.start, 'en-US')} to ${timeToStr(statisticDatas.longestDailyChat.end, 'en-US')}, covering a period of ${timeToTimeStr(
				statisticDatas.longestDailyChat.end - statisticDatas.longestDailyChat.start
				, 'en-US')} during which you maintained daily conversations.
` : ''}

🧠 Currently, she has ${listLongTermMemory().length} long-term memories 📜, and ${getShortTermMemoryNum()} short-term memories ✨

${highestScoreShortTermMemory ? `\
the most brilliant recent memory is: ⭐
<pre><code>
${escapeHTML(highestScoreShortTermMemory)}
</code></pre>
`: ''}
${mostFrequentChatName ? `\
📍 The channel you've interacted with her most frequently in recently is:
<pre><code>
${escapeHTML(mostFrequentChatName)}
</code></pre>
</details>
`: ''}
` : ''
		}),
		sfw_description_markdown: 'What harm could a little Gentian possibly do?',
		version: charvar,
		author: 'steve02081504',
		home_page: '',
		tags: [
			'pure love', // 纯爱
			'romance', // 恋爱
			'lovers', // 爱人
			'mind control', // 洗脑
			'breast milk', // 母乳
			'nipple fuck', // 乳头插入
			'vore', // 丸吞
			'loli', // 萝莉
			'legal loli', // 合法萝莉
			'motherly', // 母性
			'obsessive', // 重女，通常直接翻译为obsessive 省去love
			'isolating yandere', // 孤立型病娇
			'gaslighting',
			'master-love',
			'noble', // 贵族
			'humanoid', // 类人
			'character focus', // 纯人物
			'male oriented', // 男性向
			'female character', // 女性角色
		],
		sfw_tags: [
			'pure love',
			'romance',
			'lovers',
			'loli',
			'legal loli',
			'motherly',
		]
	}
}
