import { spawn } from 'node:child_process'
import process from 'node:process'

async function base_exec(code, {
	shell,
	cmdswitch = '-c',
	args = [],
}) {
	return new Promise((resolve) => {
		const process = spawn(shell, [...args, cmdswitch, code], {
			'encoding': 'utf8',
			'windowsHide': true
		})
		let stdout = ''
		let stderr = ''
		let stdall = ''
		process.stdout.on('data', (data) => {
			stdout += data
			stdall += data
		})
		process.stderr.on('data', (data) => {
			stderr += data
			stdall += data
		})
		process.on('close', (code) => {
			resolve({ code, stdout, stderr, stdall })
		})
	})
}

export function bash_exec(code) {
	return base_exec(code, {
		'shell': '/bin/bash',
	})
}

function base_pwsh_exec(code, shellpath) {
	code = `\
$OutputEncoding = [Console]::OutputEncoding = [Text.UTF8Encoding]::UTF8
&{
${code}
} | Out-String -Width 65536`
	return base_exec(code, {
		'shell': shellpath,
		args: ['-NoProfile', '-NoLogo', '-NonInteractive'],
		cmdswitch: '-Command'
	})
}
async function testPwshPaths(paths) {
	for (const path of paths)
		if (await base_pwsh_exec('1', path).catch(() => false))
			return path
}

const powershellPath = await testPwshPaths([
	'powershell.exe',
	'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
])

let pwshPath
export function powershell_exec(code) {
	return base_pwsh_exec(code, powershellPath)
}
export function pwsh_exec(code) {
	return base_pwsh_exec(code, pwshPath ?? powershellPath)
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

export function removeTerminalSequences(str) {
	// deno-lint-ignore no-control-regex
	return str.replace(/\x1B\[[\d;]*[Km]/g, '')
}
function RemoveterminalSequencesFromExecResult(result) {
	return {
		...result,
		stdout: removeTerminalSequences(result.stdout),
		stderr: removeTerminalSequences(result.stderr),
		stdall: removeTerminalSequences(result.stdall),
	}
}

export function exec(str) {
	if (process.platform == 'win32')
		return pwsh_exec(str)
	else return bash_exec(str)
}

// no ansi terminal sequences functions

export function exec_NATS(str) {
	return exec(str).then(RemoveterminalSequencesFromExecResult)
}

export function bash_exec_NATS(str) {
	return bash_exec(str).then(RemoveterminalSequencesFromExecResult)
}

export function pwsh_exec_NATS(str) {
	return pwsh_exec(str).then(RemoveterminalSequencesFromExecResult)
}

export function powershell_exec_NATS(str) {
	return powershell_exec(str).then(RemoveterminalSequencesFromExecResult)
}
