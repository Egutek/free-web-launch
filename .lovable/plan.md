# Plán: ZF Operativa Ostrov — zdarma online

Přeneseme vaši aplikaci **ZF Operativa Ostrov** z GitHubu (github.com/Egutek/AI-Studio) do Lovable a zveřejníme ji zdarma na adrese `*.lovable.app`.

Aplikace: operační řízení směn skladu — obsazení oddělení (HOVC, HOVS, Putaway, VAS, OBWF, VNA, OBWI), přesuny operátorů tažením myši, šablony směn, historie přesunů, import rozpisu z fotky pomocí AI, reporty pro vedení. Vzhled, funkce i české texty zůstanou zachované.

## Kroky

1. **Přenos aplikace** — celá aplikace (cca 8 500 řádků, 15 komponent: nástěnka oddělení, karty operátorů, rychlé přesuny, šablony, historie, tabulkový i widgetový pohled, modály) se přepíše z React + Vite SPA na TanStack Start. `/` = samotná aplikace po přihlášení.

2. **Databáze** — tabulky pro operátory, historii přesunů, šablony směn, vlastní oddělení a profily uživatelů; zabezpečení přístupu (RLS), synchronizace v reálném čase mezi přihlášenými kolegy; počáteční seznam operátorů ze souboru v repozitáři.

3. **Přihlašování Google účtem** — jako v původní aplikaci; role admina (pro vás) v samostatné tabulce.

4. **AI import z fotky rozpisu** — OCR přes Lovable AI bránu (model Gemini) se stejným českým promptem a referenčním seznamem jmen jako dnes. Není potřeba vlastní API klíč. Záložní ruční textový vstup zůstane.

5. **Zveřejnění zdarma** — publikování na bezplatnou adresu `*.lovable.app` (lze později přejmenovat nebo připojit vlastní doménu).

6. **Google Drive import/export (2. fáze, volitelné)** — původní funkce závisela na Firebase přihlášení; navrhuji ji dodat po spuštění přes Google konektor v Lovable (jedno kliknutí), aby první zveřejnění bylo rychlé.

## Co bude potřeba od vás

- Při prvním spuštění se přihlásit Google účtem.
- Na konci schválit publikování.

## Technické detaily

- Zdroj: React 19 + Vite + Express + Firebase Auth/Firestore + Gemini OCR (`/api/extract-operators`) + Google Drive.
- Cíl: TanStack Start v1 + Tailwind v4 + připojený Supabase projekt (uuwmdauncuokoqtpaijw).
- DB: `operators`, `move_history`, `shift_templates`, `custom_departments`, `profiles`, `user_roles` (enum `app_role`, funkce `has_role`); GRANTy + RLS; Realtime pro `operators` a `move_history`; seed operátorů z `src/data/initialOperators.ts` přímo v migraci.
- Auth: `lovable.auth.signInWithOAuth("google")` + `configure_social_auth`; chráněné routy pod `_authenticated/` (integration-managed gate, `/auth` veřejná stránka); placeholder `index.tsx` se smaže ve stejném kroku jako vznikne gated index.
- OCR: `createServerFn` přes Lovable AI Gateway; port promptu `EXTRACTION_PROMPT` ze `server.ts` včetně seznamu jmen a fallback parseru; bez server-only balíčků (žádný Express/`@google/genai` ve Worker runtime).
- Nepřenášíme: Firebase SDK, Express server, `.base44` soubory.
- Metadata: český title/description, OG/Twitter tagy na všech veřejných routách.
