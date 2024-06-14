module.exports = {
	"rules": {
		// 移除多余的分号
		"semi": [
			"error", "never"
		],
		// 当块内容只有一行时，移除块的大括号
		"curly": ["error", "multi"],
		// tab 缩进
		"indent": ["error", "tab", { "VariableDeclarator": 1, "MemberExpression": 1, "SwitchCase": 1 }],
	}
}
