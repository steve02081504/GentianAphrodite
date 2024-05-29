import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const charDataPath = `${__dirname}/../char_data`;
const yamlFilePath = `${__dirname}/../char_data/index.yaml`;
const CharReadMeFilePath = `${__dirname}/../char_data/index.md`;
const character_book_path = `${__dirname}/../char_data/character_book`;
const regex_scripts_path = `${__dirname}/../char_data/regex`;
const packageJsonFilePath = `${__dirname}/../package.json`;
const SubVerCfgsDir = `${__dirname}/../char_data/subvers`;
const ImgsDir = `${__dirname}/../char_data/img`;
const BuildDir = `${__dirname}/../build`;

import charDataParser from './character-card-parser.mjs';
import { GetV1CharDataFromV2, v2CharData, v1CharData, WorldInfoBook } from './charData.mjs';
import { SetCryptoBaseRng, CryptoCharData } from './charCrypto.mjs';
import { v2CharWIbook2WIjson, WIjson2v2CharWIbook } from './WIjsonMaker.mjs';
import { arraysEqual, clearEmptyDirs, nicerWriteFileSync } from './tools.mjs';
import yaml from './yaml.mjs';
import { keyScoreAdder, keyScoreRemover } from './keyScore.mjs';

const cardFilePath = `${__dirname}/data/cardpath.txt`;
const WIjsonFilePath = `${__dirname}/data/WIpath.txt`;

/**
 * Class for reading and writing card information.
 */
class CardFileInfo_t {
	#cardPath;
	#WijsonPath;

	/**
	 * Constructor function for initializing the cardPath property.
	 * @param {string} [path=this.readCardPath()] - The path to the PNG file. If not provided, the default card path will be used.
	 * @return {void}
	 */
	constructor(path) {
		this.#cardPath = path;
	}

	/**
	 * Gets the value of the card path.
	 * @return {string} The value of the card path.
	 */
	get cardPath() {
		return this.#cardPath ??= this.readCardPath();
	}

	/**
	 * Sets the value of the card path and writes it to a file.
	 * @param {string} value - The new value of the card path.
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
		if (value === this.cardPath) return;
		fs.writeFileSync(cardFilePath, value);
	}

	/**
	 * Gets the value of the WIjson path.
	 * @return {string} The value of the WIjson path.
	 */
	get WIjsonPath() {
		return this.#WijsonPath ??= this.readWIjsonPath();
	}

	/**
	 * Sets the value of the WIjson path and writes it to a file.
	 * @param {string} value - The new value of the WIjson path.
	 * @return {void}
	 */
	set WIjsonPath(value) {
		this.writeWIjsonPath(this.#WijsonPath = value);
	}

	/**
	 * Reads the WIjson path from the specified file.
	 * @return {string} The WIjson path read from the file.
	 */
	readWIjsonPath() {
		if (!fs.existsSync(WIjsonFilePath)) return;
		return fs.readFileSync(WIjsonFilePath, 'utf8').trimEnd();
	}

	/**
	 * Writes the WIjson path to a file.
	 * @param {string} value - The value to write to the WIjson path file.
	 * @return {void}
	 */
	writeWIjsonPath(value) {
		if (value === this.WIjsonPath) return;
		fs.writeFileSync(WIjsonFilePath, value);
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
	readCardInfo(path = this.cardPath, readWIjson = true) {
		if (!path) return;
		//读取png文件的metaData
		var metaDataStr = charDataParser.parse(path, 'png');
		//\r\n
		metaDataStr = metaDataStr.replace(/\\r\\n/g, '\\n');
		//string to object
		this.v1metaData = JSON.parse(metaDataStr);
		if (readWIjson && this.WIjsonPath) {
			var wijsonStr = fs.readFileSync(this.WIjsonPath, 'utf8');
			this.v1metaData.data.character_book = {
				...this.v1metaData.data.character_book,
				...WIjson2v2CharWIbook(JSON.parse(wijsonStr))
			};
		}
		keyScoreRemover(this.v1metaData.data.character_book.entries)
		this.metaData = yaml.readFileSync(yamlFilePath);
		this.v1metaData.create_date = this.metaData.create_date;
		this.v1metaData.data.extensions.fav = this.metaData.extensions.fav;
		let ver = this.v1metaData.data.character_version;
		if (ver) {
			metaDataStr = JSON.stringify(this.v1metaData);
			metaDataStr = metaDataStr.replace(new RegExp(`/v${encodeURIComponent(ver)}`, 'g'), '/v{{char_version_url_encoded}}');
			metaDataStr = metaDataStr.replace(new RegExp(ver, 'g'), '{{char_version}}');
			metaDataStr = metaDataStr.replace(/(?<=\/data%20size\/|资料量是)[0-9\.]+KB/g, '{{char_data_size}}');
			this.v1metaData = JSON.parse(metaDataStr);
			let index = ver.indexOf('-dev');
			this.v1metaData.data.character_version = index != -1 ? ver.substring(0, index) : ver;
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
	saveCardInfo(path = this.cardPath, saveWIJson = true) {
		if (!path) return;
		let CharInfoHandler
		if (saveWIJson && this.WIjsonPath) {
			/**
			 * Saves the character book entries to a WIjson file.
			 * @param {v1CharData} CharInfo - The character book entries.
			 * @param {string} SavePath - The path to save the WIjson file to.
			 * @param {function} defaultHandler - The default handler to use if the WIjson file is not found.
			 * @return {void}
			 */
			CharInfoHandler = (CharInfo, SavePath, defaultHandler) => {
				// Save the character book entries to a WIjson file
				let data = v2CharWIbook2WIjson(CharInfo.data.character_book);
				delete data.originalData;
				let dataStr = JSON.stringify(data, null, '\t') + '\n';
				nicerWriteFileSync(this.WIjsonPath, dataStr);
				// Save the character book entries to a PNG file
				defaultHandler(CharInfo, SavePath);
			}
		}
		this.RunBuildCfg({ GetPngFile: _ => path, UseCrypto: false, CharInfoHandler: CharInfoHandler }, 'dev', this.cardPath);
	}
	/**
	 * Saves the data files including meta data and character book entries.
	 * @return {void}
	 */
	saveDataFiles() {
		var data = { ...this.metaData, create_date: this.v1metaData.create_date }
		delete data.character_book
		var packageJson = JSON.parse(fs.readFileSync(packageJsonFilePath, 'utf8'));
		if (packageJson.version != data.character_version) {
			packageJson.version = data.character_version;
			fs.writeFileSync(packageJsonFilePath, JSON.stringify(packageJson, null, '\t') + '\n');
		}
		delete data.character_version
		if (!fs.existsSync(charDataPath)) fs.mkdirSync(charDataPath);
		if (!fs.existsSync(regex_scripts_path)) fs.mkdirSync(regex_scripts_path);
		for (const script of data.extensions.regex_scripts) {
			var filePath = regex_scripts_path + '/' + script.scriptName + '.json';
			var scriptStr = JSON.stringify(script, null, '\t') + '\n';
			nicerWriteFileSync(filePath, scriptStr);
		}
		var regexDir = fs.readdirSync(regex_scripts_path);
		for (const key of regexDir) {
			var filePath = regex_scripts_path + '/' + key;
			if (!data.extensions.regex_scripts.find(x => x.scriptName == key.replace(/\.json$/, '')))
				fs.unlinkSync(filePath);
		}
		delete data.extensions.regex_scripts
		nicerWriteFileSync(CharReadMeFilePath, data.creator_notes);
		delete data.creator_notes
		yaml.writeFileSync(yamlFilePath, data);
		if (!fs.existsSync(character_book_path + '/entries'))
			fs.mkdirSync(character_book_path + '/entries');
		var character_book = this.character_book;
		data = { ...character_book }
		delete data.entries
		data.index_list = []
		data.display_index_list = []
		var disabledDatas = []
		for (const key in character_book.entries) {
			var entrie = character_book.entries[key];
			var fileName = entrie?.comment || entrie?.keys?.[0];
			if (!fileName) {
				console.error(`Error: entry has no comment or keys`, entrie);
				continue
			}
			if (entrie.enabled) {
				var filePathArray = fileName.split(/：|:|\-|(base|fin|sub|start)|（([^）]+)）|\(([^\)]+)\)/g).filter(x => x);
				//trim spaces
				for (let i = 0; i < filePathArray.length; i++)
					filePathArray[i] = filePathArray[i].trim();
				// make dir
				let filePath = character_book_path + '/entries';
				for (let i = 0; i < filePathArray.length - 1; i++) {
					filePath += '/' + filePathArray[i];
					if (!fs.existsSync(filePath))
						fs.mkdirSync(filePath);
				}
				entrie.filePathArray = filePathArray
			}
		}
		let dataArray = []
		for (const key in character_book.entries) {
			var entrie = { ...character_book.entries[key] };
			var fileName = entrie?.comment || entrie?.keys?.[0];
			if (!fileName) continue
			data.index_list[entrie.id] = fileName
			data.display_index_list[entrie.extensions.display_index] = fileName
			delete entrie.id
			delete entrie.extensions.display_index
			if (entrie.enabled) {
				var filePathArray = entrie.filePathArray
				delete entrie.filePathArray
				//if is dir
				let filePath = character_book_path + '/entries/' + filePathArray.join('/');
				if (fs.existsSync(filePath))
					filePath = filePath + '/index.yaml';
				else
					filePath = filePath + '.yaml';
				dataArray.push(filePath.replace(/\\/g, '/'));
				yaml.writeFileSync(filePath, entrie);
			}
			else
				disabledDatas.push(entrie);
		}
		var character_book_dir = fs.readdirSync(character_book_path + '/entries', { recursive: true }).filter(x => x.endsWith('.yaml'));
		for (const file of character_book_dir) {
			var filePath = (character_book_path + '/entries/' + file).replace(/\\/g, '/');
			if (!dataArray.includes(filePath))
				fs.unlinkSync(filePath);
		}
		//remove empty dir in entries
		clearEmptyDirs(character_book_path + '/entries');
		data.index_list = data.index_list.filter(x => x)
		data.display_index_list = data.display_index_list.filter(x => x)
		if (arraysEqual(data.index_list, data.display_index_list)) delete data.display_index_list
		yaml.writeFileSync(character_book_path + '/index.yaml', data);
		if (disabledDatas.length)
			yaml.writeFileSync(character_book_path + '/disabled_entries.yaml', disabledDatas);
	}
	/**
	 * Reads data files and populates the metaData, v1metaData, and character_book properties.
	 * @return {void}
	 */
	readDataFiles() {
		this.metaData = yaml.readFileSync(yamlFilePath);
		var packageJson = JSON.parse(fs.readFileSync(packageJsonFilePath, 'utf8'));
		this.metaData.character_version = packageJson.version;
		this.metaData.creator_notes = fs.readFileSync(CharReadMeFilePath, 'utf8');
		this.v1metaData = GetV1CharDataFromV2(this.metaData);
		this.metaData.extensions.regex_scripts = [];
		var regex_scripts_dir = fs.readdirSync(regex_scripts_path, { recursive: true }).filter(x => x.endsWith('.json'));
		for (const key of regex_scripts_dir) {
			var filePath = regex_scripts_path + '/' + key;
			var jsonStr = fs.readFileSync(filePath, 'utf8');
			this.metaData.extensions.regex_scripts.push(JSON.parse(jsonStr));
		}
		this.metaData.character_book = this.character_book = yaml.readFileSync(character_book_path + '/index.yaml');
		this.character_book.entries = [];
		var character_book_dir = fs.readdirSync(character_book_path + '/entries', { recursive: true }).filter(x => x.endsWith('.yaml'));
		this.character_book.display_index_list ??= this.character_book.index_list
		let [index_list, display_index_list] = [this.character_book.index_list, this.character_book.display_index_list]
		delete this.character_book.index_list
		delete this.character_book.display_index_list
		for (const key of character_book_dir) {
			var filePath = character_book_path + '/entries/' + key;
			var data = yaml.readFileSync(filePath);
			var fileName = data.comment || data.keys[0] || key.replace(/\.yaml$/, '');
			data.id = index_list.indexOf(fileName);
			data.extensions.display_index = display_index_list.indexOf(fileName);
			if (this.character_book.entries[data.id])
				console.error(`Duplicated entry: ${fileName}(${data.id}) and ${this.character_book.entries[data.id].comment || this.character_book.entries[data.id].keys[0]}(${data.id})`);
			this.character_book.entries[data.id] = data;
		}
		if (fs.existsSync(character_book_path + '/disabled_entries.yaml')) {
			var datas = yaml.readFileSync(character_book_path + '/disabled_entries.yaml');
			for (const data of datas) {
				var key = data.comment || data.keys[0];
				data.id = index_list.indexOf(key);
				data.extensions.display_index = display_index_list.indexOf(key);
				if (this.character_book.entries[data.id])
					console.log(`Duplicated entry: ${key}(${data.id}) and ${this.character_book.entries[data.id].comment || this.character_book.entries[data.id].keys[0]}(${data.id})`);
				this.character_book.entries[data.id] = data;
			}
		}
	}
	/**
	 * Builds the character information.
	 * @param {{
	 *   VerIdUpdater:(str: string) => string
	 *   DataUpdater:(data: v2CharData) => v2CharData
	 *   UseCrypto: boolean
	 * }} Config - The configuration object.
	 * @return {v1CharData} - The character information.
	 */
	BuildCharInfo(Config = {}) {
		Config = {
			VerIdUpdater: _ => _,
			DataUpdater: _ => _,
			UseCrypto: true,
			...Config
		}
		var VerId = Config.VerIdUpdater(this.metaData.character_version);
		var charData = Config.DataUpdater({
			...this.metaData,
			character_version: VerId,
			create_date: this.v1metaData.create_date
		});
		keyScoreAdder(charData.character_book.entries)
		var charDataStr = JSON.stringify(GetV1CharDataFromV2({ ...charData }));
		keyScoreRemover(charData.character_book.entries)
		charDataStr = charDataStr.replace(/{{char_version_url_encoded}}/g, encodeURIComponent(VerId)).replace(/{{char_version}}/g, VerId);
		let data_size = charDataStr.length
		let data_size_readable = (data_size / 1024.0).toFixed(2) + 'KB'
		charDataStr = charDataStr.replace(/{{char_data_size}}/g, data_size_readable)
		let NewCharData = JSON.parse(charDataStr);
		if (Config.UseCrypto) NewCharData.data = CryptoCharData(NewCharData.data);
		return NewCharData;
	}
	/**
	 * Builds the files for a subversion.
	 * @param {{
	 *   GetPngFile: () => string
	 *   VerIdUpdater: (str: string) => string
	 *   CharInfoHandler: (CharInfo: v1CharData, SavePath: string, defaultHandler: (CharInfo: v1CharData, SavePath: string) => void) => void
	 *   VerIdUpdater:(str: string) => string
	 *   DataUpdater:(data: v2CharData) => v2CharData
	 *   GetSavePath: (string) => string
	 *   UseCrypto: boolean
	 *   ext: string
	 * }} SubVerCfg - The configuration object for the subversion.
	 * @param {string} subverId - The ID of the subversion.
	 * @param {string} SavePath - The path to save the files.
	 */
	RunBuildCfg(SubVerCfg = {}, subverId = 'default', SavePath = `${BuildDir}/${subverId}`) {
		SetCryptoBaseRng(this.metaData.character_version)
		fs.mkdirSync(path.dirname(SavePath), { recursive: true });
		SubVerCfg = {
			GetPngFile: _ => [
				this.cardPath,
				`${ImgsDir}/${subverId}.png`,
				`${ImgsDir}/static.png`,
				`${ImgsDir}/default.png`
			].find(fs.existsSync),
			VerIdUpdater: (charVer) => subverId == "default" ? charVer : `${charVer}-${subverId}`,
			GetSavePath: _ => SavePath,
			ext: 'png',
			...SubVerCfg
		}
		let defaultCharDataHandler = (CharInfo, SavePath) => {
			let pngpath = SubVerCfg.GetPngFile();
			let buffer = fs.readFileSync(pngpath);
			let new_buffer = charDataParser.write(buffer, JSON.stringify(CharInfo))
			SavePath = SubVerCfg.GetSavePath(SavePath);
			if (!SavePath.endsWith(`.${SubVerCfg.ext}`))
				SavePath += `.${SubVerCfg.ext}`
			if (buffer.compare(new_buffer) || SavePath != pngpath)
				fs.writeFileSync(SavePath, new_buffer, { encoding: 'binary' });
		}
		SubVerCfg.CharInfoHandler ??= defaultCharDataHandler
		SubVerCfg.CharInfoHandler(this.BuildCharInfo(SubVerCfg), SavePath, defaultCharDataHandler);
	}
	/**
	 * Asynchronously builds a PNG file at the specified subversion ID and saves it to the specified path.
	 *
	 * @param {string} [subverId='default'] - The subversion ID to build the PNG file for.
	 * @param {string} [SavePath=`${BuildDir}/${subverId}`] - The path to save the PNG file to.
	 * @return {Promise<void>} A Promise that resolves when the PNG file is built and saved successfully.
	 */
	async Build(subverId = 'default', SavePath = `${BuildDir}/${subverId}`, SubVerStr = '') {
		let SubVerCfg = await import(pathToFileURL(`${SubVerCfgsDir}/${subverId}.mjs`)).then(m => m.default || m);
		if (SubVerStr) SubVerCfg.VerIdUpdater = _ => _ + '-' + SubVerStr.slice(0, 8);
		this.RunBuildCfg(SubVerCfg, subverId, SavePath);
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
