import { rollup } from 'npm:rollup'
import { visualizer } from 'npm:rollup-plugin-visualizer'
import terser from 'npm:@rollup/plugin-terser'
import obfuscator from 'npm:rollup-plugin-obfuscator'
import fs from 'node:fs'
import { exec } from '../../scripts/exec.mjs'
import { nicerWriteFileSync } from '../../scripts/tools.mjs'

// 创建dist目录
fs.mkdirSync('dist', { recursive: true })

const charvar = await exec('git describe --tags --abbrev=0', { cwd: '.' }).then((result) => result.stdout.trim())

const bundle = await rollup({
	input: './main.mjs',
	external: [
		/node:.*/,
		/npm:.*/,
		/https:\/\/.*/,
		/(?:.{2}\/){6}.*/
	],
	plugins: [
		{
			name: 'git-version-injector',
			renderChunk(code) {
				const newCode = code
					.replace(/(const|let)\s*charvar = [^]*?\n\);?\n/, `const charvar = "${charvar}";`)
					.replace(/(const|let)\s*is_dist = [^]*?\n\);?\n/, 'const is_dist = true;')

				return { code: newCode, map: null }
			}
		},

		terser({
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
		}),

		//*
		obfuscator({
			global: true,
			options: {
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
			}
		}),
		//*/

		visualizer({
			filename: 'dist/build_report.html',
			open: true
		})
	]
})

await bundle.write({
	file: 'dist/main.mjs',
	inlineDynamicImports: true,
	format: 'esm'
})
await bundle.close()

console.log('Build completed successfully and written to dist/main.mjs')

const copy_paths = ['info/description', 'imgs', 'README.md', 'fount.json']
for (const path of copy_paths)
	if (fs.statSync(path).isDirectory())
		await exec(`robocopy ".\\${path}" ".\\dist\\${path}" /MIR /XD .git /XF .gitignore /XA:H /XA:S"`, { cwd: '.' }).catch(console.dir)
	else
		nicerWriteFileSync(`dist/${path}`, fs.readFileSync(path))
