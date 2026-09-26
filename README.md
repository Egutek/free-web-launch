# ZF Operativa Ostrov

[![Netlify Status](https://api.netlify.com/api/v1/badges/109dc72d-db81-4248-a2ef-43227ebd75bc/deploy-status)](https://app.netlify.com/projects/zfoperatives/deploys)

Tento projekt je online.

## Vývoj

Projekt lze dále upravovat přímo v GitHubu nebo lokálně. Pro lokální vývoj potřebujete Node.js a npm — [instalace přes nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Firebase synchronizace

Aplikace používá pojmenovanou Firestore databázi
`ai-studio-freeweblaunch-d9175b45-6e54-4972-beec-44998053c0cc`, nikoliv
výchozí `(default)` databázi. Před prvním použitím v Firebase Console zapněte
**Authentication → Sign-in method → Anonymous**. Bez tohoto poskytovatele se
klient nemůže přihlásit a pravidla Firestore mu záměrně odepřou přístup.

Pravidla jsou uložená v `firestore.rules` a jsou namapovaná na správnou
pojmenovanou databázi v `firebase.json`. Po změně pravidel je nasaďte:

```sh
npx firebase-tools@latest login
npx firebase-tools@latest deploy --only firestore:rules
```

Nasazení webu z GitHubu (např. do Netlify) pravidla Firestore automaticky
nenasazuje; jde o samostatné nasazení Firebase.

## Alternativa: Cloudflare Workers

Projekt má serverové sestavení TanStack Start. Pro Cloudflare proto používejte
Workers, nikoli nahrání složky `dist` jako statického webu. Konfigurace je v
`wrangler.jsonc`; `npm run build:cloudflare` vytvoří sestavení pro Workers a
`npm run deploy:cloudflare` ho zveřejní po přihlášení do Cloudflare.

Při propojení GitHub repozitáře s Workers Builds nastavte build command
`npm run build:cloudflare` a deploy command `npx wrangler deploy`. Firestore
zůstává ve stávajícím projektu Firebase; pravidla a povolení Anonymous
Authentication nasazujte zvlášť podle postupu výše. Před přepnutím odkazu
otestujte online stav a změnu provedenou na jednom zařízení na druhém.
