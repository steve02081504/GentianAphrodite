import { Console } from 'node:console'
import { Writable } from 'node:stream'

/**
 * 创建一个虚拟控制台，用于捕获输出，同时可以选择性地将输出传递给真实的控制台。
 *
 * @extends {Console}
 */
export class VirtualConsole extends Console {
	/** @type {string} - 捕获的输出 */
	outputs = ''

	/** @type {object} - 最终合并后的配置项 */
	options

	/** @type {Console} - 用于 realConsoleOutput 的底层控制台实例 */
	#base_console

	/**
	 * @param {object} [options={}] - 配置选项。
	 * @param {boolean} [options.realConsoleOutput=false] - 如果为 true，则在捕获输出的同时，也调用底层控制台进行实际输出。
	 * @param {function(Error): void} [options.error_handler=null] - 一个专门处理单个 Error 对象的错误处理器。
	 * @param {Console} [options.base_console=console] - 用于 realConsoleOutput 的底层控制台实例。
	 */
	constructor(options = {}) {
		super(process.stdout, process.stderr)

		this.options = {
			realConsoleOutput: false,
			error_handler: null,
			base_console: globalThis.console,
			...options,
		}

		this.base_console = this.options.base_console
		delete this.options.base_console
	}
	get base_console() { return this.#base_console }
	set base_console(value) {
		this.#base_console = value
		const createVirtualStream = (targetStream) => {
			return new Writable({
				write: (chunk, encoding, callback) => {
					this.outputs += chunk.toString()
					if (this.options.realConsoleOutput) targetStream.write(chunk, encoding)
					callback()
				},
			})
		}

		this._stdout = createVirtualStream(this.#base_console._stdout || process.stdout)
		this._stderr = createVirtualStream(this.#base_console._stderr || process.stderr)
	}

	error(...args) {
		if (this.options.error_handler && args.length === 1 && args[0] instanceof Error)
			return this.options.error_handler(args[0])
		super.error(...args)
	}

	clear() {
		this.outputs = ''
		super.clear()
	}
}
