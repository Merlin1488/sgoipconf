/**
 * Servaster Cloudflare Worker
 *
 * Multi-config API — stores and serves Asterisk config files per server.
 *
 * KV keys:
 *   config:{serverId}:{configType}  — config content
 *   assignment:{serverId}           — list of assigned config types
 *
 * API:
 *   GET  /config/:serverId              — get all assigned configs (bundle)
 *   GET  /config/:serverId/:configType  — get one config
 *   PUT  /config/:serverId/:configType  — upsert one config
 *   GET  /assignment/:serverId          — get assignment
 *   PUT  /assignment/:serverId          — set assignment
 *   GET  /health                        — health check
 */

export interface Env {
  DIALPLAN_KV: KVNamespace;
  AUTH_TOKEN: string;
}

type ConfigType = 'extensions' | 'sip' | 'pjsip' | 'voicemail' | 'queues' | 'musiconhold' | 'features' | 'custom';

interface ConfigEntry {
  type: ConfigType;
  version: number;
  updatedAt: string;
  content: string;
}

interface ServerAssignment {
  serverId: string;
  configs: ConfigType[];
}

interface ServerBundle {
  serverId: string;
  configs: ConfigEntry[];
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

function json<T>(data: T, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', ...headers },
  });
}

function isAuthorized(request: Request, env: Env): boolean {
  const h = request.headers.get('Authorization');
  return !!h && h === `Bearer ${env.AUTH_TOKEN}`;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const p = url.pathname;

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, If-None-Match',
        },
      });
    }

    if (p === '/health') {
      return json({ status: 'ok', timestamp: new Date().toISOString() });
    }

    if (!isAuthorized(request, env)) {
      return json<ApiResponse<null>>({ success: false, error: 'Unauthorized' }, 401);
    }

    // --- /assignment/:serverId ---
    const assignMatch = p.match(/^\/assignment\/([a-zA-Z0-9_-]+)$/);
    if (assignMatch) {
      const serverId = assignMatch[1];
      if (request.method === 'GET') return handleGetAssignment(env, serverId);
      if (request.method === 'PUT') return handlePutAssignment(request, env, serverId);
    }

    // --- /config/:serverId/:configType ---
    const configOneMatch = p.match(/^\/config\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)$/);
    if (configOneMatch) {
      const [, serverId, configType] = configOneMatch;
      if (request.method === 'GET') return handleGetConfig(request, env, serverId, configType as ConfigType);
      if (request.method === 'PUT') return handlePutConfig(request, env, serverId, configType as ConfigType);
    }

    // --- /config/:serverId (bundle) ---
    const configBundleMatch = p.match(/^\/config\/([a-zA-Z0-9_-]+)$/);
    if (configBundleMatch) {
      const serverId = configBundleMatch[1];
      if (request.method === 'GET') return handleGetBundle(request, env, serverId);
    }

    return json<ApiResponse<null>>({ success: false, error: 'Not Found' }, 404);
  },
} satisfies ExportedHandler<Env>;

// --- Assignment ---

async function handleGetAssignment(env: Env, serverId: string): Promise<Response> {
  const raw = await env.DIALPLAN_KV.get(`assignment:${serverId}`);
  if (!raw) {
    return json<ApiResponse<ServerAssignment>>({
      success: true,
      data: { serverId, configs: [] },
    });
  }
  return json<ApiResponse<ServerAssignment>>({ success: true, data: JSON.parse(raw) });
}

async function handlePutAssignment(request: Request, env: Env, serverId: string): Promise<Response> {
  try {
    const body = (await request.json()) as { configs: ConfigType[] };
    if (!Array.isArray(body.configs)) {
      return json<ApiResponse<null>>({ success: false, error: 'configs must be an array' }, 400);
    }
    const assignment: ServerAssignment = { serverId, configs: body.configs };
    await env.DIALPLAN_KV.put(`assignment:${serverId}`, JSON.stringify(assignment));
    return json<ApiResponse<ServerAssignment>>({ success: true, data: assignment });
  } catch {
    return json<ApiResponse<null>>({ success: false, error: 'Invalid JSON' }, 400);
  }
}

// --- Single config ---

async function handleGetConfig(request: Request, env: Env, serverId: string, configType: ConfigType): Promise<Response> {
  const raw = await env.DIALPLAN_KV.get(`config:${serverId}:${configType}`);
  if (!raw) {
    return json<ApiResponse<null>>({ success: false, error: `No "${configType}" config for "${serverId}"` }, 404);
  }
  const entry: ConfigEntry = JSON.parse(raw);

  const etag = request.headers.get('If-None-Match');
  if (etag === `"${entry.version}"`) {
    return new Response(null, { status: 304 });
  }

  return json<ApiResponse<ConfigEntry>>({ success: true, data: entry }, 200, { ETag: `"${entry.version}"` });
}

async function handlePutConfig(request: Request, env: Env, serverId: string, configType: ConfigType): Promise<Response> {
  try {
    const body = (await request.json()) as { content: string; version?: number };
    if (typeof body.content !== 'string') {
      return json<ApiResponse<null>>({ success: false, error: 'content must be a string' }, 400);
    }

    // Get current version to auto-increment
    const existing = await env.DIALPLAN_KV.get(`config:${serverId}:${configType}`);
    const prevVersion = existing ? (JSON.parse(existing) as ConfigEntry).version : 0;

    const entry: ConfigEntry = {
      type: configType,
      version: body.version || prevVersion + 1,
      updatedAt: new Date().toISOString(),
      content: body.content,
    };

    await env.DIALPLAN_KV.put(`config:${serverId}:${configType}`, JSON.stringify(entry));
    return json<ApiResponse<ConfigEntry>>({ success: true, data: entry });
  } catch {
    return json<ApiResponse<null>>({ success: false, error: 'Invalid JSON' }, 400);
  }
}

// --- Bundle (all assigned configs) ---

async function handleGetBundle(request: Request, env: Env, serverId: string): Promise<Response> {
  const assignRaw = await env.DIALPLAN_KV.get(`assignment:${serverId}`);
  const assignment: ServerAssignment = assignRaw
    ? JSON.parse(assignRaw)
    : { serverId, configs: [] };

  const configs: ConfigEntry[] = [];

  for (const configType of assignment.configs) {
    const raw = await env.DIALPLAN_KV.get(`config:${serverId}:${configType}`);
    if (raw) {
      configs.push(JSON.parse(raw));
    }
  }

  const bundle: ServerBundle = { serverId, configs };
  return json<ApiResponse<ServerBundle>>({ success: true, data: bundle });
}
