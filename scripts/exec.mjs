import { exec as base_exec } from 'node:child_process'
import { promisify } from 'node:util'
const exec = promisify(base_exec)

// if pwsh.exe available, use it, else use powershell.exe
let pwshavailable = Boolean(await exec('1', { 'shell': 'pwsh.exe' }).catch(() => false))

export function pwsh_exec(code) {
	return exec(code, { 'shell': pwshavailable ? 'pwsh.exe' : 'powershell.exe' })
}
export function powershell_exec(code) {
	return exec(code, { 'shell': 'powershell.exe' })
}
export function bash_exec(code) {
	return exec(code, { 'shell': '/bin/bash' })
}
export {
	exec
}

export function where_command(command) {
	if (process.platform === 'win32')
		return pwsh_exec(`Get-Command -Name ${command} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Definition`).then(result => result.stdout.trim())
	else
		return bash_exec(`which ${command}`).then(result => result.stdout.trim())
}
