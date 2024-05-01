import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let buildCfg = {
	GetPngFile: () => {
		return path.join(__dirname, '../img/static.png');
	},
	dataUpdater: (data) => {
		let datastr = JSON.stringify(data);
		datastr = datastr.replace(/<!--hide-for-fools-->([\s\S]*?)<!--\/hide-for-fools-->/g, '<!-->');
		datastr = datastr.replace(/<!--exlinks-->([\s\S]*?)<!--\/exlinks-->/g, '<!-->');
		datastr = datastr.replace(/(\\n)+<\!-->(\\n)+/g, '\\n');
		datastr = datastr.replace(/(\\n)+<\!-->/g, '\\n');
		datastr = datastr.replace(/<\!-->(\\n)+/g, '\\n');
		datastr = datastr.replace(/<\!-->/g, '');
		return JSON.parse(datastr);
	}
}
export default buildCfg
