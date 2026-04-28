const fs = require('fs');
const f = 'app/page.tsx';
let c = fs.readFileSync(f, 'utf8');
c = c.replace("athlete\\'s profile with your name attached as the verifying coach.", "athlete profile with your name attached as the verifying coach.");
fs.writeFileSync(f, c);
console.log('✅ Fixed apostrophe error');