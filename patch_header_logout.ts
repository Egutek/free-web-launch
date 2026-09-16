import fs from "fs";
let code = fs.readFileSync("src/app/components/Header.tsx", "utf-8");

code = code.replace('import { logout } from "../firebase";\n', "");

code = code.replace(
  /\{\/\* Logout button \*\/\}\s*<button\s*onClick=\{logout\}\s*className="[^"]+"\s*title="Odhlásit se"\s*>\s*Odhlásit\s*<\/button>/g,
  "",
);

fs.writeFileSync("src/app/components/Header.tsx", code);
