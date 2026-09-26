# ZF Operativa Ostrov

## Nový Firebase projekt
Projekt: `freeai-ff700`, pojmenovaná databáze Firestore: `freeai-ff700`.
Původní Firebase webovou konfiguraci **nepoužívejte**.

1. Ve Firebase Console → Project settings → Your apps zaregistrujte nebo otevřete webovou aplikaci a zkopírujte **apiKey** a **appId**.
2. V hostingu nastavte `VITE_FIREBASE_API_KEY` a `VITE_FIREBASE_APP_ID` z tohoto webového projektu. Pro lokální vývoj je dejte do `.env.local` podle `.env.example`.
3. Firebase Authentication → Sign-in method → povolte **Anonymous**.
4. Ověřte existenci pojmenované Firestore databáze `freeai-ff700`. Pravidla v `firebase.json` cílí právě na ni.
5. Zkontrolujte `firestore.rules`, potom pravidla samostatně nasaďte: `npx firebase-tools@latest deploy --only firestore:rules --project freeai-ff700`.
6. `npm ci && npm run build`. Při nasazení nastavte stejné `VITE_FIREBASE_*` proměnné před sestavením.

**Pozor:** Anonymní přístup není soukromý. Při současných pravidlech může kdokoli, kdo získá webovou aplikaci, anonymně přistupovat ke sdíleným datům. Pro soukromý provoz použijte samostatné omezení přístupu (např. Cloudflare Access) nebo přejděte na přihlášení a pravidla podle uživatelů. Samotný skrytý odkaz nestačí.

Aplikace nyní automaticky nenahrává staré lokální operátory do prázdné nové databáze. Případnou migraci proveďte vědomě a až po záloze dat.

## Cloudflare Workers
Projekt používá TanStack Start se serverovým sestavením. Použijte Workers (nikoli pouze statické Pages). Build: `npm run build:cloudflare`, deploy: `npx wrangler deploy`. Změny Firestore pravidel jsou nezávislé na nasazení webu.

## Ověření
Po zapnutí Anonymous Auth a nasazení pravidel otevřete aplikaci ve dvou nezávislých prohlížečích. Zkontrolujte online indikátor, přidání operátora, přesun mezi odděleními, změnu na druhém zařízení a chování po odpojení a obnovení internetu.
