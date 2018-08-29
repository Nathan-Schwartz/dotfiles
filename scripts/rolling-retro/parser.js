const path = require('path');
const fs = require('fs');

const storageFile = path.resolve(require('os').homedir(), '.rolling-retro.output');

const contents = String(fs.readFileSync(storageFile));
const entries = contents.split('\n')
  .filter(a => a)
  .map((a) => JSON.parse(a));

console.log('File contents:', entries);

