import fs from 'fs';
import path from 'path';
import sha256 from 'crypto-js/sha256.js';
import yaml from 'yaml';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const yamlFilePath = `${__dirname}/../char_data/index.yaml`;
const character_book_path = `${__dirname}/../char_data/character_book`;
const packageJsonFilePath = `${__dirname}/../package.json`;
const SubVerCfgsDir = `${__dirname}/../char_data/subvers`;
const ImgsDir = `${__dirname}/../char_data/img`;
const BuildDir = `${__dirname}/../build`;

import charDataParser from './character-card-parser.mjs';
import { GetV1CharDataFromV2, v2CharData, v1CharData, WorldInfoBook } from './charData.mjs';

const cardFilePath = `${__dirname}/data/cardpath.txt`;

/** @type {yaml.DocumentOptions & yaml.SchemaOptions & yaml.ParseOptions & yaml.CreateNodeOptions & yaml.ToStringOptions} */
const yamlConfig = {
	lineWidth: Number.POSITIVE_INFINITY
}

/**
 * Checks if two arrays are equal.
 * @param {Array} a - The first array.
 * @param {Array} b - The second array.
 * @return {boolean} True if the arrays are equal, false otherwise.
 */
function arraysEqual(a, b) {
	if (a === b) return true;
	if (a == null || b == null) return false;
	if (a.length !== b.length) return false;

	for (var i = 0; i < a.length; ++i)
		if (a[i] !== b[i])
			return false;
	return true;
}

/**
 * Class for reading and writing card information.
 */
class CardFileInfo_t {
	#cardPath;

	/**
	 * Constructor function for initializing the cardPath property.
	 * @param {string} [path=this.readCardPath()] - The path to the PNG file. If not provided, the default card path will be used.
	 * @return {void}
	 */
	constructor(path) {
		this.#cardPath = path || this.readCardPath();
	}

	/**
	 * Gets the value of the card path.
	 * @return {any} The value of the card path.
	 */
	get cardPath() {
		return this.#cardPath;
	}

	/**
	 * Sets the value of the card path and writes it to a file.
	 * @param {any} value - The new value of the card path.
	 * @return {void}
	 */
	set cardPath(value) {
		this.writeCardPath(this.#cardPath = value);
	}

	/**
	 * Reads the card path from the specified file.
	 * @return {string} The card path read from the file.
	 */
	readCardPath() {
		if (!fs.existsSync(cardFilePath)) return;
		return fs.readFileSync(cardFilePath, 'utf8').trimEnd();
	}

	/**
	 * Writes the card path to a file.
	 * @param {string} value - The value to write to the card path file.
	 * @return {void}
	 */
	writeCardPath(value) {
		fs.writeFileSync(cardFilePath, value);
	}

	/**
	 * The meta data of the PNG file, v2
	 * @type {v2CharData}
	 */
	metaData = {};
	/**
	 * The meta data of the PNG file, v1
	 * @type {v1CharData}
	 */
	v1metaData = {};
	/**
	 * The character book of the PNG file
	 * @type {WorldInfoBook}
	 */
	character_book = {};

	/**
	 * Reads card information from a specified path.
	 * @param {string} [path=this.cardPath] - The path to read the card information from. Defaults to the current card path.
	 * @return {void}
	 */
	readCardInfo(path = this.cardPath) {
		if (!path) return;
		//读取png文件的metaData
		var metaDataStr = charDataParser.parse(path, 'png');
		//\r\n
		metaDataStr = metaDataStr.replace(/\\r\\n/g, '\\n');
		//string to object
		this.v1metaData = JSON.parse(metaDataStr);
		if (this.v1metaData.data.character_version) {
			metaDataStr = metaDataStr.replace(`\`${this.v1metaData.data.character_version}\``, '{{char_version}}');
			metaDataStr = metaDataStr.replace(new RegExp(`-v${this.v1metaData.data.character_version}-`, 'g'), '-v{{char_version}}-');
			this.v1metaData = JSON.parse(metaDataStr);
		}
		this.metaData = this.v1metaData.data
		this.character_book = this.metaData.character_book;
		//remove chat data in v1
		delete this.v1metaData.chat;
	}
	/**
	 * Saves the card information to a PNG file.
	 * @param {string} [path=this.cardPath] - The path to the PNG file. If not provided, the default card path will be used.
	 * @return {void}
	 */
	saveCardInfo(path = this.cardPath) {
		if (!path) return;
		var buffer = fs.readFileSync(path);
		fs.writeFileSync(path, this.UpdatePngBufferInfo(buffer, false), { encoding: 'binary' });
	}
	/**
	 * Saves the data files including meta data and character book entries.
	 * @return {void}
	 */
	saveDataFiles() {
		var data = { ...this.metaData, create_date: this.v1metaData.create_date }
		delete data.character_book
		var packageJson = JSON.parse(fs.readFileSync(packageJsonFilePath, 'utf8'));
		packageJson.version = data.character_version;
		fs.writeFileSync(packageJsonFilePath, JSON.stringify(packageJson, null, '\t') + '\n');
		delete data.character_version
		var yamlStr = yaml.stringify(data, yamlConfig);
		fs.writeFileSync(yamlFilePath, yamlStr);
		fs.rmSync(character_book_path + '/entries', { recursive: true, force: true });
		fs.mkdirSync(character_book_path + '/entries');
		var character_book = this.character_book;
		data = { ...character_book }
		delete data.entries
		data.index_list = []
		data.display_index_list = []
		var disabledDatas = []
		for (const key in character_book.entries) {
			var entrie = { ...character_book.entries[key] };
			var fileName = entrie.comment || entrie.keys[0];
			data.index_list[entrie.id] = fileName
			data.display_index_list[entrie.extensions.display_index] = fileName
			delete entrie.id
			delete entrie.extensions.display_index
			if (entrie.enabled) {
				var filePath = character_book_path + '/entries/' + fileName + '.yaml';
				var yamlStr = yaml.stringify(entrie, yamlConfig);
				fs.writeFileSync(filePath, yamlStr);
			}
			else
				disabledDatas.push(entrie);
		}
		if (arraysEqual(data.index_list, data.display_index_list)) delete data.display_index_list
		yamlStr = yaml.stringify(data, yamlConfig);
		fs.writeFileSync(character_book_path + '/index.yaml', yamlStr);
		if (disabledDatas.length) {
			yamlStr = yaml.stringify(disabledDatas, yamlConfig);
			fs.writeFileSync(character_book_path + '/disabled_entries.yaml', yamlStr);
		}
	}
	/**
	 * Reads data files and populates the metaData, v1metaData, and character_book properties.
	 * @return {void}
	 */
	readDataFiles() {
		this.metaData = yaml.parse(fs.readFileSync(yamlFilePath, 'utf8'));
		var packageJson = JSON.parse(fs.readFileSync(packageJsonFilePath, 'utf8'));
		this.metaData.character_version = packageJson.version;
		this.v1metaData = GetV1CharDataFromV2(this.metaData);
		this.metaData.character_book = this.character_book = yaml.parse(fs.readFileSync(character_book_path + '/index.yaml', 'utf8'));
		this.character_book.entries = [];
		var character_book_dir = fs.readdirSync(character_book_path + '/entries');
		this.character_book.display_index_list ??= this.character_book.index_list
		for (const key of character_book_dir) {
			var filePath = character_book_path + '/entries/' + key;
			var yamlStr = fs.readFileSync(filePath, 'utf8');
			var data = yaml.parse(yamlStr);
			var fileName = key.replace(/\.yaml$/, '');
			data.id = this.character_book.index_list.indexOf(fileName);
			data.extensions.display_index = this.character_book.display_index_list.indexOf(fileName);
			this.character_book.entries[data.id] = data;
		}
		if (fs.existsSync(character_book_path + '/disabled_entries.yaml')) {
			var yamlStr = fs.readFileSync(character_book_path + '/disabled_entries.yaml', 'utf8');
			var datas = yaml.parse(yamlStr);
			for (const data of datas) {
				var key = data.comment || data.keys[0];
				data.id = this.character_book.index_list.indexOf(key);
				data.extensions.display_index = this.character_book.display_index_list.indexOf(key);
				this.character_book.entries[data.id] = data;
			}
		}
		delete this.character_book.index_list
		delete this.character_book.display_index_list
	}
	/**
	 * Updates the PNG buffer information with metadata.
	 *
	 * @param {Buffer} buffer - The buffer to update with metadata.
	 * @param {function} VerIdUpdater - A function that takes the current character version and returns the updated character version.
	 * @param {function} dataUpdater - A function that takes the current character data and returns the updated character data.
	 * @return {Buffer} The updated PNG buffer.
	 */
	UpdatePngBufferInfo(buffer, usecrypto = true, VerIdUpdater = a => a, dataUpdater = a => a) {
		if (!buffer) return;
		var VerId = VerIdUpdater(this.metaData.character_version);
		/** @type {v2CharData} */
		var charData = dataUpdater({
			...this.metaData,
			character_version: VerId,
			create_date: this.v1metaData.create_date
		});
		var charDataStr = JSON.stringify(GetV1CharDataFromV2({ ...charData }));
		charDataStr = charDataStr.replace(/-v{{char_version}}-/g, `-v${VerId}-`).replace(/{{char_version}}/g, `\`${VerId}\``);
		if (usecrypto) {
			charDataStr = charDataStr.replace(/<-<WI(推理节点|推理節點|LogicalNode)(：|:)([\s\S]+?)>->*/g, (key) => {
				return '<-' + sha256(charData.creator + key).toString().substring(0, 6) + '->'
			})
			/** @type {v1CharData} */
			let v1charData = JSON.parse(charDataStr);
			charData = v1charData.data
			var book = charData.character_book.entries;
			let currentIndex = book.length;

			while (currentIndex != 0) {
				let randomIndex = Math.floor(Math.random() * currentIndex);
				let randomIndex2 = Math.floor(Math.random() * currentIndex);
				currentIndex--;

				[book[currentIndex], book[randomIndex]] = [book[randomIndex], book[currentIndex]];
				[book[currentIndex].extensions.display_index, book[randomIndex2].extensions.display_index] = [book[randomIndex2].extensions.display_index, book[currentIndex].extensions.display_index];
			}

			var randomCommts = ["东西", '不是东西', '可能是个东西', '屎', '菠萝', '苹果', '可能不是个东西', '史记', '寄吧', '我是傻逼', '？', '我去'];
			var uid = 0;
			for (var entrie of book) {
				entrie.comment = randomCommts[Math.floor(Math.random() * randomCommts.length)];
				entrie.id = uid++;
			}
			charDataStr = JSON.stringify(v1charData);
		}
		return charDataParser.write(buffer, charDataStr);
	}
	/**
	 * Asynchronously builds PNG buffer information based on the provided subversion ID.
	 *
	 * @param {string} [subverId='default'] - The subversion ID to build the PNG buffer for.
	 * @return {Promise<Buffer>} A Promise that resolves with the updated PNG buffer.
	 */
	async buildPngBufferInfo(subverId = 'default') {
		let SubVerCfg = await import(pathToFileURL(`${SubVerCfgsDir}/${subverId}.mjs`)).then(m => m.default || m);
		SubVerCfg = {
			GetPngFile: () => {
				const imageFilePaths = [
					this.cardPath,
					`${ImgsDir}/${subverId}.png`,
					`${ImgsDir}/static.png`,
					`${ImgsDir}/default.png`
				];
				return imageFilePaths.find(fs.existsSync);
			},
			VerIdUpdater: (charVer) => subverId == "default" ? charVer : `${charVer}-${subverId}`,
			UseCrypto: true,
			...SubVerCfg
		}
		let buffer = fs.readFileSync(SubVerCfg.GetPngFile());
		return this.UpdatePngBufferInfo(buffer, SubVerCfg.UseCrypto, SubVerCfg.VerIdUpdater, SubVerCfg.dataUpdater);
	}
	/**
	 * Asynchronously builds a PNG file at the specified subversion ID and saves it to the specified path.
	 *
	 * @param {string} [subverId='default'] - The subversion ID to build the PNG file for.
	 * @param {string} [SavePath=`${BuildDir}/${subverId}.png`] - The path to save the PNG file to.
	 * @return {Promise<void>} A Promise that resolves when the PNG file is built and saved successfully.
	 */
	async Build(subverId = 'default', SavePath = `${BuildDir}/${subverId}.png`) {
		let buffer = await this.buildPngBufferInfo(subverId);
		fs.mkdirSync(path.dirname(SavePath), { recursive: true });
		fs.writeFileSync(SavePath, buffer, { encoding: 'binary' });
	}
}
/**
 * The default instance of the CardFileInfo class.
 * @type {CardFileInfo_t}
 */
var CardFileInfo = new CardFileInfo_t();

export {
	CardFileInfo,
	CardFileInfo as default,
	CardFileInfo_t,
}
