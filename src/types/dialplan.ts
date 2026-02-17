// --- Config types ---

/** Supported Asterisk config file types */
export type ConfigType =
  | 'extensions'   // extensions.conf — dialplan
  | 'sip'          // sip.conf
  | 'pjsip'        // pjsip.conf
  | 'voicemail'    // voicemail.conf
  | 'queues'       // queues.conf
  | 'musiconhold'  // musiconhold.conf
  | 'features'     // features.conf
  | 'custom';      // any custom config

/** A single config blob stored in KV */
export interface ConfigEntry {
  /** Config type */
  type: ConfigType;
  /** Version for conditional fetch */
  version: number;
  /** Timestamp of last update */
  updatedAt: string;
  /** Raw config content (Asterisk-format text) */
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

// --- Dialplan-specific types (used for structured dialplan) ---

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
