/**
 * Seed script — загружает тестовые конфиги и назначает их серверу.
 *
 * Usage: npm run worker:kv:seed
 * Make sure the Worker is running locally: npm run worker:dev
 */

const WORKER_URL = process.env.WORKER_URL || 'http://localhost:8787';
const SERVER_ID = process.env.SERVER_ID || 'server-1';
const AUTH_TOKEN = process.env.AUTH_TOKEN || '';

const headers: Record<string, string> = {
  'Content-Type': 'application/json',
  ...(AUTH_TOKEN ? { Authorization: `Bearer ${AUTH_TOKEN}` } : {}),
};

const configs: Record<string, string> = {
  extensions: `[internal]
exten => 100,1,Dial(SIP/100,30)
exten => 101,1,Dial(SIP/101,30)
exten => 102,1,Dial(SIP/102,30)
exten => _1XX,2,Voicemail(\${EXTEN}@default)

[outbound]
exten => _9NXXXXXXXXX,1,Set(CALLERID(num)=5551234567)
exten => _9NXXXXXXXXX,2,Dial(SIP/trunk/\${EXTEN:1})
exten => _9NXXXXXXXXX,3,Hangup()

[incoming]
exten => s,1,Answer()
exten => s,2,Playback(welcome)
exten => s,3,Dial(SIP/100&SIP/101,30,r)
exten => s,4,Voicemail(100@default,u)
exten => s,5,Hangup()
`,

  sip: `[general]
context=internal
allowoverlap=no
udpbindaddr=0.0.0.0
tcpenable=no
transport=udp
srvlookup=yes

[100]
type=friend
secret=pass100
host=dynamic
context=internal
callerid="User 100" <100>

[101]
type=friend
secret=pass101
host=dynamic
context=internal
callerid="User 101" <101>
`,

  voicemail: `[default]
100 => 1234,User 100,user100@example.com
101 => 1234,User 101,user101@example.com
`,
};

async function seed() {
  // 1. Upload each config
  for (const [type, content] of Object.entries(configs)) {
    const url = `${WORKER_URL}/config/${SERVER_ID}/${type}`;
    console.log(`PUT ${url} ...`);
    const res = await fetch(url, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ content }),
    });
    const body = await res.json();
    console.log(`  ${res.status}:`, JSON.stringify(body, null, 2));
  }

  // 2. Assign configs to server
  const assignUrl = `${WORKER_URL}/assignment/${SERVER_ID}`;
  console.log(`\nPUT ${assignUrl} ...`);
  const res = await fetch(assignUrl, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ configs: Object.keys(configs) }),
  });
  const body = await res.json();
  console.log(`  ${res.status}:`, JSON.stringify(body, null, 2));

  console.log('\nDone!');
}

seed().catch(console.error);
