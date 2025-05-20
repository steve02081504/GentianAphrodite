import { rollup } from 'npm:rollup'
import confuser from 'npm:javascript-obfuscator'
import { minify } from 'npm:terser'
import fs from 'node:fs'
import { exec } from '../../scripts/exec.mjs'
import { nicerWriteFileSync } from '../../scripts/tools.mjs'
// 创建dist目录
fs.mkdirSync('dist', { recursive: true })

const result = await rollup({
	input: './main.mjs',
	external: [
		/node:.*/,
		/npm:.*/,
		/https:\/\/.*/,
		/(?:.{2}\/){6}.*/
	]
})

let output = await result.generate({
	inlineDynamicImports: true,
	format: 'esm'
})
output = output.output[0].code

const charvar = await exec('git describe --tags --abbrev=0', { cwd: '.' }).then((result) => result.stdout)
output = output.replace(/(const|let)\s*charvar = [^]*?\n\);?\n/, `const charvar = "${charvar.trim()}";`)

//*
output = await minify(output, {
	module: true,
	compress: {
		drop_console: ['log'],
		unsafe_arrows: true,
		unsafe: true,
		// unsafe_comps: true,
		unsafe_Function: true,
		unsafe_math: true,
		unsafe_symbols: true,
		unsafe_methods: true,
		unsafe_proto: true,
		unsafe_regexp: true,
		unsafe_undefined: true,
		unused: true
	},
	mangle: false
})
output = output.code
output = confuser.obfuscate(output, {
	target: 'node',
	reservedNames: [
		'console', 'statisticStr', 'statisticDatas', 'charvar',
		'callback', 'add_files', 'args', 'logical_results', 'prompt_struct',
		'detail_level', 'match_keys', 'match_keys_all'
	],
	renameGlobals: true,
	stringArrayEncoding: [
		'none',
		'base64',
		'rc4'
	],
	stringArray: true,
	transformObjectKeys: true,
	unicodeEscapeSequence: true,
	splitStrings: true,
	seed: 81504
}).getObfuscatedCode()
//*/

nicerWriteFileSync('dist/main.mjs', output)

// 需要复制的文件夹和文件
const copy_paths = ['info/description', 'imgs', 'README.md', 'fount.json']
for (const path of copy_paths)
	if (fs.statSync(path).isDirectory()) // 若是文件夹
		await exec(`robocopy ".\\${path}" ".\\dist\\${path}" /MIR /XD .git /XF .gitignore /XA:H /XA:S"`, { cwd: '.' }).catch(console.dir)
	else // 若是文件
		nicerWriteFileSync(`dist/${path}`, fs.readFileSync(path))
