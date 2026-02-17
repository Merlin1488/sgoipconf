import { Dialplan, DialplanContext, DialplanExtension } from '../types';

/**
 * Converts a Dialplan object into Asterisk-style dialplan text format.
 */
export function dialplanToAsteriskFormat(dialplan: Dialplan): string {
  const lines: string[] = [];

  lines.push(`; Dialplan: ${dialplan.name}`);
  lines.push(`; Version: ${dialplan.version}`);
  lines.push(`; Updated: ${dialplan.updatedAt}`);
  lines.push('');

  for (const context of dialplan.contexts) {
    lines.push(`[${context.name}]`);
    lines.push(...formatContext(context));
    lines.push('');
  }

  return lines.join('\n');
}

function formatContext(context: DialplanContext): string[] {
  const lines: string[] = [];

  for (const ext of context.extensions) {
    lines.push(formatExtension(ext));
  }

  return lines;
}

function formatExtension(ext: DialplanExtension): string {
  return `exten => ${ext.pattern},${ext.priority},${ext.application}(${ext.args})`;
}

/**
 * Logs dialplan summary to console.
 */
export function logDialplanSummary(dialplan: Dialplan): void {
  console.log(`\n=== Dialplan: ${dialplan.name} (v${dialplan.version}) ===`);
  console.log(`Updated: ${dialplan.updatedAt}`);

  for (const ctx of dialplan.contexts) {
    console.log(`  [${ctx.name}] — ${ctx.extensions.length} extension(s)`);
    for (const ext of ctx.extensions) {
      console.log(`    ${ext.pattern},${ext.priority} -> ${ext.application}(${ext.args})`);
    }
  }

  console.log('');
}
