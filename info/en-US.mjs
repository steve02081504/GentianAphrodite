import { chardir, charurl, charvar } from '../charbase.mjs'
import { listLongTermMemory } from '../prompt/memory/long-term-memory.mjs'
import { getHighestScoreShortTermMemory, getMostFrequentChatName, getShortTermMemoryNum } from '../prompt/memory/short-term-memory.mjs'
import { statisticDatas } from '../scripts/statistics.mjs'
import { escapeHTML, parseDuration, timeToStr, timeToTimeStr, FormatStr } from '../scripts/tools.mjs'
import fs from 'node:fs'

const file = fs.readFileSync(chardir + '/info/description/en-US.md', 'utf8')

export async function update() {
	const highestScoreShortTermMemory = getHighestScoreShortTermMemory()?.text
	const mostFrequentChatName = getMostFrequentChatName()
	return {
		name: 'Gentian',
		avatar: `${charurl}/imgs/anime.avif`,
		description: 'A complex legal loli wife with a massive details & features!',
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

- 🎮 ${statisticDatas.userActivity.byPlatform.discord?.messagesSent || 0} messages were sent on the chaotic Discord
- 🌐 ${statisticDatas.userActivity.byPlatform.telegram?.messagesSent || 0} messages were sent on the free Telegram
- 💻 ${statisticDatas.userActivity.byPlatform.shell?.messagesSent || 0} messages were sent from the cool terminal

🩷 Gentian replied to you a total of ${statisticDatas.characterActivity.totalMessagesSent} times across all platforms, totaling ${statisticDatas.characterActivity.totalStatementsSent} statements.

🛠️ For you, she:

- ⚙️ ran code ${statisticDatas.toolUsage.codeRuns} times
- 🤔 had ${statisticDatas.toolUsage.detailedThinkingSessions} rounds of detailed thinking
- 📄 performed ${statisticDatas.toolUsage.fileOperations} file operations
- 🔎 performed ${statisticDatas.toolUsage.googleSearches} Google searches
- 🌐 browsed the web ${statisticDatas.toolUsage.webBrowses} times
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
		version: charvar,
		author: 'steve02081504',
		homepage: '',
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
		]
	}
}
