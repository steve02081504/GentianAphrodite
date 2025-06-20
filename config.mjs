import { getAISourceData, setAISourceData } from './AISource/index.mjs'

export const config = {
	deep_research: {
		max_planning_cycles: 4,
		initial_plan_max_retries: 5,
		summary_max_retries: 5,
		reasoning_interval: 3000
	}
}

export function GetData() {
	return {
		AIsources: getAISourceData(),
		deep_research: config.deep_research
	}
}
export async function SetData(data) {
	if (data.AIsources) await setAISourceData(data.AIsources)
	Object.assign(config.deep_research, data.deep_research)
}
