import { groupGreetings } from './group/index.mjs'
import { singalGreetings } from './signal/index.mjs'

export async function GetGreeting(args, index) {
	return (await singalGreetings(args))[index]
}

export async function GetGroupGreeting(args, index) {
	return (await groupGreetings(args))[index]
}
