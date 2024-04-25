import fs from 'fs';
import path from 'path';
import yaml from 'yaml';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const yamlFilePath = `${__dirname}/../char_data/index.yaml`;
const v1yamlFilePath = `${__dirname}/../char_data/v1.yaml`;
const character_book_path = `${__dirname}/../char_data/character_book`;

import charDataParser from './character-card-parser.mjs';

const cardFilePath = `${__dirname}/data/cardpath.txt`;

class CardFileInfo_t {
	#cardPath;


	constructor() {
		this.#cardPath = this.readCardPath();
	}

	get cardPath() {
		return this.#cardPath;
	}

	set cardPath(value) {
		this.writeCardPath(this.#cardPath = value);
	}

	readCardPath() {
		return fs.readFileSync(cardFilePath, 'utf8').trimEnd();
	}

	writeCardPath(value) {
		fs.writeFileSync(cardFilePath, value);
	}

	metaData = {};
	v1metaData = {};

	character_book = {};

	// 读取卡片信息
	async readCardInfo() {
		const path = this.cardPath;
		if (!path) {
			return;
		}
		//读取png文件的metaData
		this.metaData = charDataParser.parse(path, 'png');
		//\r\n
		this.metaData = this.metaData.replace(/\\r\\n/g, '\\n');
		//string to object
		this.metaData = JSON.parse(this.metaData);
		//only keep v2 data
		this.v1metaData = this.metaData;
		this.metaData = this.metaData.data
		//split character_book
		this.character_book = this.metaData.character_book;
	}
	async saveCardInfo(path=this.cardPath) {
		if (!path) {
			return;
		}
		const buffer = fs.readFileSync(path);
		//写入png文件的metaData
		var charData = JSON.stringify(this.v1metaData);
		buffer = charDataParser.write(buffer, charData);
		fs.writeFileSync(path, buffer);
	}
	async saveDataFiles() {
		var yamlStr = yaml.stringify({...this.metaData, character_book: null});
		fs.writeFileSync(yamlFilePath, yamlStr);
		yamlStr = yaml.stringify({...this.v1metaData, data: null});
		fs.writeFileSync(v1yamlFilePath, yamlStr);
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
		yamlStr = yaml.stringify({...character_book, entries: null});
		fs.writeFileSync(character_book_path + '/index.yaml', yamlStr);
	}
	async readDataFiles() {
		this.metaData = yaml.parse(fs.readFileSync(yamlFilePath, 'utf8'));
		this.v1metaData = yaml.parse(fs.readFileSync(v1yamlFilePath, 'utf8'));
		this.character_book = yaml.parse(fs.readFileSync(character_book_path + '/index.yaml', 'utf8'));
		this.character_book.entries = {};
		var character_book_dir = fs.readdirSync(character_book_path+'/entries');
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
var CardFileInfo = new CardFileInfo_t();

export {
	CardFileInfo,
	CardFileInfo as default,
	CardFileInfo_t,
}
