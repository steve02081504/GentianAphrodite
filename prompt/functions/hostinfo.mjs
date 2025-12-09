import os from 'node:os'
import process from 'node:process'

import { getHistory } from '../../scripts/clipboard.mjs'
import { exec } from '../../scripts/exec.mjs'
import { match_keys } from '../../scripts/match.mjs'
import { getWindowInfos } from '../../scripts/window_info.mjs'

/** @typedef {import("../../../../../../../src/public/shells/chat/decl/chatLog.ts").chatReplyRequest_t} chatReplyRequest_t */
/** @typedef {import("../logical_results/index.mjs").logical_results_t} logical_results_t */

/**
 * 生成主机信息相关的 Prompt。
 * @param {chatReplyRequest_t} args - 聊天回复请求参数。
 * @param {logical_results_t} logical_results - 逻辑结果。
 * @returns {Promise<object>} - 包含 Prompt 文本的对象。
 */
export async function HostInfoPrompt(args, logical_results) {
	let result = ''

	const all_info = await match_keys(args, [/电脑(信息|怎样|怎么样|咋样)/i], 'user')

	if (args.extension?.enable_prompts?.hostInfo || all_info) {
		// 获取系统基本信息
		const { hostname, type, release, arch, platform } = os
		result += `\
主机名：${hostname()}
操作系统：${type()} ${release()}
CPU架构：${arch()}
平台：${platform()}
`
	}

	if (args.extension?.enable_prompts?.hostInfo || all_info || await match_keys(args, [/cpu(占用|用了)/i, /cpu使用(率|情况)/i, /cpu(的|什么|是什么|)(信息|型号|频率)/i, /cpu(多少核|核心)/i], 'user')) {
		// 使用 node-os-utils 获取 CPU 信息
		const { OSUtils } = await import('npm:node-os-utils').then(m => m.default)
		const osinfo = new OSUtils()
		const cpuInfo = await osinfo.cpu.average()
		const cpuUsage = (1 - cpuInfo.avgIdle / cpuInfo.avgTotal) * 100
		result += `\
CPU信息：
型号：${osinfo.cpu.model().replaceAll('\x00', '')}
核心数：${osinfo.cpu.count()}
频率：${cpuInfo.avgTotal / 1000} GHz
使用率：${cpuUsage.toFixed(2)}%
`
	}
	if (args.extension?.enable_prompts?.hostInfo || await match_keys(args, [/内存(占用|用了)/i, /内存使用(率|情况)/i, /(还剩|多少|已用|空闲)内存/i, /内存(还剩|多少|已用|空闲)/i], 'user')) {
		const osinfo = await import('npm:node-os-utils').then(m => m.default)
		const memInfo = await osinfo.mem.info()
		result += `\
内存信息：
总量：${memInfo.totalMemMb} MB
已用：${memInfo.usedMemMb.toFixed(2)} MB
空闲：${memInfo.freeMemMb.toFixed(2)} MB
使用率：${(memInfo.usedMemMb / memInfo.totalMemMb * 100).toFixed(2)}%
`
	}

	if (args.extension?.enable_prompts?.hostInfo || await match_keys(args, [/硬盘(占用|用了)/i, /硬盘使用(率|情况)/i, /(还剩|多少|已用|空闲)硬盘/i, /硬盘(还剩|多少|已用|空闲)/i], 'user')) {
		// 获取磁盘使用情况，使用 fs 模块
		const diskUsage = {}
		if (process.platform === 'win32') {
			// windows 平台使用 WMIC 命令获取磁盘信息
			const disks = (await exec('wmic logicaldisk get DeviceID,Size,FreeSpace')).stdout
			disks.split('\n').slice(1).forEach(line => {
				const parts = line.trim().split(/\s+/)
				if (parts.length === 3) {
					const disk = parts[0]
					const freeSize = parseInt(parts[1], 10)
					const totalSize = parseInt(parts[2], 10)
					diskUsage[disk] = {
						total: totalSize / 1024 / 1024 / 1024,
						free: freeSize / 1024 / 1024 / 1024,
						used: (totalSize - freeSize) / 1024 / 1024 / 1024,
					}
				}
			})
		}
		else if (process.platform === 'linux') {
			// linux 平台使用 df 命令获取磁盘信息
			const disks = (await exec('df -h')).stdout
			disks.split('\n').slice(1).forEach(line => {
				const parts = line.trim().split(/\s+/)
				if (parts.length >= 6) {
					const disk = parts[5]
					const totalSize = parseFloat(parts[1].replace(/%/, ''))
					const usedSize = parseFloat(parts[2].replace(/%/, ''))
					diskUsage[disk] = {
						total: totalSize,
						used: usedSize,
						free: totalSize - usedSize,
					}
				}
			})
		}
		result += `\
硬盘信息：
${Object.entries(diskUsage).map(([disk, info]) => `\
磁盘 ${disk}:
总量：${info.total.toFixed(2)} GB
已用：${info.used.toFixed(2)} GB
空闲：${info.free.toFixed(2)} GB
使用率：${(info.used / info.total * 100).toFixed(2)}%
`).join('\n')}
`
	}
	if (result)
		result = `\
当前主机信息如下：
${result}
`
	try {
		const windows = await getWindowInfos()
		result += `\
当前打开的窗口有：
${windows.map(w => `\
标题：${w.title}
${w.isActive ? `当前活跃窗口
` : ''}PID：${w.pid}
进程名：${w.processName}
路径：${w.path}
`).join('\n')}
`
	}
	catch (e) {
		result += `\
无法获取当前打开的窗口信息：${e.message}
`
	}

	try {
		const clipboardHistory = getHistory().slice(0, 7)
		if (clipboardHistory.length) {
			result += `\
最近的剪贴板内容：
`
			clipboardHistory.forEach((entry, index) => {
				let content = ''
				if (entry.type === 'text') {
					content = entry.content
					if (content.length > 1024)
						content = content.substring(0, 1024) + '...（已因过长而截断，如需详细内容请自行获取）'
				}
				else if (entry.type === 'image') content = '[图片内容]'

				result += `\
${index + 1}. 类型: ${entry.type}, 时间: ${new Date(entry.timestamp).toLocaleString()}
内容: ${content}
`
			})
		}
	}
	catch (e) {
		result += `\
无法获取剪贴板历史内容：${e.message}
`
	}

	return {
		text: [{
			content: result,
			important: 0
		}]
	}
}
