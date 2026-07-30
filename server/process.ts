import { spawn } from 'node:child_process'

function appendTail(current: string, chunk: unknown, limit: number) {
  const next = current + String(chunk)
  return next.length <= limit ? next : next.slice(-limit)
}

export async function runProcess(command: string, args: string[], options: { env?: NodeJS.ProcessEnv; cwd?: string; stdoutFile?: string; stdoutLimit?: number; timeoutMs?: number } = {}) {
  const { open } = await import('node:fs/promises')
  const output = options.stdoutFile ? await open(options.stdoutFile, 'w', 0o600) : null
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args, { cwd: options.cwd, env: options.env ?? process.env, stdio: ['ignore', output ? output.fd : 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    let timedOut = false
    const timeout = options.timeoutMs ? setTimeout(() => {
      timedOut = true
      child.kill('SIGTERM')
    }, options.timeoutMs) : null
    timeout?.unref()
    child.stdout?.on('data', chunk => { stdout = appendTail(stdout, chunk, options.stdoutLimit ?? 1_000_000) })
    child.stderr?.on('data', chunk => { stderr = appendTail(stderr, chunk, 100_000) })
    child.on('error', error => {
      if (timeout) clearTimeout(timeout)
      reject(error)
    })
    child.on('close', async code => {
      if (timeout) clearTimeout(timeout)
      await output?.close()
      if (timedOut) reject(new Error(`${command.split('/').pop()} timed out after ${options.timeoutMs} ms.`))
      else if (code === 0) resolve({ stdout, stderr })
      else reject(new Error(`${command.split('/').pop()} exited with ${code}: ${stderr.slice(-4_000)}`))
    })
  })
}
