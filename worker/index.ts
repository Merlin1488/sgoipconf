/**
 * Servaster Cloudflare Worker
 *
 * Serves dialplan configurations from KV storage.
 * API:
 *   GET /dialplan/:serverId  — get dialplan for a server
 *   PUT /dialplan/:serverId  — update dialplan for a server (requires auth)
 *   GET /health              — health check
 */

export interface Env {
  DIALPLAN_KV: KVNamespace;
  AUTH_TOKEN: string;
}

interface DialplanExtension {
  pattern: string;
  priority: number;
  application: string;
  args: string;
}

interface DialplanContext {
  name: string;
  extensions: DialplanExtension[];
}

interface Dialplan {
  id: string;
  name: string;
  version: number;
  updatedAt: string;
  contexts: DialplanContext[];
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

function jsonResponse<T>(data: T, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      ...headers,
    },
  });
}

function isAuthorized(request: Request, env: Env): boolean {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return false;
  return authHeader === `Bearer ${env.AUTH_TOKEN}`;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, If-None-Match',
        },
      });
    }

    // Health check (public, no auth needed)
    if (path === '/health') {
      return jsonResponse({ status: 'ok', timestamp: new Date().toISOString() });
    }

    // All other routes require auth
    if (!isAuthorized(request, env)) {
      return jsonResponse<ApiResponse<null>>(
        { success: false, error: 'Unauthorized' },
        401
      );
    }

    // Route: /dialplan/:serverId
    const dialplanMatch = path.match(/^\/dialplan\/([a-zA-Z0-9_-]+)$/);
    if (dialplanMatch) {
      const serverId = dialplanMatch[1];

      if (request.method === 'GET') {
        return handleGetDialplan(request, env, serverId);
      }

      if (request.method === 'PUT') {
        return handlePutDialplan(request, env, serverId);
      }
    }

    return jsonResponse<ApiResponse<null>>(
      { success: false, error: 'Not Found' },
      404
    );
  },
} satisfies ExportedHandler<Env>;

async function handleGetDialplan(
  request: Request,
  env: Env,
  serverId: string
): Promise<Response> {
  const kvKey = `dialplan:${serverId}`;
  const raw = await env.DIALPLAN_KV.get(kvKey);

  if (!raw) {
    return jsonResponse<ApiResponse<null>>(
      { success: false, error: `No dialplan found for server "${serverId}"` },
      404
    );
  }

  const dialplan: Dialplan = JSON.parse(raw);

  // Conditional fetch: If-None-Match
  const ifNoneMatch = request.headers.get('If-None-Match');
  if (ifNoneMatch === `"${dialplan.version}"`) {
    return new Response(null, { status: 304 });
  }

  return jsonResponse<ApiResponse<Dialplan>>(
    { success: true, data: dialplan },
    200,
    { ETag: `"${dialplan.version}"` }
  );
}

async function handlePutDialplan(
  request: Request,
  env: Env,
  serverId: string
): Promise<Response> {
  try {
    const body = (await request.json()) as Dialplan;

    if (!body.contexts || !Array.isArray(body.contexts)) {
      return jsonResponse<ApiResponse<null>>(
        { success: false, error: 'Invalid dialplan: missing contexts array' },
        400
      );
    }

    const dialplan: Dialplan = {
      id: body.id || serverId,
      name: body.name || `Dialplan for ${serverId}`,
      version: body.version || 1,
      updatedAt: new Date().toISOString(),
      contexts: body.contexts,
    };

    const kvKey = `dialplan:${serverId}`;
    await env.DIALPLAN_KV.put(kvKey, JSON.stringify(dialplan));

    return jsonResponse<ApiResponse<Dialplan>>(
      { success: true, data: dialplan },
      200
    );
  } catch (err) {
    return jsonResponse<ApiResponse<null>>(
      { success: false, error: 'Invalid JSON body' },
      400
    );
  }
}
