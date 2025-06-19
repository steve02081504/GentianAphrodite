import { chardir, charurl, charvar } from '../charbase.mjs'
import { listLongTermMemory } from '../prompt/memory/long-term-memory.mjs'
import { getHighestScoreShortTermMemory, getMostFrequentChatName, getShortTermMemoryNum } from '../prompt/memory/short-term-memory.mjs'
import { statisticDatas } from '../scripts/statistics.mjs'
import { escapeHTML, parseDuration, timeToStr, timeToTimeStr, FormatStr } from '../scripts/tools.mjs'
import fs from 'node:fs'

const file = fs.readFileSync(chardir + '/info/description/zh-CN.md', 'utf8')

export async function update() {
	const highestScoreShortTermMemory = getHighestScoreShortTermMemory()?.text
	const mostFrequentChatName = getMostFrequentChatName()
	return {
		name: '龙胆',
		avatar: `${charurl}/imgs/anime.avif`,
		description: '一个要素爆表的合法萝莉老婆！',
		description_markdown: await FormatStr(file, {
			charvar,
			statisticDatas,
			statisticStr: statisticDatas.firstInteraction.chat_name ? `\
_____

<details open>
<summary>📊 统计数据</summary>

🗓️ 第一次和龙胆聊天是在${statisticDatas.firstInteraction.chat_name}的${timeToStr(statisticDatas.firstInteraction.time, 'zh-CN')}，距离今天已经过去了${timeToTimeStr(Date.now() - statisticDatas.firstInteraction.time, 'zh-CN')} ⏳

💬 你第一次发送的消息是

<pre><code>
${escapeHTML(statisticDatas.firstInteraction.userMessageContent)}
</code></pre>

💬 她回复了：

<pre><code>
${escapeHTML(statisticDatas.firstInteraction.characterReplyContent)}
</code></pre>

📊 直到今天，你累积发了${statisticDatas.userActivity.totalMessagesSent}条信息，一共${statisticDatas.userActivity.totalStatementsSent}句，其中：

- 🔞 ${statisticDatas.userActivity.NsfwMessagesSent}次回复你和她在做少儿不宜的事
- 🌀 ${statisticDatas.userActivity.InHypnosisMessagesSent}次回复中你在用调制模式肆意玩弄她的灵魂

🗺️ 在这些消息中：

- 🎮 ${statisticDatas.userActivity.byPlatform.discord?.messagesSent || 0}次消息是在混乱的discord上传达的
- 🌐 ${statisticDatas.userActivity.byPlatform.telegram?.messagesSent || 0}次消息是在自由的telegram中送到的
- 💻 ${statisticDatas.userActivity.byPlatform.shell?.messagesSent || 0}次消息是在酷炫的终端里发送的

🩷 龙胆在各个平台上一共回复了你${statisticDatas.characterActivity.totalMessagesSent}次，一共${statisticDatas.characterActivity.totalStatementsSent}句

🛠️ 她为你：

- ⚙️ 运行过${statisticDatas.toolUsage.codeRuns}次代码
- 🤔 详细思考过${statisticDatas.toolUsage.detailedThinkingSessions}轮次
- 📄 操作过${statisticDatas.toolUsage.fileOperations}次文件
- 🔎 谷歌搜索过${statisticDatas.toolUsage.googleSearches}次
- 🌐 浏览过${statisticDatas.toolUsage.webBrowses}次网页
- ⏰ 定时过${statisticDatas.toolUsage.timersSet}次定时器，累计呼唤你${statisticDatas.toolUsage.timerCallbacks}次 🔔

${statisticDatas.longestDailyChat.end - statisticDatas.longestDailyChat.start > parseDuration('48h') ? `\
❤️ 🗓️ 你和她最长的眷恋留存于${timeToStr(statisticDatas.longestDailyChat.start)}至${timeToStr(statisticDatas.longestDailyChat.end)}，共${timeToTimeStr(
				statisticDatas.longestDailyChat.end - statisticDatas.longestDailyChat.start
				, 'zh-CN')}的时间中，你与她每日都保持对话。
` : ''}

🧠 如今，她有${listLongTermMemory().length}条长期记忆 📜，有${getShortTermMemoryNum()}条短期记忆 ✨

${highestScoreShortTermMemory ? `\
其中近期最闪光的记忆是： ⭐
<pre><code>
${escapeHTML(highestScoreShortTermMemory)}
</code></pre>
`: ''}
${mostFrequentChatName ? `\
📍 近期你和她最常交流的频道是：
<pre><code>
${escapeHTML(mostFrequentChatName)}
</code></pre>
`: ''}
</details>
` : ''
		}),
		version: charvar,
		author: 'steve02081504',
		homepage: '',
		tags: [
			'纯爱',
			'恋爱',
			'恋人',
			'洗脑',
			'母乳',
			'乳头插入',
			'丸吞',
			'萝莉',
			'合法萝莉',
			'母性',
			'重女',
			'孤立型病娇',
			'gaslighting',
			'master-love',
			'贵族',
			'类人',
			'纯人物',
			'男性向',
			'女性角色',
		],
	}
}
