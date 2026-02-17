/**
 * Seed script — загружает тестовый диалплан в Cloudflare Worker.
 *
 * Usage: npm run worker:kv:seed
 * Make sure the Worker is running locally: npm run worker:dev
 */

const WORKER_URL = process.env.WORKER_URL || 'http://localhost:8787';
const SERVER_ID = process.env.SERVER_ID || 'server-1';
const AUTH_TOKEN = process.env.AUTH_TOKEN || '';

const sampleDialplan = {
  id: SERVER_ID,
  name: 'Main Office Dialplan',
  version: 1,
  contexts: [
    {
      name: 'internal',
      extensions: [
        { pattern: '100', priority: 1, application: 'Dial', args: 'SIP/100,30' },
        { pattern: '101', priority: 1, application: 'Dial', args: 'SIP/101,30' },
        { pattern: '102', priority: 1, application: 'Dial', args: 'SIP/102,30' },
        { pattern: '_1XX', priority: 2, application: 'Voicemail', args: '${EXTEN}@default' },
      ],
    },
    {
      name: 'outbound',
      extensions: [
        { pattern: '_9NXXXXXXXXX', priority: 1, application: 'Set', args: 'CALLERID(num)=5551234567' },
        { pattern: '_9NXXXXXXXXX', priority: 2, application: 'Dial', args: 'SIP/trunk/${EXTEN:1}' },
        { pattern: '_9NXXXXXXXXX', priority: 3, application: 'Hangup', args: '' },
      ],
    },
    {
      name: 'incoming',
      extensions: [
        { pattern: 's', priority: 1, application: 'Answer', args: '' },
        { pattern: 's', priority: 2, application: 'Playback', args: 'welcome' },
        { pattern: 's', priority: 3, application: 'Dial', args: 'SIP/100&SIP/101,30,r' },
        { pattern: 's', priority: 4, application: 'Voicemail', args: '100@default,u' },
        { pattern: 's', priority: 5, application: 'Hangup', args: '' },
      ],
    },
  ],
};

async function seed() {
  const url = `${WORKER_URL}/dialplan/${SERVER_ID}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (AUTH_TOKEN) {
    headers['Authorization'] = `Bearer ${AUTH_TOKEN}`;
  }

  console.log(`Seeding dialplan to ${url}...`);

  const response = await fetch(url, {
    method: 'PUT',
    headers,
    body: JSON.stringify(sampleDialplan),
  });

  const body = await response.json();
  console.log(`Response (${response.status}):`, JSON.stringify(body, null, 2));
}

seed().catch(console.error);
