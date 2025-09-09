import { spawn } from 'node:child_process'
import process from 'node:process'

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

export function sh_exec(code, options) {
	return base_sh_exec(shPath ?? '/bin/sh', code, options)
}
export function bash_exec(code, options) {
	return base_sh_exec(bashPath ?? '/bin/bash', code, options)
}
export function powershell_exec(code, options) {
	return base_pwsh_exec(powershellPath, code, options)
}
export function pwsh_exec(code, options) {
	return base_pwsh_exec(pwshPath ?? powershellPath, code, options)
}
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

export function exec(str, options) {
	if (process.platform == 'win32') return pwsh_exec(str, options)
	else if (bashPath) return bash_exec(str, options)
	else if (shPath) return sh_exec(str, options)
	else throw new Error('No shell available')
}
