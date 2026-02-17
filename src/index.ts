import * as fs from 'fs';
import * as path from 'path';
import { ConfigClient, filenameForType } from './client/dialplan-client';
import { ServerConfig } from './types';

// --- Config ---

if (!process.env.AUTH_TOKEN) {
  console.error('[servaster] AUTH_TOKEN is required.');
  process.exit(1);
}

const config: ServerConfig = {
  workerUrl: process.env.WORKER_URL || 'http://localhost:8787',
  serverId: process.env.SERVER_ID || 'server-1',
  pollIntervalSec: parseInt(process.env.POLL_INTERVAL || '30', 10),
  authToken: process.env.AUTH_TOKEN,
  outputDir: process.env.OUTPUT_DIR || '/etc/asterisk',
};

// --- Main ---

const client = new ConfigClient(config);
let timer: ReturnType<typeof setInterval> | null = null;

async function poll(): Promise<void> {
  const changed = await client.poll();

  // nothing changed — stay quiet
  if (changed.length === 0) return;

  // ensure output dir exists
  if (!fs.existsSync(config.outputDir)) {
    fs.mkdirSync(config.outputDir, { recursive: true });
  }

  for (const entry of changed) {
    const filename = filenameForType(entry.type);
    const filepath = path.join(config.outputDir, filename);

    try {
      fs.writeFileSync(filepath, entry.content, 'utf-8');
      console.log(`[servaster] ${entry.type} v${entry.version} -> ${filepath}`);
    } catch (err) {
      console.error(`[servaster] failed to write ${filepath}:`, err);
    }
  }
}

function start(): void {
  console.log(`[servaster] polling ${config.workerUrl} every ${config.pollIntervalSec}s (server: ${config.serverId})`);
  console.log(`[servaster] output dir: ${config.outputDir}`);

  poll().catch(console.error);

  timer = setInterval(() => {
    poll().catch(console.error);
  }, config.pollIntervalSec * 1000);
}

function stop(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

start();

process.on('SIGINT', () => { stop(); process.exit(0); });
process.on('SIGTERM', () => { stop(); process.exit(0); });
