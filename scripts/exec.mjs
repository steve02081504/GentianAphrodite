import { exec as base_exec } from 'node:child_process'
import { promisify } from 'node:util'
export const exec = promisify(base_exec)

export function bash_exec(code) {
	return exec(code, { 'shell': '/bin/bash' })
}

async function testShellPaths(paths) {
	for (const path of paths)
		if(await exec('1', { 'shell': path }).catch(() => false))
			return path
}

let powershellPath = await testShellPaths([
	'powershell.exe',
	'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
])
let pwshPath
export function powershell_exec(code) {
	return exec(code, { 'shell': powershellPath })
}
export function pwsh_exec(code) {
	return exec(code, { 'shell': pwshPath ?? powershellPath })
}
export function where_command(command) {
	if (process.platform === 'win32')
		return pwsh_exec(`Get-Command -Name ${command} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Definition`).then(result => result.stdout.trim())
	else
		return bash_exec(`which ${command}`).then(result => result.stdout.trim())
}
pwshPath = await testShellPaths([
	'pwsh',
	'pwsh.exe',
	await where_command('pwsh'),
])

export function removeTerminalSequences(str) {
	// deno-lint-ignore no-control-regex
	return str.replace(/\x1B\[[\d;]*[Km]/g, '')
}
function RemoveterminalSequencesFromExecResult(result) {
	return {
		...result,
		stdout: removeTerminalSequences(result.stdout),
		stderr: removeTerminalSequences(result.stderr)
	}
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
