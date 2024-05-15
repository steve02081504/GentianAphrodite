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
import { GetV1CharDataFromV2, v2CharData, v1CharData, WorldInfoBook, WorldInfoEntry, world_info_logic } from './charData.mjs';
import { SetCryptoBaseRng, CryptoCharData } from './charCrypto.mjs';
import { v2CharWIbook2WIjson, WIjson2v2CharWIbook } from './WIjsonMaker.mjs';

const cardFilePath = `${__dirname}/data/cardpath.txt`;
const WIjsonFilePath = `${__dirname}/data/WIpath.txt`;

/** @type {yaml.ToStringOptions} */
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

let keyscorespliter = "__worldinfo_keyscores__"

/**
 * add key scores to the data
 * @param {WorldInfoEntry[]} data - The charbook data
 */
function keyScoreAdder(data) {
	for (const id in data) {
		let entrie = data[id];
		if (entrie?.extensions?.selectiveLogic == undefined) {
			console.error('selectiveLogic not found: ', entrie);
			continue
		}
		if (entrie.extensions.selectiveLogic == world_info_logic.AND_ALL || entrie.extensions.selectiveLogic == world_info_logic.AND_ANY)
			continue
		let secondary_keysSet = [...entrie.secondary_keys];
		for (const key of secondary_keysSet) {
			if (key.startsWith('<-<') && key.endsWith('>->')) {
				let keyscore = data.filter(e => e.content == key)[0];
				if (!keyscore) {
					console.log(`keyscore not found: ${key}`);
					continue
				}
				entrie.secondary_keys.push(keyscorespliter);
				entrie.secondary_keys = entrie.secondary_keys.concat(keyscore.keys);
			}
		}
		entrie.secondary_keys = [...new Set(entrie.secondary_keys)];
	}
}
/**
 * remove key scores from the data
 * @param {WorldInfoEntry[]} data - The charbook data
 */
function keyScoreRemover(data) {
	for (const id in data) {
		let entrie = data[id];
		let index = entrie.secondary_keys.findIndex(x => x == keyscorespliter);
		if (index > -1) // 移除keyscorespliter及其后的所有元素
			entrie.secondary_keys = entrie.secondary_keys.slice(0, index)
	}
}

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
		this.metaData = yaml.parse(fs.readFileSync(yamlFilePath, 'utf8'));
		this.v1metaData.create_date = this.metaData.create_date;
		this.v1metaData.data.extensions.fav = this.metaData.extensions.fav;
		if (this.v1metaData.data.character_version) {
			metaDataStr = JSON.stringify(this.v1metaData);
			metaDataStr = metaDataStr.replace(`\`${this.v1metaData.data.character_version}\``, '{{char_version}}');
			metaDataStr = metaDataStr.replace(new RegExp(`/v${encodeURIComponent(this.v1metaData.data.character_version)}`, 'g'), '/v{{char_version_url_encoded}}');
			this.v1metaData = JSON.parse(metaDataStr);
			let index = this.v1metaData.data.character_version.indexOf('-dev');
			if (index != -1)
				this.v1metaData.data.character_version = this.v1metaData.data.character_version.substring(0, index);
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
		this.RunBuildCfg({ GetPngFile: _ => path, UseCrypto: false }, 'dev', this.cardPath);
		if (saveWIJson && this.WIjsonPath) {
			keyScoreAdder(this.character_book.entries);
			let data = v2CharWIbook2WIjson(this.character_book);
			fs.writeFileSync(this.WIjsonPath, JSON.stringify(data, null, '\t') + '\n');
			keyScoreRemover(this.character_book.entries)
		}
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
		data.index_list = data.index_list.filter(x => x)
		data.display_index_list = data.display_index_list.filter(x => x)
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
		let [index_list, display_index_list] = [this.character_book.index_list, this.character_book.display_index_list]
		delete this.character_book.index_list
		delete this.character_book.display_index_list
		for (const key of character_book_dir) {
			var filePath = character_book_path + '/entries/' + key;
			var yamlStr = fs.readFileSync(filePath, 'utf8');
			var data = yaml.parse(yamlStr);
			var fileName = data.comment || data.keys[0] || key.replace(/\.yaml$/, '');
			data.id = index_list.indexOf(fileName);
			data.extensions.display_index = display_index_list.indexOf(fileName);
			if (this.character_book.entries[data.id])
				console.error(`Duplicated entry: ${fileName}(${data.id}) and ${this.character_book.entries[data.id].comment || this.character_book.entries[data.id].keys[0]}(${data.id})`);
			this.character_book.entries[data.id] = data;
		}
		if (fs.existsSync(character_book_path + '/disabled_entries.yaml')) {
			var yamlStr = fs.readFileSync(character_book_path + '/disabled_entries.yaml', 'utf8');
			var datas = yaml.parse(yamlStr);
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
		charDataStr = charDataStr.replace(/{{char_version_url_encoded}}/g, encodeURIComponent(VerId)).replace(/{{char_version}}/g, `\`${VerId}\``);
		let NewCharData = JSON.parse(charDataStr);
		if (Config.UseCrypto) NewCharData.data = CryptoCharData(NewCharData.data);
		return NewCharData;
	}
	/**
	 * Builds the files for a subversion.
	 * @param {{
	 *   GetPngFile: () => string
	 *   VerIdUpdater: (str: string) => string
	 *   CharInfoHandler: (CharInfo: v1CharData, SavePath: string) => void
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
		SubVerCfg.CharInfoHandler ??= (CharInfo, SavePath) => {
			let buffer = fs.readFileSync(SubVerCfg.GetPngFile());
			buffer = charDataParser.write(buffer, JSON.stringify(CharInfo))
			SavePath = SubVerCfg.GetSavePath(SavePath);
			if (!SavePath.endsWith(`.${SubVerCfg.ext}`))
				SavePath += `.${SubVerCfg.ext}`
			fs.writeFileSync(SavePath, buffer, { encoding: 'binary' });
		}
		SubVerCfg.CharInfoHandler(this.BuildCharInfo(SubVerCfg), SavePath);
	}
	/**
	 * Asynchronously builds a PNG file at the specified subversion ID and saves it to the specified path.
	 *
	 * @param {string} [subverId='default'] - The subversion ID to build the PNG file for.
	 * @param {string} [SavePath=`${BuildDir}/${subverId}`] - The path to save the PNG file to.
	 * @return {Promise<void>} A Promise that resolves when the PNG file is built and saved successfully.
	 */
	async Build(subverId = 'default', SavePath = `${BuildDir}/${subverId}`) {
		let SubVerCfg = await import(pathToFileURL(`${SubVerCfgsDir}/${subverId}.mjs`)).then(m => m.default || m);
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
