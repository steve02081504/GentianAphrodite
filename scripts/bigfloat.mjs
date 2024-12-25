// bigfloat以无限精度运算的简易js实现
// 逻辑来自elc

class ubigfloat {
	//分子分母
	numerator = 0n
	denominator = 1n
	gc() {
		let gcd = (a, b) => a ? gcd(b % a, a) : b
		this.numerator /= gcd(this.numerator, this.denominator)
		this.denominator = this.denominator / gcd(this.numerator, this.denominator)
		return this
	}
	static fromPair(numerator, denominator) {
		let ubf = new ubigfloat()
		ubf.numerator = BigInt(numerator)
		ubf.denominator = BigInt(denominator)
		return ubf
	}
	constructor(value) {
		// 是否小数？
		if (value instanceof ubigfloat) {
			this.numerator = value.numerator
			this.denominator = value.denominator
		}
		if (value instanceof Number && Math.floor(value) === value)
			this.numerator = BigInt(value)
		else if (value) {
			let string = String(value)
			return ubigfloat.fromString(string)
		}
	}
	add(other) {
		return ubigfloat.fromPair(
			this.numerator * other.denominator + other.numerator * this.denominator,
			this.denominator * other.denominator
		)
	}
	sub(other) {
		return ubigfloat.fromPair(
			this.numerator * other.denominator - other.numerator * this.denominator,
			this.denominator * other.denominator
		)
	}
	mul(other) {
		return ubigfloat.fromPair(
			this.numerator * other.numerator,
			this.denominator * other.denominator
		)
	}
	div(other) {
		return ubigfloat.fromPair(
			this.numerator * other.denominator,
			this.denominator * other.numerator
		)
	}
	mod(other) {
		return ubigfloat.fromPair(
			this.numerator * other.denominator % (this.denominator * other.numerator),
			this.denominator * other.denominator
		)
	}
	pow(other) {
		return ubigfloat.fromPair(
			this.numerator ** other.numerator,
			this.denominator ** other.denominator
		)
	}
	equals(other) {
		return this.numerator * other.denominator === other.numerator * this.denominator
	}
	lessThan(other) {
		return this.numerator * other.denominator < other.numerator * this.denominator
	}
	greaterThan(other) {
		return this.numerator * other.denominator > other.numerator * this.denominator
	}
	compare(other) {
		return this.greaterThan(other) ? 1 : this.lessThan(other) ? -1 : 0
	}
	floor() {
		return this.numerator / this.denominator
	}
	toString() {
		if (this.denominator == 1) return this.numerator.toString()
		else if (this.denominator == 0) return '∞'
		let integer = this.numerator / this.denominator
		let decimal = this.numerator - integer * this.denominator
		let result = integer.toString()
		if (decimal) {
			result += '.'
			let forever_loop_set = new Set()
			while (decimal) {
				decimal *= 10n
				let char = (decimal / this.denominator).toString()
				decimal %= this.denominator
				if (forever_loop_set.has(decimal)) {
					// add [ and ] to looping part
					let loop_part = result.slice(-forever_loop_set.size)
					let loop_before = result.slice(0, result.length - loop_part.length)
					result = loop_before + '[' + loop_part + ']'
					break
				}
				forever_loop_set.add(decimal)
				result += char
			}
		}
		return result
	}
	static fromString(string) {
		// handle [ and ]
		if (string.includes('[')) {
			let loop_part = string.slice(string.indexOf('[') + 1, string.indexOf(']'))
			let loop_before = string.slice(0, string.indexOf('['))
			let times = 7
			let loopfewtimes = loop_part.repeat(times)
			let missing_numerator = ubigfloat.fromPair(BigInt('1' + '0'.repeat(times * loop_part.length)), BigInt(loopfewtimes) - BigInt(loop_part))
			let scale = loop_before.split('.')[1]?.length || 0
			missing_numerator = ubigfloat.fromPair(1n, missing_numerator.floor() * 10n ** BigInt(scale))
			let basenum = ubigfloat.fromString(loop_before)
			return basenum.add(missing_numerator)
		}
		else {
			let result = new ubigfloat()
			let point_index = string.indexOf('.')
			if (point_index === -1) {
				result.numerator = BigInt(string)
				return result
			}
			let before_point = string.slice(0, point_index)
			let after_point = string.slice(point_index + 1)
			result.denominator = 10n ** BigInt(after_point.length)
			result.numerator = BigInt(before_point) * result.denominator + BigInt(after_point)
			return result
		}
	}
}
class bigfloat {
	basenum = new ubigfloat()
	sign = false

	constructor(value) {
		if (value instanceof bigfloat) {
			this.basenum = value.basenum
			this.sign = value.sign
		}
		else if (value) {
			let string = String(value)
			if (string.startsWith('-')) {
				this.sign = true
				string = string.slice(1)
			}
			this.basenum = ubigfloat.fromString(string)
		}
	}

	toString() {
		if (this.basenum.denominator == 0) return '∞'
		return (this.sign ? '-' : '') + this.basenum.toString()
	}
	static fromString(string) {
		return new bigfloat(string)
	}
	static fromNumAndSign(sign, ufloat) {
		let result = new bigfloat()
		result.sign = sign
		result.basenum = ufloat
		return result
	}
	static fromPairAndSign(sign, numerator, denominator) {
		return bigfloat.fromNumAndSign(sign, ubigfloat.fromPair(numerator, denominator))
	}
	abs() {
		return bigfloat.fromNumAndSign(false, this.basenum)
	}
	neg() {
		return bigfloat.fromNumAndSign(!this.sign, this.basenum)
	}
	add(other) {
		other = new bigfloat(other)
		if (this.sign === other.sign)
			return bigfloat.fromNumAndSign(this.sign, this.basenum.add(other.basenum))
		else if (this.abs().greaterThan(other.abs()))
			return bigfloat.fromNumAndSign(this.sign, this.basenum.sub(other.basenum))
		else
			return bigfloat.fromNumAndSign(other.sign, other.basenum.sub(this.basenum))
	}
	sub(other) {
		return this.add(other.neg())
	}
	mul(other) {
		other = new bigfloat(other)
		return bigfloat.fromNumAndSign(this.sign !== other.sign, this.basenum.mul(other.basenum))
	}
	div(other) {
		other = new bigfloat(other)
		return bigfloat.fromNumAndSign(this.sign !== other.sign, this.basenum.div(other.basenum))
	}
	mod(other) {
		other = new bigfloat(other)
		return bigfloat.fromNumAndSign(this.sign, this.basenum.mod(other.basenum))
	}
	pow(other) {
		other = new bigfloat(other)
		return bigfloat.fromNumAndSign(this.sign, this.basenum.pow(other.basenum))
	}
	equals(other) {
		other = new bigfloat(other)
		if (this.basenum.equals(other.basenum))
			if (this.basenum.numerator == 0) return true
			else return this.sign === other.sign
		return false
	}
	lessThan(other) {
		other = new bigfloat(other)
		return this.sign === other.sign ? this.basenum.lessThan(other.basenum) : this.sign
	}
	greaterThan(other) {
		other = new bigfloat(other)
		return this.sign === other.sign ? this.basenum.greaterThan(other.basenum) : !this.sign
	}
	compare(other) {
		other = new bigfloat(other)
		return this.sign === other.sign ? this.basenum.compare(other.basenum) : [1, -1][this.sign]
	}
	floor() {
		return bigfloat.fromNumAndSign(this.sign, new ubigfloat(this.basenum.floor()))
	}
	toBoolean() {
		return this.basenum.greaterThan(0n)
	}
	static eval(string) {
		// 去除所有空格
		string = string.replace(/\s+/g, "")

		// 校验表达式合法性
		if (!/^[\d!%&()*+./<=>|\-]+$/.test(string))
			throw new Error(`Invalid characters in expression: ${string}`)


		// 定义运算符优先级和关联性
		const precedence = {
			"**": { prec: 4, assoc: "right" },
			"~": { prec: 5, assoc: "right" }, // 一元负号
			"*": { prec: 3, assoc: "left" },
			"/": { prec: 3, assoc: "left" },
			"%": { prec: 3, assoc: "left" },
			"+": { prec: 2, assoc: "left" },
			"-": { prec: 2, assoc: "left" },
			"<": { prec: 1, assoc: "left" },
			">": { prec: 1, assoc: "left" },
			"<=": { prec: 1, assoc: "left" },
			">=": { prec: 1, assoc: "left" },
			"==": { prec: 1, assoc: "left" },
			"!=": { prec: 1, assoc: "left" },
			"&&": { prec: 0, assoc: "left" },
			"||": { prec: 0, assoc: "left" },
			"!": { prec: 5, assoc: "right" }, // 与一元负号相同
		}

		// 将中缀表达式转换为后缀表达式 (Shunting-Yard 算法)
		function toPostfix(tokens) {
			const outputQueue = []
			const operatorStack = []

			for (let i = 0; i < tokens.length; i++) {
				const token = tokens[i]

				if (token.match(/[\d.]+/))
					// 数字直接进入输出队列
					outputQueue.push(token)
				else if (token in precedence)
					// 处理一元负号
					if (token === "-" && (i === 0 || tokens[i - 1] in precedence || tokens[i - 1] === "("))
						operatorStack.push("~") // 用 "~" 表示一元负号
					else {
						// 处理运算符
						// 检查连续的运算符
						if (i > 0 && tokens[i - 1] in precedence && tokens[i - 1] !== "~")
							console.warn("  WARNING: Consecutive operators detected:", tokens[i - 1], token)

						while (
							operatorStack.length > 0 && // 确保 operatorStack 不为空
							operatorStack[operatorStack.length - 1] !== "(" &&
							(precedence[token].prec < precedence[operatorStack[operatorStack.length - 1]].prec ||
								(precedence[token].prec === precedence[operatorStack[operatorStack.length - 1]].prec &&
									precedence[token].assoc === "left"))
						)
							outputQueue.push(operatorStack.pop())

						operatorStack.push(token)
					}
				else if (token === "(")
					// 左括号入栈
					operatorStack.push(token)
				else if (token === ")") {
					// 右括号，弹出运算符直到遇到左括号
					while (operatorStack.length > 0 && operatorStack[operatorStack.length - 1] !== "(")
						outputQueue.push(operatorStack.pop())

					if (operatorStack.length === 0)
						throw new Error("Mismatched parentheses")

					operatorStack.pop() // 弹出左括号
				} else
					throw new Error(`Invalid token: ${token}`)

			}

			// 将剩余的运算符弹出
			while (operatorStack.length > 0) {
				if (operatorStack[operatorStack.length - 1] === "(")
					throw new Error("Mismatched parentheses")

				outputQueue.push(operatorStack.pop())
			}

			return outputQueue
		}

		// 计算后缀表达式
		function evaluatePostfix(postfix) {
			const stack = []

			for (const token of postfix)
				if (token.match(/[\d.]+/))
					// 数字直接入栈
					stack.push(new bigfloat(token))
				else if (token in precedence || token === "~")
					// 运算符
					if (token === "!") {
						const operand = stack.pop()
						stack.push(new bigfloat(!operand.toBoolean()))
					} else if (token === "~") {
						const operand = stack.pop()
						stack.push(operand.neg())
					} else {
						const right = stack.pop()
						const left = stack.pop()
						switch (token) {
							case "+":
								stack.push(left.add(right))
								break
							case "-":
								stack.push(left.sub(right))
								break
							case "*":
								stack.push(left.mul(right))
								break
							case "/":
								stack.push(left.div(right))
								break
							case "%":
								stack.push(left.mod(right))
								break
							case "**":
								stack.push(left.pow(right))
								break
							case "==":
								stack.push(new bigfloat(left.equals(right)))
								break
							case "<":
								stack.push(new bigfloat(left.lessThan(right)))
								break
							case ">":
								stack.push(new bigfloat(left.greaterThan(right)))
								break
							case "<=":
								stack.push(new bigfloat(!left.greaterThan(right)))
								break
							case ">=":
								stack.push(new bigfloat(!left.lessThan(right)))
								break
							case "!=":
								stack.push(new bigfloat(!left.equals(right)))
								break
							case "&&":
								stack.push(new bigfloat(left.toBoolean() && right.toBoolean()))
								break
							case "||":
								stack.push(new bigfloat(left.toBoolean() || right.toBoolean()))
								break
							default:
								throw new Error(`Invalid operator: ${token}`)
						}
					}



			if (stack.length !== 1)
				throw new Error(`Invalid expression: ${string}`)


			return stack[0]
		}

		// 分词
		const tokens = string.match(/(\d+(\.\d+)?(\[\d+])?|\*\*|[%*+/\-]|&&|\|\||<=|>=|==|!=|!|\(|\))/g)

		// 将中缀表达式转换为后缀表达式
		const postfix = toPostfix(tokens)

		// 计算后缀表达式并返回结果
		return evaluatePostfix(postfix)
	}
	static evalFromStrings(string) {
		let exprs = string.match(/[\d!%()*+/<=>[\]\-]+/g)
		/** @type {Record<string, bigfloat>} */
		let result = {}
		for (let expr of exprs) try {
			if (expr.match(/^[\d.]*$/)) continue // 跳过纯数字
			else if (!expr.match(/\d/)) continue // 跳过纯运算符
			result[expr] = bigfloat.eval(expr)
		} catch (e) { }
		return result
	}
}
/**
 * @type {bigfloat & ((value: string | number) => bigfloat)}
 */
let bigfloatProxy = new Proxy(bigfloat, {
	apply(target, thisArg, args) {
		return new bigfloat(args[0])
	}
})

export {
	bigfloatProxy as bigfloat
}
