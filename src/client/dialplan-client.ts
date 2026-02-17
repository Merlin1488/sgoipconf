import { ConfigEntry, ServerBundle, ApiResponse, ServerConfig } from '../types';

/** Maps config type to filename */
const CONFIG_FILENAMES: Record<string, string> = {
  extensions: 'extensions.conf',
  sip: 'sip.conf',
  pjsip: 'pjsip.conf',
  voicemail: 'voicemail.conf',
  queues: 'queues.conf',
  musiconhold: 'musiconhold.conf',
  features: 'features.conf',
  custom: 'custom.conf',
};

export function filenameForType(type: string): string {
  return CONFIG_FILENAMES[type] || `${type}.conf`;
}

/**
 * Client for fetching configs from Cloudflare Worker.
 * Returns only configs that actually changed since last poll.
 */
export class ConfigClient {
  private config: ServerConfig;
  private versions: Map<string, number> = new Map();

  constructor(config: ServerConfig) {
    this.config = config;
  }

  /**
   * Poll for all assigned configs. Returns only those that changed.
   */
  async poll(): Promise<ConfigEntry[]> {
    const url = `${this.config.workerUrl}/config/${this.config.serverId}`;

    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.authToken}`,
        },
      });

      if (!response.ok) {
        const text = await response.text();
        console.error(`[servaster] HTTP ${response.status}: ${text}`);
        return [];
      }

      const body = (await response.json()) as ApiResponse<ServerBundle>;

      if (!body.success || !body.data) {
        console.error(`[servaster] API error: ${body.error || 'unknown'}`);
        return [];
      }

      // Filter to only changed configs
      const changed: ConfigEntry[] = [];
      for (const entry of body.data.configs) {
        const prevVersion = this.versions.get(entry.type) || 0;
        if (entry.version > prevVersion) {
          changed.push(entry);
          this.versions.set(entry.type, entry.version);
        }
      }

      return changed;
    } catch (err) {
      console.error('[servaster] fetch failed:', err);
      return [];
    }
  }
}
