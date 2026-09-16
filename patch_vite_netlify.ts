import fs from 'fs';
let code = fs.readFileSync('vite.config.ts', 'utf-8');

code = code.replace(
  'preset: "node-server",',
  'preset: process.env.NETLIFY ? "netlify" : "node-server",'
);
code = code.replace(
  'output: { dir: "dist" }',
  'output: process.env.NETLIFY ? undefined : { dir: "dist" }'
);

fs.writeFileSync('vite.config.ts', code);
