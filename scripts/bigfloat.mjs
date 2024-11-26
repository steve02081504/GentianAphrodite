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
		return this.numerator * other.denominator - other.numerator * this.denominator
	}
	floor() {
		return this.numerator / this.denominator
	}
	toString() {
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
let bigfloat = class {
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
		return this.sign === other.sign && this.basenum.equals(other.basenum)
	}
	lessThan(other) {
		other = new bigfloat(other)
		return this.sign === other.sign ? this.basenum.lessThan(other.basenum) : this.sign
	}
	greaterThan(other) {
		other = new bigfloat(other)
		return this.sign === other.sign ? this.basenum.greaterThan(other.basenum) : !this.sign
	}
	floor() {
		return bigfloat.fromNumAndSign(this.sign, this.basenum.floor())
	}
	toBoolean() {
		return this.basenum.greaterThan(0n)
	}
	static eval(string) {
		string = String(string)
		// Remove whitespace and validate input
		string = string.replace(/\s/g, '')
		if (!/^[\d!%&()*+./<=>|\-]+$/.test(string))
			throw new Error(`Invalid characters in expression: ${[...new Set(...string.replace(/[^\d!%&()*+./<=>|\-]/g, ''))].join(',')}`)

		// Tokenize the expression
		let tokens = string.match(/([\d[\]]+(\.[\d[\]]+)?)|([!%&()*+/<=>|\-]+)/g)

		// Convert infix to postfix notation (Shunting-yard algorithm)
		let outputQueue = []
		let operatorStack = []
		let precedence = {
			'**': 4,
			'*': 3,
			'/': 3,
			'%': 3,
			'+': 2,
			'-': 2,
			'<': 1,
			'>': 1,
			'<=': 1,
			'>=': 1,
			'==': 1,
			'!=': 1,
			'&&': 1,
			'||': 1,
			'!': 5
		}
		let associativity = {
			'**': 'right',
			'*': 'left',
			'/': 'left',
			'%': 'left',
			'+': 'left',
			'-': 'left',
			'<': 'left',
			'>': 'left',
			'<=': 'left',
			'>=': 'left',
			'==': 'left',
			'!=': 'left',
			'&&': 'left',
			'||': 'left',
			'!': 'right'
		}

		for (let token of tokens)
			if (!isNaN(token))
				outputQueue.push(new bigfloat(token))
			 else if (token === '(')
				operatorStack.push(token)
			 else if (token === ')') {
				while (operatorStack.length > 0 && operatorStack[operatorStack.length - 1] !== '(')
					outputQueue.push(operatorStack.pop())

				if (operatorStack.length === 0)
					throw new Error('Mismatched parentheses')

				operatorStack.pop() // Pop '('
			} else if (token in precedence) {
				while (operatorStack.length > 0 &&
					(precedence[token] < precedence[operatorStack[operatorStack.length - 1]] ||
						(precedence[token] === precedence[operatorStack[operatorStack.length - 1]] && associativity[token] === 'left')) &&
					operatorStack[operatorStack.length - 1] !== '(')
					outputQueue.push(operatorStack.pop())

				operatorStack.push(token)
			} else
				throw new Error(`Invalid token: '${token}', full expression: ${string}`)



		while (operatorStack.length > 0) {
			if (operatorStack[operatorStack.length - 1] === '(' || operatorStack[operatorStack.length - 1] === ')')
				throw new Error('Mismatched parentheses')

			outputQueue.push(operatorStack.pop())
		}

		// Evaluate postfix expression
		let stack = []
		for (let token of outputQueue)
			if (token instanceof bigfloat)
				stack.push(token)
			 else if (token in precedence)
				if (token === '!') {
					let operand = stack.pop()
					stack.push(new bigfloat(!operand.toBoolean()))
				} else {
					let right = stack.pop()
					let left = stack.pop()
					if (!left || !right) throw new Error(`Invalid expression: '${string}', left or right operand is undefined`)
					switch (token) {
						case '+': stack.push(left.add(right)); break
						case '-': stack.push(left.sub(right)); break
						case '*': stack.push(left.mul(right)); break
						case '/': stack.push(left.div(right)); break
						case '%': stack.push(left.mod(right)); break
						case '**': stack.push(left.pow(right)); break
						case '==': stack.push(new bigfloat(left.equals(right))); break
						case '<': stack.push(new bigfloat(left.lessThan(right))); break
						case '>': stack.push(new bigfloat(left.greaterThan(right))); break
						case '<=': stack.push(new bigfloat(!left.greaterThan(right))); break
						case '>=': stack.push(new bigfloat(!left.lessThan(right))); break
						case '!=': stack.push(new bigfloat(!left.equals(right))); break
						case '&&': stack.push(new bigfloat(left.toBoolean() && right.toBoolean())); break
						case '||': stack.push(new bigfloat(left.toBoolean() || right.toBoolean())); break
						default: throw new Error(`Invalid operator: '${token}', full expression: ${string}`)
					}
				}
			 else
				throw new Error(`Invalid token in postfix expression: '${token}', full expression: ${string}`)

		if (stack.length !== 1)
			throw new Error(`Invalid expression: '${string}'`)

		return stack[0]
	}
	static evalFromStrings(string) {
		let exprs = string.match(/[\d!%()*+/<=>[\]\-]+/g)
		/** @type {Record<string, bigfloat>} */
		let result = {}
		for (let expr of exprs) try {
			if (expr.match(/^[\d.]*$/)) continue // 跳过纯数字
			else if (!expr.match(/\d/)) continue // 跳过纯运算符
			result[expr] = bigfloat.eval(expr)
		} catch (e) {}
		return result
	}
}
/**
 * @type {typeof bigfloat & (value: bigfloat | string | number) => bigfloat}
 */
let bigfloatProxy = new Proxy(bigfloat, {
	apply(target, thisArg, args) {
		return new bigfloat(args[0])
	}
})

export {
	bigfloatProxy as bigfloat
}
