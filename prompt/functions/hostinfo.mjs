import { NdiffResults, PickRandomN, random, repetRandomTimes } from '../../scripts/random.mjs'
import { getScopedChatLog, match_keys } from '../../scripts/match.mjs'
import os from 'node:os'
import osinfo from 'npm:node-os-utils'
import process from 'node:process'
import { exec } from '../../../../../../../src/server/exec.mjs'

/** @typedef {import("../../../../../../../src/public/shells/chat/decl/chatLog.ts").chatReplyRequest_t} chatReplyRequest_t */
/** @typedef {import("../logical_results/index.mjs").logical_results_t} logical_results_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").prompt_struct_t} prompt_struct_t */

/**
 * @param {chatReplyRequest_t} args
 * @param {logical_results_t} logical_results
 * @param {prompt_struct_t} prompt_struct
 * @param {number} detail_level
 */
export async function HostInfoPrompt(args, logical_results, prompt_struct, detail_level) {
	let result = ''

	let all_info = await match_keys(args, [/电脑(信息|怎样|怎么样|咋样)/i], 'user')

	if (all_info) {
		// 获取系统基本信息
		let { hostname, type, release, arch, platform } = os
		result += `\
主机名：${hostname()}
操作系统：${type()} ${release()}
CPU架构：${arch()}
平台：${platform()}
`
	}

	if (all_info || await match_keys(args, [/cpu(占用|使用)(率|情况)/i], 'user')) {
		// 使用 node-os-utils 获取 CPU 信息
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
	if (await match_keys(args, [/内存(占用|使用)(率|情况)/i], 'user')) {
		const memInfo = await osinfo.mem.info()
		result += `\
内存信息：
总量：${memInfo.totalMemMb} MB
已用：${memInfo.usedMemMb.toFixed(2)} MB
空闲：${memInfo.freeMemMb.toFixed(2)} MB
`
	}

	if (await match_keys(args, [/硬盘(占用|使用)(率|情况)/i], 'user')) {
		// 获取磁盘使用情况，使用 fs 模块
		let diskUsage = {}
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
		} else if (process.platform === 'linux') {
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
	return {
		text: [{
			content: result,
			important: 0
		}]
	}
}
