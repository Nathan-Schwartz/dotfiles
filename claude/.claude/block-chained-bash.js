#!/usr/bin/env node

'use strict';

let raw = '';
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  let data;
  try { data = JSON.parse(raw || '{}'); } catch { process.exit(0); }
  if (data.tool_name !== 'Bash') process.exit(0);
  const cmd = (data.tool_input && data.tool_input.command) || '';
  if (!cmd.trim()) process.exit(0);

  const hasBanner = /\becho\s+(["']?)\s*[=#*_-]{3,}/.test(cmd);

  let sep = 0, quote = null;
  for (let i = 0; i < cmd.length; i++) {
    const ch = cmd[i];
    if (quote) { if (ch === quote) quote = null; continue; }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === ';') sep++;
    else if (ch === '&' && cmd[i + 1] === '&') (sep++, i++);
    else if (ch === '|' && cmd[i + 1] === '|') (sep++, i++);
  }
  const tooManySegments = sep >= 2;
  if (!hasBanner && !tooManySegments) process.exit(0);

  const why = [hasBanner ? 'echo banner' : null,
                tooManySegments ? `${sep + 1} chained statements` : null]
    .filter(Boolean).join(', ');
  process.stderr.write(
    `Blocked chained bash (${why}). Resend as separate single-purpose Bash ` +
    `calls — one command each, no "===" / "###" echo banners. Each small ` +
    `command matches a reusable allow pattern and auto-approves; this combined ` +
    `command does not. Prefer Read/Grep/Glob over cat/grep/find where they fit.\n`
  );
  process.exit(2);
});
