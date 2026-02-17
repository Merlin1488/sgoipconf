import { ConfigEntry } from '../types';

/**
 * Adds a header comment to config content.
 */
export function addConfigHeader(entry: ConfigEntry): string {
  const header = [
    `; Config type: ${entry.type}`,
    `; Version: ${entry.version}`,
    `; Updated: ${entry.updatedAt}`,
    `; Managed by servaster — do not edit manually`,
    '',
  ].join('\n');

  return header + entry.content;
}
