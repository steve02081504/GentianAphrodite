import util from 'node:util'

export class VirtualConsole {
	constructor(options = {}) {
		this.outputs = ''
		this.countMap = {}
		this.timeMap = {}
		this.groupIndent = 0
		// 配置选项
		this.options = {
			realConsoleOutput: false,
			...options,
		}
	}

	_format(...args) {
		return util.format(...args) + '\n'
	}

	_groupPrefix() {
		return '  '.repeat(this.groupIndent)
	}

	log(...args) {
		const formatted = this._format(...args)
		this.outputs += this._groupPrefix() + formatted
		if (this.options.realConsoleOutput)
			process.stdout.write(this._groupPrefix() + formatted)
	}

	error(...args) {
		const formatted = this._format(...args)
		this.outputs += this._groupPrefix() + formatted
		if (this.options.realConsoleOutput)
			process.stderr.write(this._groupPrefix() + formatted)
	}

	warn(...args) {
		this.log(...args)
	}

	info(...args) {
		this.log(...args)
	}

	debug(...args) {
		this.log(...args)
	}

	assert(condition, ...args) {
		if (!condition)
			this.error('Assertion failed:', ...args)
	}

	clear() {
		this.outputs = ''
		if (this.options.realConsoleOutput)
			console.clear()  // 调用真正的 console.clear
	}

	count(label = 'default') {
		this.countMap[label] = (this.countMap[label] || 0) + 1
		this.log(`${label}: ${this.countMap[label]}`)
		if (this.options.realConsoleOutput)
			console.count(label)
	}

	countReset(label = 'default') {
		delete this.countMap[label]
		if (this.options.realConsoleOutput)
			console.countReset(label)
	}

	dir(obj, options) {
		this.log(util.inspect(obj, options))
	}

	dirxml(...data) {
		const formattedData = data.map(item => {
			if (typeof item === 'object' && item !== null)
				// 简单地将对象转换为 XML 字符串的占位符。
				// 真正的 XML 转换需要更复杂的逻辑。
				return `<object>${Object.keys(item).map(key => `<${key}>${item[key]}</${key}>`).join('')}</object>`
			else
				return util.format(item)
		}).join(' ')
		this.log(formattedData)
		if (this.options.realConsoleOutput)
			console.dirxml(...data)

	}

	group(...args) {
		if (args.length)
			this.log(...args)
		this.groupIndent++
		if (this.options.realConsoleOutput)
			console.group(...args)
	}

	groupCollapsed(...args) {
		if (args.length)
			this.log(...args)
		this.groupIndent++
		if (this.options.realConsoleOutput)
			console.groupCollapsed(...args)
	}

	groupEnd() {
		this.groupIndent = Math.max(0, this.groupIndent - 1)
		if (this.options.realConsoleOutput)
			console.groupEnd()
	}

	table(tabularData, properties) {
		if (this.options.realConsoleOutput)
			console.table(tabularData, properties) //直接调用
		else
			// 简易版，复杂版需要自己实现
			if (tabularData && typeof tabularData === 'object')
				if (Array.isArray(tabularData)) {
					//数组
					let keys = new Set()
					for (const item of tabularData)
						if (typeof item === 'object' && item !== null)
							Object.keys(item).forEach(k => keys.add(k))

					keys = Array.from(keys)
					if (properties)
						keys = keys.filter(k => properties.includes(k))

					const header = `| index | ${keys.join(' | ')} |`
					this.log(header)
					this.log('-'.repeat(header.length))

					tabularData.forEach((item, index) => {
						if (typeof item === 'object' && item !== null) {
							const row = keys.map(k => item[k] ?? '').join(' | ')
							this.log(`| ${index} | ${row} |`)
						}
						else
							this.log(`| ${index} | ${util.format(item)} |`)
					})
				}
				else {
					//普通对象
					const keys = properties || Object.keys(tabularData)
					const header = '| key | value |'
					this.log(header)
					this.log('-'.repeat(header.length))
					for (const key of keys)
						this.log(`| ${key} | ${tabularData[key] ?? ''} |`)
				}
			else
				this.log(util.format(tabularData))
	}


	time(label = 'default') {
		this.timeMap[label] = performance.now()
		if (this.options.realConsoleOutput)
			console.time(label)
	}

	timeEnd(label = 'default') {
		const startTime = this.timeMap[label]
		if (startTime !== undefined) {
			const duration = performance.now() - startTime
			this.log(`${label}: ${duration.toFixed(3)} ms`)
			delete this.timeMap[label]
		} else
			this.warn(`Timer '${label}' does not exist`)
		if (this.options.realConsoleOutput)
			console.timeEnd(label)
	}
	timeLog(label = 'default', ...data) {
		const startTime = this.timeMap[label]
		if (startTime !== undefined) {
			const duration = performance.now() - startTime
			this.log(`${label}: ${duration.toFixed(3)} ms`, ...data)
		} else
			this.warn(`Timer '${label}' does not exist`)
		if (this.options.realConsoleOutput)
			console.timeLog(label, ...data)
	}

	timeStamp(label) {
		this.log(`[${new Date().toISOString()}] ${label ?? ''}`)
		if (this.options.realConsoleOutput)
			console.timeStamp(label)
	}

	trace(...args) {
		const stack = new Error().stack.split('\n').slice(2).join('\n') // 移除trace本身
		this.log('Trace:', ...args, '\n' + stack)
		if (this.options.realConsoleOutput)
			console.trace(...args)
	}

	profile(label) {
		if (this.options.realConsoleOutput)
			console.profile(label)
		else
			this.warn('profile not implemented in VirtualConsole')
	}
	profileEnd(label) {
		if (this.options.realConsoleOutput)
			console.profileEnd(label)
		else
			this.warn('profileEnd not implemented in VirtualConsole')
	}
}
