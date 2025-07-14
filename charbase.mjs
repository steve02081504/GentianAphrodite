import path from 'node:path'
import { exec } from './scripts/exec.mjs'

export const is_dist = false
export const chardir = import.meta.dirname
export const charname = path.basename(chardir)
export const charurl = `/chars/${encodeURIComponent(path.basename(chardir))}`
export const charvar = await exec('git -C "." describe --tags', { cwd: chardir }).then((result) => result.stdout.trim()).catch(
	() => exec('git -C "." rev-parse --short HEAD', { cwd: chardir }).then((result) => result.stdout.trim()).catch(
		() => 'unknown'
	)
)
export let username = ''

export function initCharBase(init) {
	username = init.username
}
