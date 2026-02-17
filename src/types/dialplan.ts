// --- Config types ---

/**
 * Config type = filename without .conf extension.
 * Examples: "extensions", "sip", "pjsip", "voicemail", "queues",
 *           "manager", "http", "modules", "cdr", etc.
 * Any string is valid — maps to {type}.conf on disk.
 */
export type ConfigType = string;

/** A single config blob stored in KV */
export interface ConfigEntry {
  /** Config type (filename without .conf) */
  type: ConfigType;
  /** Version for conditional fetch */
  version: number;
  /** Timestamp of last update */
  updatedAt: string;
  /** Raw config content */
  content: string;
}

/** Which configs are assigned to a server */
export interface ServerAssignment {
  serverId: string;
  /** Config types this server should pull */
  configs: ConfigType[];
}

/** What the server gets: all its assigned configs */
export interface ServerBundle {
  serverId: string;
  configs: ConfigEntry[];
}

// --- API ---

/** API response wrapper */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/** Server/node configuration for fetching configs */
export interface ServerConfig {
  /** Cloudflare Worker URL */
  workerUrl: string;
  /** Server identifier used as KV key */
  serverId: string;
  /** Polling interval in seconds */
  pollIntervalSec: number;
  /** Auth token for API access (required) */
  authToken: string;
  /** Output directory for config files */
  outputDir: string;
}
