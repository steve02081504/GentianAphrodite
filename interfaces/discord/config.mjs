/**
 * Discord 接入层配置对象类型定义。
 * @typedef {{
 *  OwnerUserName: string,
 *  OwnerDiscordID?: string,
 *  OwnerNameKeywords: string[],
 *  BotActivityName?: string,
 *  BotActivityType?: keyof typeof ActivityType,
 * }} DiscordInterfaceConfig_t
 */

/**
 * 获取此 Discord 接口的配置模板。
 * @returns {DiscordInterfaceConfig_t} 配置模板对象。
 */
export function GetBotConfigTemplate() {
	return {
		OwnerUserName: 'your_discord_username',
		OwnerDiscordID: 'your_discord_user_id',
		OwnerNameKeywords: [
			'your_name_keyword1',
			'your_name_keyword2',
		],
		BotActivityName: '主人',
		BotActivityType: 'Watching',
	}
}
