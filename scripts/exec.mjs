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
		process.stdout?.on('data', data => {
			stdout += data
			stdall += data
		})
		process.stderr?.on('data', data => {
			stderr += data
			stdall += data
		})
		process.on('exit', code => {
			if (no_ansi_terminal_sequences) {
				stdout = removeTerminalSequences(stdout)
				stderr = removeTerminalSequences(stderr)
				stdall = removeTerminalSequences(stdall)
			}
			resolve({ code, stdout, stderr, stdall })
		})
	})
}

export function bash_exec(code, options) {
	return base_exec(code, {
		shell: '/bin/bash',
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
async function testPwshPaths(paths) {
	for (const path of paths)
		if (await base_pwsh_exec(path, '1').catch(() => false))
			return path
}

const powershellPath = await testPwshPaths([
	'powershell.exe',
	'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
])

let pwshPath
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
		return bash_exec(`which ${command}`).then(result => result.stdout.trim())
}
pwshPath = await testPwshPaths([
	'pwsh',
	'pwsh.exe',
	await where_command('pwsh').catch(() => ''),
].filter(x => x))

export function exec(str, options) {
	if (process.platform == 'win32')
		return pwsh_exec(str, options)
	else return bash_exec(str, options)
}
