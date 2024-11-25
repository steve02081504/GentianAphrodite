import { suffleArray } from './tools.mjs'

export function random(...args) {
	return args[Math.floor(Math.random() * args.length)]
}
export function PickRandomN(number, ...args) {
	return suffleArray(args).slice(0, number)
}
export function repetRandomTimes(str, min, max) {
	let time = Math.floor(Math.random() * (max - min) + min)
	return str.repeat(time)
}
export function NdiffResults(times, lambda) {
	let result = new Set()
	while (result.size < times) result.add(lambda())
	return [...result]
}
export function emptyForChance(chance, string = '') {
	return Math.random() < chance ? '' : string
}
