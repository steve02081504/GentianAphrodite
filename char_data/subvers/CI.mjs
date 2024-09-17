import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let buildCfg = {
	GetPngFile: () => {
		return path.join(__dirname, '../img/mini.png')
	},
	UseCompiler: false,
	UseCrypto: false
}
export default buildCfg
