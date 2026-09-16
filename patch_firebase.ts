import fs from "fs";
let code = fs.readFileSync("src/app/firebase.ts", "utf-8");

code = code.replace(
  'import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";',
  'import { getAuth } from "firebase/auth";',
);

code = code.replace(
  /export const provider = new GoogleAuthProvider\(\);\nexport const loginWithGoogle = \(\) => signInWithPopup\(auth, provider\);\nexport const logout = \(\) => signOut\(auth\);/g,
  "",
);

fs.writeFileSync("src/app/firebase.ts", code);
