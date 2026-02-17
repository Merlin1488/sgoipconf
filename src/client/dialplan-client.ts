import { Dialplan, ApiResponse, ServerConfig } from '../types';

/**
 * Client for fetching dialplan configurations from Cloudflare Worker.
 * Returns the new dialplan ONLY when it actually changed.
 */
export class DialplanClient {
  private config: ServerConfig;
  private currentVersion: number = 0;

  constructor(config: ServerConfig) {
    this.config = config;
  }

  /**
   * Poll the Worker. Returns Dialplan if updated, null if unchanged or error.
   */
  async poll(): Promise<Dialplan | null> {
    const url = `${this.config.workerUrl}/dialplan/${this.config.serverId}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.authToken}`,
    };

    if (this.currentVersion > 0) {
      headers['If-None-Match'] = `"${this.currentVersion}"`;
    }

    try {
      const response = await fetch(url, { headers });

      // 304 — nothing changed, stay quiet
      if (response.status === 304) {
        return null;
      }

      if (!response.ok) {
        const text = await response.text();
        console.error(`[servaster] HTTP ${response.status}: ${text}`);
        return null;
      }

      const body = (await response.json()) as ApiResponse<Dialplan>;

      if (!body.success || !body.data) {
        console.error(`[servaster] API error: ${body.error || 'unknown'}`);
        return null;
      }

      this.currentVersion = body.data.version;
      return body.data;
    } catch (err) {
      console.error('[servaster] fetch failed:', err);
      return null;
    }
  }
}
