import fs from 'fs';
import path from 'path';
import yaml from 'yaml';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const yamlFilePath = `${__dirname}/../char_data/index.yaml`;
const character_book_path = `${__dirname}/../char_data/character_book`;
const packageJsonFilePath = `${__dirname}/../package.json`;

import charDataParser from './character-card-parser.mjs';

const cardFilePath = `${__dirname}/data/cardpath.txt`;

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
		//写入png文件的metaData
		var charData = JSON.stringify(this.v1metaData);
		charData = charData.replace(/{{char_version}}/g, this.metaData.character_version);
		buffer = charDataParser.write(buffer, charData);
		fs.writeFileSync(path, buffer, { encoding: 'binary' });
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
		this.v1metaData = {
			name: this.metaData.name,
			description: this.metaData.description,
			personality: this.metaData.personality,
			scenario: this.metaData.scenario,
			first_mes: this.metaData.first_mes,
			mes_example: this.metaData.mes_example,
			creatorcomment: this.metaData.creator_notes,
			avatar: 'none',
			talkativeness: this.metaData.extensions.talkativeness,
			fav: this.metaData.extensions.fav,
			spec: 'chara_card_v2',
			spec_version: "2.0",
			tags: this.metaData.tags
		}
		if (this.metaData.create_by)
			this.v1metaData.create_by = this.metaData.create_by
		if (this.metaData.create_date) {
			this.v1metaData.create_date = this.metaData.create_date
			delete this.metaData.create_date
		}
		this.character_book = yaml.parse(fs.readFileSync(character_book_path + '/index.yaml', 'utf8'));
		this.character_book.entries = [];
		var character_book_dir = fs.readdirSync(character_book_path + '/entries');
		for (const key of character_book_dir) {
			var filePath = character_book_path + '/entries/' + key;
			var yamlStr = fs.readFileSync(filePath, 'utf8');
			var data = yaml.parse(yamlStr);
			this.character_book.entries[data.id] = data;
		}
		this.v1metaData.data = this.metaData;
		this.metaData.character_book = this.character_book;
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
