import { groupGreetings } from './group.mjs'
import { singalGreetings } from './singal.mjs'

export function GetGreetings(args) {
	return singalGreetings(args)
}

export function GetGroupGreetings(args) {
	return groupGreetings(args)
}
