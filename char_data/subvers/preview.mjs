import { execSync } from 'child_process'

const revision = execSync('git rev-parse HEAD').toString().trim()

let buildCfg = {
	VerIdUpdater: charVer => `${charVer}-preview-${revision.substr(0, 8)}`,
}
export default buildCfg
