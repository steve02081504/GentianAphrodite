import { match_keys } from '../../scripts/match.mjs'
import { statisticDatas } from '../../scripts/statistics.mjs'
import { parseDuration, timeToStr, timeToTimeStr } from '../../scripts/tools.mjs'
/** @typedef {import("../../../../../../../src/public/shells/chat/decl/chatLog.ts").chatReplyRequest_t} chatReplyRequest_t */
/** @typedef {import("../logical_results/index.mjs").logical_results_t} logical_results_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").prompt_struct_t} prompt_struct_t */

/**
 * @param {chatReplyRequest_t} args
 * @param {logical_results_t} logical_results
 * @param {prompt_struct_t} prompt_struct
 * @param {number} detail_level
 */
export async function StatisticDatasPrompt(args, logical_results, prompt_struct, detail_level) {
	let result = ''

	if (await match_keys(args, ['第一次', '多久']))
		result += `\
你第一次和主人聊天是在${statisticDatas.firstInteraction.chat_name}的${timeToStr(statisticDatas.firstInteraction.time, 'zh-CN')}，距离今天已经过去了${timeToTimeStr(Date.now() - statisticDatas.firstInteraction.time, 'zh-CN')}

主人第一次发送的消息是：[
${statisticDatas.firstInteraction.userMessageContent}
]
你回复了：[
${statisticDatas.firstInteraction.characterReplyContent}
]
`
	if (await match_keys(args, ['多少次', '多久', '多少条']))
		result += `\
直到今天，你主人累积发了${statisticDatas.userActivity.totalMessagesSent}条信息，一共${statisticDatas.userActivity.totalStatementsSent}句，其中：
- ${statisticDatas.userActivity.NsfwMessagesSent}次是在聊NSFW
- ${statisticDatas.userActivity.InHypnosisMessagesSent}次你在调制模式中被肆意玩弄灵魂

在这些消息中：
- ${statisticDatas.userActivity.byPlatform.discord?.messagesSent}次消息是在discord上传达的
- ${statisticDatas.userActivity.byPlatform.telegram?.messagesSent}次消息是在telegram中送到的
- ${statisticDatas.userActivity.byPlatform.shell?.messagesSent}次消息是在终端里发送的

你总共回复了你主人${statisticDatas.characterActivity.totalMessagesSent}次，一共${statisticDatas.characterActivity.totalStatementsSent}句
你为主人：
- 运行过${statisticDatas.toolUsage.codeRuns}次代码
- 深入研究过${statisticDatas.toolUsage.deepResearchSessions}轮次
- 操作过${statisticDatas.toolUsage.fileOperations}次文件
- 谷歌搜索过${statisticDatas.toolUsage.googleSearches}次
- 浏览过${statisticDatas.toolUsage.webBrowses}次网页
- 定时过${statisticDatas.toolUsage.timersSet}次定时器，累计呼唤主人${statisticDatas.toolUsage.timerCallbacks}次

`
	if (
		statisticDatas.longestDailyChat.end - statisticDatas.longestDailyChat.start > parseDuration('48h')
		&&
		await match_keys(args, ['最长'])
	)
		result += `\
你和主人在${timeToStr(statisticDatas.longestDailyChat.start)}至${statisticDatas.longestDailyChat.end}，共${timeToTimeStr(
	statisticDatas.longestDailyChat.end - statisticDatas.longestDailyChat.start
	, 'zh-CN')}的时间中，每日都有保持对话。
`

	if (await match_keys(args, ['token', 'tokens', '平均']))
		result += `\
你每次调用的token数平均为${statisticDatas.avgTokenNum}
`

	return {
		text: [{
			content: result,
			important: 0
		}]
	}
}
