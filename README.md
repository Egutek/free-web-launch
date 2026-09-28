# ZF Operativa Ostrov

Online tabule pro operativní řízení směn ve skladu ZF Ostrov.

Aplikace umožňuje živé rozdělení operátorů mezi oddělení, přesuny během směny, šablony a historii. Data se synchronizují přes Firebase/Firestore a rozhraní je připravené i pro použití na mobilu jako PWA.

## Vývoj

Požadavky: Node.js 20+ a npm.

```sh
git clone https://github.com/Egutek/free-web-launch.git
cd free-web-launch
npm install
npm run dev
```

Užitečné příkazy:

- `npm run build` — produkční build
- `npm run lint` — kontrola ESLint
- `npm run preview` — lokální náhled buildu

Firebase konfigurace je v `firebase-applet-config.json`. Veřejné webové API klíče Firebase nejsou náhradou za bezpečnostní pravidla; přístup k datům musí zůstat řízen pravidly Firestore v `firestore.rules`.

## Struktura

- `src/app/OperativaApp.tsx` — hlavní tabule a pracovní logika
- `src/app/services/` — práce s Firebase a synchronizací
- `src/routes/` — TanStack Start routy a metadata
- `public/sw.js` — PWA cache s automatickou invalidací po vydání nové verze
