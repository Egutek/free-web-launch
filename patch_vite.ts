import fs from 'fs';
let code = fs.readFileSync('vite.config.ts', 'utf-8');

code = code.replace(
  'tanstackStart: {',
  'nitro: {\n    preset: "node-server",\n    output: { dir: "dist" }\n  },\n  tanstackStart: {'
);

fs.writeFileSync('vite.config.ts', code);
