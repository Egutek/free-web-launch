# Plán: ZF Operativa Ostrov — zdarma online

Přeneseme vaši aplikaci **ZF Operativa Ostrov** z GitHubu (github.com/Egutek/AI-Studio) do Lovable a zveřejníme ji zdarma na adrese `*.lovable.app`.

Aplikace: operační řízení směn skladu — obsazení oddělení (HOVC, HOVS, Putaway, VAS, OBWF, VNA, OBWI), přesuny operátorů tažením myši, šablony směn, historie přesunů, import rozpisu z fotky pomocí AI, reporty pro vedení. Vzhled, funkce i české texty zůstanou zachované.

**Bez přihlašování:** aplikace se otevře hned a kdokoli s odkazem může provádět změny. Všichni vidí stejná data a úpravy se okamžitě promítnou ostatním.

## Kroky

1. **Přenos aplikace** — celá aplikace (cca 8 500 řádků, 15 komponent: nástěnka oddělení, karty operátorů, rychlé přesuny, šablony, historie, tabulkový i widgetový pohled, modály) se přepíše z React + Vite SPA na TanStack Start. `/` = samotná aplikace, žádná přihlašovací obrazovka.

2. **Databáze** — tabulky pro operátory, historii přesunů, šablony směn a vlastní oddělení; veřejný přístup pro čtení i úpravy, synchronizace v reálném čase mezi všemi otevřenými okny; počáteční seznam operátorů ze souboru v repozitáři.

3. **AI import z fotky rozpisu** — OCR přes Lovable AI bránu (model Gemini) se stejným českým promptem a referenčním seznamem jmen jako dnes. Není potřeba vlastní API klíč. Záložní ruční textový vstup zůstane.

4. **Zveřejnění zdarma** — publikování na bezplatnou adresu `*.lovable.app` (lze později přejmenovat nebo připojit vlastní doménu).

5. **Google Drive import/export (2. fáze, volitelné)** — původní funkce závisela na Google přihlášení; navrhuji ji dodat po spuštění přes Google konektor v Lovable, aby první zveřejnění bylo rychlé.

## Na co upozorňuji

Bez přihlašování je odkaz jediná ochrana — kdokoli, kdo ho získá, uvidí jména operátorů a může data měnit nebo smazat. Historie přesunů zůstane, takže změny je vidět. Kdykoli později můžeme přidat jednoduché heslo pro celou stránku nebo přihlášení Google účtem.

## Co bude potřeba od vás

Na konci jen schválit publikování.

## Technické detaily

- Zdroj: React 19 + Vite + Express + Firebase Auth/Firestore + Gemini OCR (`/api/extract-operators`) + Google Drive.
- Cíl: TanStack Start v1 + Tailwind v4 + připojený Supabase projekt (uuwmdauncuokoqtpaijw).
- DB: `operators`, `move_history`, `shift_templates`, `custom_departments`. GRANT SELECT/INSERT/UPDATE/DELETE `TO anon` + `service_role`; RLS zapnuté s otevřenými `TO anon` politikami (vědomé rozhodnutí, viz upozornění). Žádné `profiles`/`user_roles`, žádný `auth.uid()`. Realtime pro `operators` a `move_history`. Seed operátorů z `src/data/initialOperators.ts` literálními INSERTy v migraci.
- Žádné `_authenticated/` routy, žádný `/auth`, žádné `requireSupabaseAuth`; čtení/zápis přes browser klienta s publishable key. Placeholder `src/routes/index.tsx` se přepíše na samotnou aplikaci.
- `updatedBy` z původního modelu se nahradí volitelným jménem dispečera zadaným v UI (bez identity).
- OCR: `createServerFn` přes Lovable AI Gateway; port promptu `EXTRACTION_PROMPT` ze `server.ts` včetně seznamu jmen a fallback parseru; bez server-only balíčků (žádný Express/`@google/genai` ve Worker runtime).
- Nepřenášíme: Firebase SDK a `firestore.rules`, Express server, `.base44` soubory, `googleDriveAuth.ts`.
- Metadata: český title/description, OG/Twitter tagy.
