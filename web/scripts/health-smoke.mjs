import { spawn } from 'node:child_process';
import { createServer } from 'node:net';

const probe = createServer();
await new Promise((resolve, reject) => {
  probe.once('error', reject);
  probe.listen(0, '127.0.0.1', resolve);
});
const address = probe.address();
if (!address || typeof address === 'string') throw new Error('Could not reserve a local test port.');
const port = address.port;
await new Promise((resolve, reject) => probe.close(error => error ? reject(error) : resolve()));

const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
  stdio: 'ignore',
  env: { ...process.env, HOSTNAME: '127.0.0.1', PORT: String(port) },
});

async function waitForServer() {
  const url = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`Next.js exited before becoming healthy (code ${server.exitCode}).`);
    try {
      const response = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(1200) });
      if (response.ok) return url;
    } catch {
      // The server is still starting.
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('Next.js did not become healthy within 10 seconds.');
}

try {
  const baseUrl = await waitForServer();
  for (const path of ['/api/health', '/api/v1/health']) {
    const response = await fetch(`${baseUrl}${path}`, { signal: AbortSignal.timeout(3000) });
    if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}.`);
    const body = await response.json();
    if (body.status !== 'ok' || body.service !== 'imi-web') {
      throw new Error(`${path} returned an unexpected health payload.`);
    }
    if (typeof body.timestamp !== 'string' || Number.isNaN(Date.parse(body.timestamp))) {
      throw new Error(`${path} did not return a valid timestamp.`);
    }
    if (typeof body.firebase?.configured !== 'boolean'
      || !Object.hasOwn(body.firebase, 'projectId')
      || typeof body.note !== 'string'
      || !body.note.includes('not a verified Firebase production connectivity check')) {
      throw new Error(`${path} omitted the Firebase configuration caveat.`);
    }
    console.log(`PASS ${path}: HTTP ${response.status}; configuration-only health contract verified.`);
  }
} finally {
  server.kill('SIGTERM');
}
