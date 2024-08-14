
let tab_num = 0
function tab() {
	let result = ''
	for (let i = 0; i < tab_num; i++) result += '    '
	return result
}
function print_rander(object) {
	let result = ''
	if (Object(object) instanceof String) result = '"' + object.replace(/"/g, '\\"').replace(/\n/g, '\\n"+\n'+tab()+'"') + '"'
	else if (object instanceof Array) {
		result = '[\n'
		tab_num++
		for (let item of object) result += tab() + print_rander(item) + ',\n'
		tab_num--
		result += tab() + ']'
	}
	else if (object instanceof Object) {
		result = '{\n'
		tab_num++
		for (let key in object)
			result += tab() + print_rander(key) + ': ' + print_rander(object[key]) + ',\n'
		tab_num--
		result += tab() + '}'
	}
	else result = object
	return result
}
function print(object) {
	console.log(print_rander(object))
}

export {
	print,
	print_rander
}
