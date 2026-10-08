# ZF Shift Board OCR - experimentální MVP

Samostatný prototyp domluveného workflow: fotografie magnetické tabule -> automatické kontrastní předzpracování -> lokální OCR -> validace proti seznamu OP -> detekce nejistých výsledků a duplicit.

## Spuštění
```bash
npm install
npm run dev
```

## Důležité
- Experimentální MVP, ne produkční docházkový systém.
- Aktuální preprocessing dělá automatické škálování, grayscale a kontrast. Perspektivní korekce a robustní detekce magnetek jsou další P0.
- OCR běží v browseru přes Tesseract.js; fotografie se v této verzi neukládá na backend.
- Automatické rozhodnutí není dovoleno u nejistého výsledku.

## ZF Team Lead design proposal
- Hlavní obrazovka: dashboard s přehledem směny, potvrzených OP, kvalitou OCR a stavem přesunů.
- Workflow: načtení fotky tabule -> OCR -> automatická sumarizace -> explicitní review -> live přesun OP.
- Provozní design klade důraz na rychlé rozhodování team leada: zvýraznění transportu, přehledné karty, jasné záložky a minimální kroky k akci.
- V produkčním nasazení se k OCR přidá backend validace a audit historie přesunů.

## Deployment plan
1. Pilot v jednom areálu: 2–4 týdnů, pouze top role team lead a jedna směna.
2. Staging: validace foto tabule, režim review a export auditu, bez prod přístupu.
3. Production: interní web app, SSO, role-based access, přístup pouze v síti výrobního areálu a automatický backup audit logů.
4. Live monitoring: OCR confidence rate, false positives, review queue, výjimky při šumu tabule.

## Další P0
1. OpenCV.js detekce hran tabule a perspective transform.
2. Detekce jednotlivých magnetek a OCR po ROI místo celé fotografie.
3. Geometrické přiřazování magnetky k nejbližšímu nadpisu pracoviště.
4. Druhý nezávislý OCR průchod a disagreement gate.
5. Benchmark na reálných snímcích: missed magnets, wrong identity, wrong area, false positives.
