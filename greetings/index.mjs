import { groupGreetings } from './group/index.mjs'
import { singalGreetings } from './signal/index.mjs'

export function GetGreetings(args) {
	return singalGreetings(args)
}

export function GetGroupGreetings(args) {
	return groupGreetings(args)
}
