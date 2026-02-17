import * as fs from 'fs';
import * as path from 'path';
import { DialplanClient } from './client/dialplan-client';
import { dialplanToAsteriskFormat } from './utils/formatter';
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
};

const OUTPUT_FILE = process.env.OUTPUT_FILE || '/etc/asterisk/extensions_servaster.conf';

// --- Main ---

const client = new DialplanClient(config);
let timer: ReturnType<typeof setInterval> | null = null;

async function poll(): Promise<void> {
  const dialplan = await client.poll();

  // null = no changes or error — stay quiet
  if (!dialplan) return;

  // Got an update — write to disk
  const content = dialplanToAsteriskFormat(dialplan);

  try {
    const dir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(OUTPUT_FILE, content, 'utf-8');
    console.log(`[servaster] updated v${dialplan.version} -> ${OUTPUT_FILE}`);
  } catch (err) {
    console.error(`[servaster] failed to write ${OUTPUT_FILE}:`, err);
  }
}

function start(): void {
  console.log(`[servaster] polling ${config.workerUrl} every ${config.pollIntervalSec}s (server: ${config.serverId})`);
  console.log(`[servaster] output: ${OUTPUT_FILE}`);

  // initial poll
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
