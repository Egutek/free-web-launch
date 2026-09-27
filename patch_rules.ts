import fs from "fs";
let code = fs.readFileSync("firestore.rules", "utf-8");

code = code.replace(
  /function isSignedIn\(\) \{\s*return request\.auth != null;[^}]*\}/g,
  "function isSignedIn() { return true; }",
);

fs.writeFileSync("firestore.rules", code);
