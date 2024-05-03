import path from 'path';
import { fileURLToPath } from 'url';
import { v2CharData } from '../../src/charData.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let buildCfg = {
	GetPngFile: () => {
		return path.join(__dirname, '../img/static.png');
	},
	dataUpdater: (
		/** @type {v2CharData} */
		data
	) => {
		let datastr = JSON.stringify(data);
		datastr = datastr.replace(/<!--hide-for-fools-->([\s\S]*?)<!--\/hide-for-fools-->/g, '<!-->');
		datastr = datastr.replace(/<!--badges-->([\s\S]*?)<!--\/badges-->/g, '<!-->');
		datastr = datastr.replace(/<!--exlinks-->([\s\S]*?)<!--\/exlinks-->/g, '<!-->');
		datastr = datastr.replace(/(\\n)+<\!-->(\\n)+/g, '\\n');
		datastr = datastr.replace(/(\\n)+<\!-->/g, '\\n');
		datastr = datastr.replace(/<\!-->(\\n)+/g, '\\n');
		datastr = datastr.replace(/<\!-->/g, '');
		data = JSON.parse(datastr);
		data.mes_example = ''
		return data
	}
}
export default buildCfg
