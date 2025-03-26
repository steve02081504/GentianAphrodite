import { getAISourceData, setAISourceData } from './AISource/index.mjs'

export const config = {
	detail_thinking: {
		max_planning_cycles: 4,
		initial_plan_max_retries: 5,
		summary_max_retries: 5,
		thinking_interval: 3000
	}
}

export function GetData() {
	return {
		AIsources: getAISourceData(),
		detail_thinking: config.detail_thinking
	}
}
export async function SetData(data) {
	if (data.AIsources) await setAISourceData(data.AIsources)
	Object.assign(config.detail_thinking, data.detail_thinking)
}
