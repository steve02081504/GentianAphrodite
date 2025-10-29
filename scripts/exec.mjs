import { spawn } from 'node:child_process'
import process from 'node:process'

/**
 * 从字符串中移除 ANSI 终端序列。
 * @param {string} str - 要处理的字符串。
 * @returns {string} - 清理后的字符串。
 */
export function removeTerminalSequences(str) {
	// deno-lint-ignore no-control-regex
	return str.replace(/\x1B\[[\d;]*[Km]/g, '')
}

async function base_exec(code, {
	shell,
	cmdswitch = '-c',
	args = [],
	cwd = undefined,
	no_ansi_terminal_sequences = false
}) {
	return new Promise((resolve, reject) => {
		const process = spawn(shell, [...args, cmdswitch, code], {
			encoding: 'utf8',
			windowsHide: true,
			cwd,
		})
		process.on('error', reject)
		let stdout = ''
		let stderr = ''
		let stdall = ''
		process.stdout?.on?.('data', data => {
			stdout += data
			stdall += data
		})
		process.stderr?.on?.('data', data => {
			stderr += data
			stdall += data
		})
		process.on('close', code => {
			if (no_ansi_terminal_sequences) {
				stdout = removeTerminalSequences(stdout)
				stderr = removeTerminalSequences(stderr)
				stdall = removeTerminalSequences(stdall)
			}
			resolve({ code, stdout, stderr, stdall })
		})
	})
}

function base_sh_exec(shellpath, code, options) {
	return base_exec(code, {
		shell: shellpath,
		...options
	})
}
function base_pwsh_exec(shellpath, code, options) {
	code = `\
$OutputEncoding = [Console]::OutputEncoding = [Text.UTF8Encoding]::UTF8
&{
${code}
} | Out-String -Width 65536`
	return base_exec(code, {
		shell: shellpath,
		args: ['-NoProfile', '-NoLogo', '-NonInteractive'],
		cmdswitch: '-Command',
		...options
	})
}
async function testShPaths(paths) {
	for (const path of paths)
		if (await base_sh_exec(path, 'echo 1').catch(() => false))
			return path
}
async function testPwshPaths(paths) {
	for (const path of paths)
		if (await base_pwsh_exec(path, '1').catch(() => false))
			return path
}

const powershellPath = await testPwshPaths([
	'powershell.exe',
	'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
])

let shPath
let bashPath
let pwshPath

/**
 * 使用 sh 执行一个命令字符串。
 * @param {string} code - 要执行的命令。
 * @param {object} [options] - 执行选项。
 * @returns {Promise<{code: number, stdout: string, stderr: string, stdall: string}>} - 执行结果。
 */
export function sh_exec(code, options) {
	return base_sh_exec(shPath ?? '/bin/sh', code, options)
}
/**
 * 使用 bash 执行一个命令字符串。
 * @param {string} code - 要执行的命令。
 * @param {object} [options] - 执行选项。
 * @returns {Promise<{code: number, stdout: string, stderr: string, stdall: string}>} - 执行结果。
 */
export function bash_exec(code, options) {
	return base_sh_exec(bashPath ?? '/bin/bash', code, options)
}
/**
 * 使用 Windows PowerShell 执行一个命令字符串。
 * @param {string} code - 要执行的命令。
 * @param {object} [options] - 执行选项。
 * @returns {Promise<{code: number, stdout: string, stderr: string, stdall: string}>} - 执行结果。
 */
export function powershell_exec(code, options) {
	return base_pwsh_exec(powershellPath, code, options)
}
/**
 * 使用 PowerShell (Core) 执行一个命令字符串。
 * @param {string} code - 要执行的命令。
 * @param {object} [options] - 执行选项。
 * @returns {Promise<{code: number, stdout: string, stderr: string, stdall: string}>} - 执行结果。
 */
export function pwsh_exec(code, options) {
	return base_pwsh_exec(pwshPath ?? powershellPath, code, options)
}
/**
 * 跨平台查找可执行文件的完整路径 (类似于 `which` 或 `where`)。
 * @param {string} command - 要查找的命令名称。
 * @returns {Promise<string>} - 命令的完整路径，如果找不到则为空字符串。
 */
export function where_command(command) {
	if (process.platform === 'win32')
		return pwsh_exec(`Get-Command -Name ${command} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Definition`).then(result => result.stdout.trim())
	else
		return sh_exec(`which ${command}`).then(result => result.stdout.trim())
}
shPath = await testShPaths([
	'sh',
	'sh.exe',
	'/bin/sh',
	await where_command('sh').catch(() => ''),
].filter(x => x))
bashPath = await testShPaths([
	'bash',
	'bash.exe',
	'/bin/bash',
	'/usr/bin/bash',
	await where_command('bash').catch(() => ''),
].filter(x => x))
pwshPath = await testPwshPaths([
	'pwsh',
	'pwsh.exe',
	await where_command('pwsh').catch(() => ''),
].filter(x => x))

export const available = {
	pwsh: !!pwshPath,
	powershell: !!powershellPath,
	bash: !!bashPath,
	sh: !!shPath,
}

export const shell_exec_map = {
	pwsh: pwsh_exec,
	powershell: powershell_exec,
	bash: bash_exec,
	sh: sh_exec,
}

/**
 * 使用当前平台的默认 shell 执行一个命令字符串。
 * 在 Windows 上默认为 PowerShell (Core) 或 Windows PowerShell，在其他系统上默认为 bash 或 sh。
 * @param {string} str - 要执行的命令。
 * @param {object} [options] - 执行选项。
 * @returns {Promise<{code: number, stdout: string, stderr: string, stdall: string}>} - 执行结果。
 */
export function exec(str, options) {
	if (process.platform == 'win32') return pwsh_exec(str, options)
	else if (bashPath) return bash_exec(str, options)
	else if (shPath) return sh_exec(str, options)
	else throw new Error('No shell available')
}
