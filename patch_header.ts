import fs from "fs";
let code = fs.readFileSync("src/app/components/Header.tsx", "utf-8");

code = code.replace("import {", 'import { logout } from "../../firebase";\nimport {');

code = code.replace(
  "            {/* View switcher: Board / Widget na tapetu / Table */}",
  `            {/* Logout button */}
            <button
              onClick={logout}
              className="text-xs text-slate-500 hover:text-red-500 transition-colors"
              title="Odhlásit se"
            >
              Odhlásit
            </button>
            {/* View switcher: Board / Widget na tapetu / Table */}`,
);

fs.writeFileSync("src/app/components/Header.tsx", code);
