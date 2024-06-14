let regex = /^<-<WI(推理节点|推理節點|LogicalNode)(：|:)([\s\S]+?)>->$/g
/**
 * Determines if the given string is a WI Logic Node.
 *
 * @param {string} str - The string to check.
 * @return {boolean} Returns true if the string is a WI Logic Node, false otherwise.
 */
export function is_WILogicNode(str) {
	return regex.test(str)
}
