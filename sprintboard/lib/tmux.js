'use strict';

function shq(s) {
  return `'` + String(s).replace(/'/g, `'\\''`) + `'`;
}

function fillTemplate(tpl, item) {
  return tpl.replace(/\{(key|title|url|repo)\}/g, (_, k) => item[k] ?? '');
}

function windowName(key) {
  // 'acme/widgets#42' -> 'widgets-42'; jira keys pass through
  return key.replace(/^.*\//, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
}

async function launch(run, { session, name, cwd, prompt }) {
  const shellCmd = `claude ${shq(prompt)}`;
  // Stable window id (e.g. '@5'), not window_index: renumber-windows on
  // reassigns indices when lower windows close, making index-based targets dangle.
  const fmt = '#{window_id}';
  const exists = await run('tmux', ['has-session', '-t', session]).then(() => true, () => false);
  let target;
  if (exists) {
    target = (await run('tmux', ['new-window', '-d', '-P', '-F', fmt, '-t', session, '-n', name, '-c', cwd, shellCmd])).trim();
  } else {
    target = (await run('tmux', ['new-session', '-d', '-P', '-F', fmt, '-s', session, '-n', name, '-c', cwd, shellCmd])).trim();
  }
  await run('tmux', ['set-option', '-t', target, '-w', 'automatic-rename', 'off']);
  return { target, attach: `tmux attach -t ${shq(session)} \\; select-window -t ${target}` };
}

function tail(run, target, lines = 80) {
  return run('tmux', ['capture-pane', '-p', '-t', target, '-S', `-${lines}`]);
}

module.exports = { launch, tail, fillTemplate, windowName, shq };
