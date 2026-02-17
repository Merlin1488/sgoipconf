/** Represents a single dialplan extension/rule */
export interface DialplanExtension {
  /** Extension pattern, e.g. "_XXXX", "100", "_9NXXXXXXXXX" */
  pattern: string;
  /** Priority/order of the extension */
  priority: number;
  /** Application to execute, e.g. "Dial", "Playback", "Hangup" */
  application: string;
  /** Arguments for the application */
  args: string;
}

/** A named context containing extensions */
export interface DialplanContext {
  name: string;
  extensions: DialplanExtension[];
}

/** Full dialplan configuration */
export interface Dialplan {
  /** Unique identifier for this dialplan */
  id: string;
  /** Human-readable name */
  name: string;
  /** Version for cache invalidation */
  version: number;
  /** Timestamp of last update */
  updatedAt: string;
  /** Dialplan contexts */
  contexts: DialplanContext[];
}

/** API response wrapper */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/** Server/node configuration for fetching dialplan */
export interface ServerConfig {
  /** Cloudflare Worker URL */
  workerUrl: string;
  /** Server identifier used as KV key */
  serverId: string;
  /** Polling interval in seconds */
  pollIntervalSec: number;
  /** Auth token for API access (required) */
  authToken: string;
}
