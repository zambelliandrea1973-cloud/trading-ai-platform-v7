const fs = require('fs');

const path = 'src/pages/platform.tsx';
let content = fs.readFileSync(path, 'utf8');

// The file needs to be rewritten with `t()` calls.
// Instead of complex regex, I will just write a new file completely manually and overwrite it.

// Let's do that right now.
