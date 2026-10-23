// For fully static hosting: after `next build`, makes every deck's PDF and saves it to
// public/decks/<id>/<filename>.pdf, using the same route the Download button calls.
import { spawn } from 'node:child_process';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const PORT = 3191;
const BASE = `http://localhost:${PORT}`;

const server = spawn('npx', ['next', 'start', '-p', String(PORT)], { stdio: 'ignore' });
const stop = () => server.kill();
process.on('exit', stop);

async function ready() {
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(`${BASE}/pitch`)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('The server didn’t start');
}

await ready();
const ids = (await readdir('decks')).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5));
for (const id of ids) {
  const res = await fetch(`${BASE}/api/pitch/pdf/${id}`);
  if (!res.ok) throw new Error(`${id}: ${res.status} ${await res.text()}`);
  const name = res.headers.get('content-disposition')?.match(/filename="([^"]+)"/)?.[1] ?? `${id}.pdf`;
  const dir = path.join('public', 'decks', id);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), Buffer.from(await res.arrayBuffer()));
  console.log(`${id} → ${path.join(dir, name)}`);
}
stop();
