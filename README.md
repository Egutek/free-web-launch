# ZF Operativa Ostrov

## Firebase projekt

Projekt: `freeai-ff700`, databáze Firestore: `(default)`. Web používá registrovanou Firebase aplikaci Freeai.

1. Firebase Authentication → Sign-in method → **Anonymous** musí být zapnuté. Uživatelé se přihlásí anonymně na pozadí, bez formuláře nebo účtu.
2. Firestore Rules musí být nasazeny z `firestore.rules` do databáze `(default)`: `npx firebase-tools@latest deploy --only firestore:rules --project freeai-ff700`.
3. Firebase SDK používá ID aplikace `1:802136563532:web:22c640be67fb80c99eb9e9`. Případné build proměnné `VITE_FIREBASE_API_KEY` a `VITE_FIREBASE_APP_ID` musí pocházet z této webové aplikace.
4. Po sestavení a nasazení webu každý návštěvník získá anonymní Firebase identitu. Firestore `onSnapshot` doručuje změny operátorů ostatním otevřeným zařízením v reálném čase.

**Přístup přes odkaz:** každý, kdo získá URL aplikace, může číst, přidávat, upravovat i mazat sdílená provozní data v pracovním prostoru. Odkaz není přístupový zámek.

Aplikace nenahrává staré lokální záznamy do prázdné cloudové databáze automaticky. Případnou migraci proveďte vědomě až po záloze.

## Nasazení webu

Projekt používá TanStack Start se serverovým sestavením. Nasazujte jej na stávající hosting podporující Node/Workers. Build CI ověřuje přes `bun run build`. Změny pravidel Firestore se nasazují samostatně od webu.

## Ověření

Otevřete web ve dvou nezávislých prohlížečích. Oba musí ukázat online stav; přidání, přesun, změna stavu nebo oddělení v jednom musí dorazit do druhého bez obnovení stránky.
