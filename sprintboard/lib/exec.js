'use strict';
const { execFile } = require('node:child_process');

// run('gh', ['pr', 'list']) -> Promise<stdout string>. Rejects with stderr in the message.
function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { maxBuffer: 10 * 1024 * 1024, ...opts }, (err, stdout, stderr) => {
      if (err) reject(new Error(`${cmd} ${args.join(' ')} failed: ${(stderr || err.message).trim()}`));
      else resolve(stdout);
    });
  });
}

module.exports = { run };
