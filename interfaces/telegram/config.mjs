/**
 * Telegram 接入层配置对象类型定义。
 * @typedef {{
 *  OwnerUserID: string,
 *  OwnerUserName: string,
 *  OwnerNameKeywords: string[],
 * }} TelegramInterfaceConfig_t
 */

/**
 * 获取此 Telegram 接口的配置模板。
 * @returns {TelegramInterfaceConfig_t} 配置模板对象。
 */
export function GetBotConfigTemplate() {
	return {
		OwnerUserID: 'YOUR_TELEGRAM_USER_ID',
		OwnerUserName: 'YOUR_TELEGRAM_USERNAME',
		OwnerNameKeywords: [
			'your_name_keyword1',
			'your_name_keyword2',
		],
	}
}
