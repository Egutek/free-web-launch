import fs from "fs";
let pkg = JSON.parse(fs.readFileSync("package.json", "utf-8"));
pkg.scripts.start = "node dist/server/index.mjs";
fs.writeFileSync("package.json", JSON.stringify(pkg, null, 2));
