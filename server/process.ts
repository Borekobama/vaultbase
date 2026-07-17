import { spawn } from 'node:child_process'

export async function runProcess(command: string, args: string[], options: { env?: NodeJS.ProcessEnv; cwd?: string; stdoutFile?: string } = {}) {
  const { open } = await import('node:fs/promises')
  const output = options.stdoutFile ? await open(options.stdoutFile, 'w', 0o600) : null
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args, { cwd: options.cwd, env: options.env ?? process.env, stdio: ['ignore', output ? output.fd : 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', chunk => { if (stdout.length < 1_000_000) stdout += String(chunk) })
    child.stderr?.on('data', chunk => { if (stderr.length < 100_000) stderr += String(chunk) })
    child.on('error', reject)
    child.on('close', async code => {
      await output?.close()
      if (code === 0) resolve({ stdout, stderr })
      else reject(new Error(`${command.split('/').pop()} exited with ${code}: ${stderr.slice(-4_000)}`))
    })
  })
}
