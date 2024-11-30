/**
* @param {string} reply
* @returns {string[]}
*/
export function splitDiscordReply(reply, split_lenth = 2000) {
	let content_slices = reply.split('\n')
	let new_content_slices = []
	let last = ''
	function mapend() {
		if (last) new_content_slices.push(last)
		content_slices = new_content_slices
		new_content_slices = []
		last = ''
	}
	/**
	 * @param {string} code_block
	 * @param {string} split_line
	 */
	function splitCodeBlock(code_block, split_line) {
		let new_content_slices = []
		let content_slices = code_block.trim().split('\n')
		let block_begin = content_slices.shift() + '\n'
		let block_end = '\n' + content_slices.pop()
		// 找到分割行
		while (content_slices.length > 0) {
			let split_line_index = content_slices.indexOf(split_line)
			if (split_line_index === -1) {
				new_content_slices.push(content_slices.join('\n'))
				break
			}
			let before = content_slices.slice(0, split_line_index + 1).join('\n')
			new_content_slices.push(before)
			content_slices = content_slices.slice(split_line_index + 1)
		}
		content_slices = new_content_slices
		new_content_slices = []
		// 合并代码块
		let last = ''
		for (let content_slice of content_slices) {
			if (last.length + content_slice.length + block_begin.length + block_end.length > split_lenth) {
				new_content_slices.push(block_begin + last.trim() + block_end)
				last = ''
			}
			last += '\n' + content_slice
		}
		new_content_slices.push(block_begin + last.trim() + block_end)
		new_content_slices = new_content_slices.filter(e => e != block_begin + block_end)
		return new_content_slices
	}
	// 处理```代码块，合并块内容确保其在一个消息中
	for (let content_slice of content_slices)
		if (content_slice.startsWith('```'))
			if (last) {
				new_content_slices.push(last + '\n' + content_slice)
				last = ''
			}
			else last = content_slice

		else if (last)
			last += '\n' + content_slice
		else
			new_content_slices.push(content_slice)

	mapend()
	// 处理超大代码块或超长单行，分割为多个块内容或多行
	code_handle:
	for (let content_slice of content_slices)
		if (content_slice.length > split_lenth)
			if (content_slice.startsWith('```')) {
				for (let spliter of ['}', '};', ')', '']) {
					let splited_blocks = splitCodeBlock(content_slice, spliter)
					if (splited_blocks.every(e => e.length <= split_lenth)) {
						console.log('splited_blocks:', splited_blocks)
						new_content_slices = new_content_slices.concat(splited_blocks)
						continue code_handle
					}
				}
				new_content_slices.push(content_slice)
			}
			else {
				let splited_lines = content_slice.split(/(?<=[ !"');?\]}’”。》！）：；？])/)
				let last = ''
				for (let splited_line of splited_lines) {
					if (last.length + splited_line.length > split_lenth) {
						new_content_slices.push(last)
						last = ''
					}
					last += splited_line
				}
				if (last) new_content_slices.push(last)
			}
		else new_content_slices.push(content_slice)

	mapend()
	// 对于仍然超出长度的块，生硬拆分其内容
	for (let content_slice of content_slices)
		if (content_slice.length > split_lenth)
			new_content_slices = new_content_slices.concat(content_slice.match(new RegExp(`[^]{1,${split_lenth}}`, 'g')))
		else new_content_slices.push(content_slice)
	mapend()
	// 合并消息使其不超过split_lenth
	for (let content_slice of content_slices)
		if (last.length + content_slice.length < split_lenth)
			last += '\n' + content_slice
		else {
			new_content_slices.push(last)
			last = content_slice
		}
	mapend()
	return content_slices.map(e => e.trim()).filter(e => e)
}

export function getMessageFullContent(message) {
	let content = message.content
	for (let [key, value] of message.mentions.users)
		if (content.includes(`<@${value.id}>`))
			content = content.replaceAll(`<@${value.id}>`, `@${value.username}`)
		else
			content = `@${value.username} ${content}`

	//add embeds to content
	for (let embed of message.embeds) {
		content += '\n```\n'
		if (embed.title) content += embed.title + '\n'
		if (embed.description) content += embed.description + '\n'
		for (let field of embed.fields) {
			if (field.name) content += field.name + '\n'
			if (field.value) content += field.value + '\n'
		}
		if (embed.footer?.text) content += embed.footer.text + '\n'
		content += '```\n'
	}
	// if edited
	if (message.edited_timestamp) content += '（已编辑）'
	return content
}
