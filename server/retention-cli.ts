import { applyRetention } from './retention.js'

const projectId = process.argv.find(argument => argument.startsWith('--project='))?.slice('--project='.length)
applyRetention(projectId, process.argv.includes('--prune'))
  .then(result => process.stdout.write(result.stdout))
  .catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1 })
