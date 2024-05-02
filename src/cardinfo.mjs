import fs from 'fs';
import path from 'path';
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

const cardFilePath = `${__dirname}/data/cardpath.txt`;

/**
 * Retrieves V1 character data from V2 data.
 *
 * @param {Object} data - The V2 data object containing character information.
 * @return {Object} The V1 character data extracted from the V2 data.
 */
function GetV1CharDataFromV2(data) {
	var aret = {}
	var move_pepos = ['name', 'description', 'personality', 'scenario', 'first_mes', 'mes_example', 'tags', 'create_by', 'create_date']
	for (const key of move_pepos) if (data[key]) aret[key] = data[key]
	var extension_pepos = ['talkativeness', 'fav']
	for (const key of extension_pepos) aret[key] = data.extensions[key]
	aret = {
		...aret,
		creatorcomment: data.creator_notes,
		avatar: 'none',
		spec: 'chara_card_v2',
		spec_version: "2.0",
		data: data
	}

	delete data.create_date
	return aret
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

	metaData = {};
	v1metaData = {};

	character_book = {};

	/**
	 * Reads card information from a specified path.
	 * @param {string} [path=this.cardPath] - The path to read the card information from. Defaults to the current card path.
	 * @return {Promise<void>} A Promise that resolves when the card information is successfully read.
	 */
	async readCardInfo(path = this.cardPath) {
		if (!path) return;
		//读取png文件的metaData
		this.metaData = charDataParser.parse(path, 'png');
		//\r\n
		this.metaData = this.metaData.replace(/\\r\\n/g, '\\n');
		//string to object
		var metaDataStr = this.metaData;
		this.metaData = JSON.parse(this.metaData);
		if (this.metaData.data.character_version) {
			metaDataStr = metaDataStr.replace(`\`${this.metaData.data.character_version}\``, '{{char_version}}');
			this.metaData = JSON.parse(metaDataStr);
		}
		//only keep v2 data
		this.v1metaData = this.metaData;
		this.metaData = this.metaData.data
		//split character_book
		this.character_book = this.metaData.character_book;
		//remove chat data in v1
		delete this.v1metaData.chat;
	}
	/**
	 * Saves the card information to a PNG file.
	 * @param {string} [path=this.cardPath] - The path to the PNG file. If not provided, the default card path will be used.
	 * @return {Promise<void>} A Promise that resolves when the card information is successfully saved.
	 */
	async saveCardInfo(path = this.cardPath) {
		if (!path) return;
		var buffer = fs.readFileSync(path);
		fs.writeFileSync(path, this.UpdatePngBufferInfo(buffer), { encoding: 'binary' });
	}
	/**
	 * Saves the data files including meta data and character book entries.
	 * @return {Promise<void>} A Promise that resolves when the data files are successfully saved.
	 */
	async saveDataFiles() {
		var data = { ...this.metaData, create_date: this.v1metaData.create_date }
		delete data.character_book
		var packageJson = JSON.parse(fs.readFileSync(packageJsonFilePath, 'utf8'));
		packageJson.version = data.character_version;
		fs.writeFileSync(packageJsonFilePath, JSON.stringify(packageJson, null, '\t') + '\n');
		delete data.character_version
		var yamlStr = yaml.stringify(data);
		fs.writeFileSync(yamlFilePath, yamlStr);
		fs.rmSync(character_book_path + '/entries', { recursive: true, force: true });
		fs.mkdirSync(character_book_path + '/entries');
		var character_book = this.character_book;
		for (const key in character_book.entries) {
			var entrie = character_book.entries[key];
			var fileName = entrie.comment || key;
			var filePath = character_book_path + '/entries/' + fileName + '.yaml';
			var yamlStr = yaml.stringify(entrie);
			fs.writeFileSync(filePath, yamlStr);
		}
		data = { ...character_book }
		delete data.entries
		yamlStr = yaml.stringify(data);
		fs.writeFileSync(character_book_path + '/index.yaml', yamlStr);
	}
	/**
	 * Reads data files and populates the metaData, v1metaData, and character_book properties.
	 * @return {Promise<void>} A Promise that resolves when the data files are successfully read.
	 */
	async readDataFiles() {
		this.metaData = yaml.parse(fs.readFileSync(yamlFilePath, 'utf8'));
		var packageJson = JSON.parse(fs.readFileSync(packageJsonFilePath, 'utf8'));
		this.metaData.character_version = packageJson.version;
		this.v1metaData = GetV1CharDataFromV2(this.metaData);
		this.metaData.character_book = this.character_book = yaml.parse(fs.readFileSync(character_book_path + '/index.yaml', 'utf8'));
		this.character_book.entries = [];
		var character_book_dir = fs.readdirSync(character_book_path + '/entries');
		for (const key of character_book_dir) {
			var filePath = character_book_path + '/entries/' + key;
			var yamlStr = fs.readFileSync(filePath, 'utf8');
			var data = yaml.parse(yamlStr);
			this.character_book.entries[data.id] = data;
		}
	}
	/**
	 * Updates the PNG buffer information with metadata.
	 *
	 * @param {Buffer} buffer - The buffer to update with metadata.
	 * @param {function} VerIdUpdater - A function that takes the current character version and returns the updated character version.
	 * @param {function} dataUpdater - A function that takes the current character data and returns the updated character data.
	 * @return {Buffer} The updated PNG buffer.
	 */
	UpdatePngBufferInfo(buffer, VerIdUpdater = a => a, dataUpdater = a => a) {
		if (!buffer) return;
		var VerId = VerIdUpdater(this.metaData.character_version);
		var charData = dataUpdater({
			...this.metaData,
			character_version: VerId
		});
		charData = JSON.stringify(GetV1CharDataFromV2({ ...charData }));
		charData = charData.replace(/{{char_version}}/g, VerId);
		return charDataParser.write(buffer, charData);
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
			...SubVerCfg
		}
		let buffer = fs.readFileSync(SubVerCfg.GetPngFile());
		return this.UpdatePngBufferInfo(buffer, SubVerCfg.VerIdUpdater, SubVerCfg.dataUpdater);
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
 * @type {CardFileInfo}
 */
var CardFileInfo = new CardFileInfo_t();

export {
	CardFileInfo,
	CardFileInfo as default,
	CardFileInfo_t,
}
