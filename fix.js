const fs = require('fs');
const f = 'app/page.tsx';
let c = fs.readFileSync(f, 'utf8');
if (!c.startsWith("'use client'")) {
  c = "'use client';\n" + c;
  fs.writeFileSync(f, c);
  console.log('✅ Fixed');
} else {
  console.log('Already has use client');
}