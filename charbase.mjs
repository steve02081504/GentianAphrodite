import path from 'node:path'

import { exec } from 'npm:@steve02081504/exec'

import { __dirname } from '../../../../../src/server/base.mjs'
/**
 * 当前 fount 的目录路径。
 * @type {string}
 */
export const fountdir = __dirname
/**
 * 指示当前是否为分发版本。
 * @type {boolean}
 */
export const is_dist = false
/**
 * 当前角色的目录路径。
 * @type {string}
 */
export const chardir = import.meta.dirname
/**
 * 当前角色的名称。
 * @type {string}
 */
export const charname = path.basename(chardir)
/**
 * 当前角色的 URL 路径。
 * @type {string}
 */
export const charurl = `/parts/chars:${encodeURIComponent(path.basename(chardir))}`
/**
 * 当前角色的版本信息，通常是 Git 标签或短哈希。
 * @type {string}
 */
export const charvar = await exec('git -C "." describe --tags', { cwd: chardir }).then(result => result.stdout.trim()).catch(
	() => exec('git -C "." rev-parse --short HEAD', { cwd: chardir }).then(result => result.stdout.trim()).catch(
		() => 'unknown'
	)
)
/**
 * 当前用户的名称。
 * @type {string}
 */
export let username = ''

/**
 * 初始化角色基础信息。
 * @param {object} init - 初始化数据。
 * @param {string} init.username - 用户名。
 */
export function initCharBase(init) {
	username = init.username
}

/** @typedef {import('../../../../../src/decl/charAPI.ts').CharAPI_t} CharAPI_t */

/** @type {CharAPI_t} */
export const GentianAphrodite = {}
