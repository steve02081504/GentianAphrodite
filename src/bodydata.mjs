// 根据手的长和宽预测手的其他部位的长度
// 只针对未成年人
// 龙胆除去乳房来说身形约等于未成年所以ok
function predictHandPartLength(palmLength, handWidth, gender = 'female') {
	// 回归方程系数
	const equations = {
		male: {
			palm: [2.35, 0.556, 0],
			thumb: [-2.60, 0.335, 0],
			index: [-0.36, 0.389, 0],
			middle: [-1.02, 0.439, 0],
			ring: [-1.42, 0.413, 0],
			little: [-1.64, 0.328, 0],
			fingertipDistance: [10.98, 0.645, 0],
			indexWidthNear: [2.79, 0.199, 1],
			indexWidthFar: [3.05, 0.168, 1],
			thumbJointWidth: [4.14, 0.200, 1]
		},
		female: {
			palm: [1.95, 0.552, 0],
			thumb: [-1.21, 0.329, 0],
			index: [0.35, 0.393, 0],
			middle: [0.80, 0.433, 0],
			ring: [1.25, 0.399, 0],
			little: [-0.72, 0.321, 0],
			fingertipDistance: [14.84, 0.613, 0],
			indexWidthNear: [2.40, 0.203, 1],
			indexWidthFar: [2.72, 0.173, 1],
			thumbJointWidth: [3.10, 0.209, 1]
		}
	}

	// 根据性别获取回归方程系数组
	const data = equations[gender]
	let result = {}

	for (let key in data) {
		// 计算并保存回归方程系数
		const [intercept, slope, widthFlag] = data[key]
		// 根据widthFlag选择使用手长还是手宽
		const lengthToUse = widthFlag === 0 ? palmLength : handWidth
		// 计算并返回预测长度
		result[key] = intercept + slope * lengthToUse
	}

	return result
}
