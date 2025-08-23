import fs from 'node:fs/promises'
import path from 'node:path'

import { getAISourceData, setAISourceData } from '../AISource/index.mjs'
import { chardir } from '../charbase.mjs'
import { resetIdleTimer, stopIdleTimer } from '../event_engine/index.mjs'

export async function GetConfigDisplayContent() {
	return {
		html: await fs.readFile(path.join(chardir, 'config', 'display.html'), 'utf-8'),
		js: await fs.readFile(path.join(chardir, 'config', 'display.mjs'), 'utf-8')
	}
}

export const config = {
	deep_research: {
		max_planning_cycles: 4,
		initial_plan_max_retries: 5,
		summary_max_retries: 5,
		reasoning_interval: 3000
	},
	disable_idle_event: false
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
	if (data.disable_idle_event) stopIdleTimer()
	else resetIdleTimer()
}
