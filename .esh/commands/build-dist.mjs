import { rollup } from 'npm:rollup'
import confuser from 'npm:javascript-obfuscator'
import { minify } from 'npm:terser'
import fs from 'node:fs'
import { exec } from '../../scripts/exec.mjs'
import { nicerWriteFileSync } from '../../scripts/tools.mjs'
// 创建dist目录
fs.mkdirSync('dist', { recursive: true })

let result = await rollup({
	input: './main.mjs',
	external: [
		/node:*/,
		/npm:*/,
		'../../../../../../src/public/shells/chat/src/server/prompt_struct.mjs',
		'../../../../../../src/server/parts_loader.mjs',
		'../../../../../../../src/server/parts_loader.mjs'
	]
})

let output = await result.generate({
	inlineDynamicImports: true,
	format: 'esm'
})
output = output.output[0].code

let charvar = await exec('git describe --tags --abbrev=0', { cwd: '.' }).then((result) => result.stdout)
output = output.replace(/(export\s+)?(const|let)\s*charvar = [^\n]*/, `$1const charvar = "${charvar.trim()}";`)

output = await minify(output, {
	module: true,
	compress: {
		drop_console: ['log'],
		unsafe_arrows: true,
		unsafe: true,
		unsafe_comps: true,
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
	reservedNames: ['formats'],
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

nicerWriteFileSync('dist/main.mjs', output)

// 需要复制的文件夹和文件
let copy_paths = ['description', 'imgs', 'README.md']
for (let path of copy_paths)
	if (fs.statSync(path).isDirectory()) // 若是文件夹
		await exec(`robocopy ".\\${path}" ".\\dist\\${path}" /MIR /XD .git /XF .gitignore /XA:H /XA:S"`, { cwd: '.' }).catch(console.dir)
	else // 若是文件
		nicerWriteFileSync(`dist/${path}`, fs.readFileSync(path))
