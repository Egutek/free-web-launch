import { createServerFn } from "@tanstack/react-start";

const EXTRACTION_PROMPT = `Jsi špičkový expert na počítačové vidění (OCR) a čtení rukopisu pro logistické centrum ZF Aftermarket v Ostrově.
Tvým úkolem je z poskytnuté fotografie (bílá magnetická tabule, rozpis směn, papírová docházka, nástěnka, monitor) nebo textu pečlivě a bezchybně vytáhnout VŠECHNY přítomné operátory i osoby v absenci/vynechané a zařadit je do odpovídajících kategorií.

POSTUP PŘI ČTENÍ FOTOGRAFIE BÍLÉ TABULE:
1. Projdi detailně každý sloupec, rámeček a magnetickou lištu na tabuli zleva doprava a shora dolů.
2. Přečti jména na magnetických štítcích, lístcích i psaná fixem (i když jsou napsaná tiskacím, psacím, zkratkou nebo hůře čitelným písmem).
3. Přečti i volně připsaná jména v dolní části tabule, v poznámkách nebo po stranách (např. "PITEC S. - LL", "ZAMRII - LL", "SERHIIEVYCH - LL", "Savchenko Ihor" atd.).
4. Pokud je u jména kód vozíku / pozice (např. "V47 Burget David", "V107 Andrii Gurkot", "V13 ...", "V01 ..."), vytáhni celé jméno a kód vozíku můžeš dát do poznámky.

DŮLEŽITÁ PRAVIDLA PRO ROZPOZNÁNÍ OPERÁTORŮ VS. ABSENCÍ (NABÍDKY K VYŘAZENÍ):
1. AKTIVNÍ OPERÁTOŘI NA SMĚNĚ (pole "operators"):
   - Vytáhni všechny operátory z jednotlivých sloupců a oddělení na tabuli (HOVC, OBWI, VNA, HOVS, PUTAWAY, VAS, OBWF).

2. LIDÉ POD ABSENCÍ VLEVO NAHOŘE A PROBLEM SOLVEŘI (pole "absences"):
   - KRITICKY DŮLEŽITÉ: V levém horním rohu tabule (v záhlaví nad nebo vedle sloupců, pod nadpisy jako "ABSENCE", "DOVOLENÁ", "D", "PN", "NEMOC", "NV", "OČR", "PŘEKÁŽKA" nebo se zkratkami oddělení např. "HOVC - Novák D", "Svoboda - HOVC - PN", "Novák (Dovolená)", "D: Horák, Varga", "PN: Bartko") jsou zapsáni lidé, kteří dnes nejsou přítomni na směně.
   - TYTO LIDI VLEVO NAHOŘE POD ABSENCÍ VŽDY PEČLIVĚ PŘEČTI A UVEĎ JE DO POLE "absences"!
   - Do pole "absences" uveď také osoby ze sekce "Problem Solver" / "PS" (obvykle vpravo nahoře).
   - Tyto osoby nesmí skončit v poli "operators" jako přítomní na směně, ale MUSÍ být uvedeni v poli "absences", aby je dispečer mohl v aplikaci jedním kliknutím zařadit pod správnou absenci nebo dovolenou!
   - Každá položka v "absences" obsahuje:
     - "name": Celé jméno osoby (např. "David Svoboda", "Novák")
     - "reason": "top_absence" nebo "problem_solver"
     - "detail": důvod či označení z tabule (např. "Dovolená", "PN", "Absence vlevo nahoře", "Problem Solver", "HOVC - PN")

3. IGNORUJ NÁPISY A ZÁHLAVÍ:
   - Nezařazuj obecné názvy sloupců ani nadpisy (např. "OUTBOUND", "HOVC", "OBWI", "VNA", "PUTAWAY", "VAS", "HOVS", "PROBLEM SOLVER", "ABSENCE", "DOVOLENÁ", "SMĚNA A") jako jména lidí.

PŘIŘAZENÍ K ODDĚLENÍM (departmentId pro pole "operators"):
- 'hovc': Sloupce "OUTBOUND", "HOVC", "Expedice", "Balení", "Vstupní/Obalové centrum"
- 'obwi': Sloupce "OBWI", "Outbound Web", "International", "Expedice Web"
- 'vna': Sloupce "VNAS", "VNAC", "VNA", "Úzké uličky", vozíky V... s vysokozdvižným zakládáním
- 'hovs': Sloupce "HOVS", "HOVS/ML", "Konsolidace", "Regály"
- 'putaway': Sloupce "PUTAWAY", "Zaskladnění", "Zaskladnovani"
- 'vas': Sloupce "VAS", "Přebal", "Speciální balení"
- 'obwf': Sloupce "OBWF", "Outbound Waterfront", "HAZMAT", "Waterfront"
- 'unassigned': Sekce "TRÉNINK", nebo pokud oddělení nelze určit

PRAVIDLA PRO STROJE A KVALIFIKACE (machineType):
- 'NONE': Pro oddělení VNA ('vna') a Nezařazeno ('unassigned') VŽDY nastav 'NONE'! U VNA se automaticky počítá, že jsou na VNA a nepřiřazuje se jim LL ani RTR.
- 'RTR': Pro Outbound / HOVC ('hovc') a OBWI ('obwi') VŽDY AUTOMATICKY PŘIŘAĎ 'RTR'! Může se stát, že tam bude výjimečně někdo s LL – POUZE pokud je u jména výslovně napsáno "LL", "LL:", "(LL)" nebo "nízkozdvih", přiřaď 'LL', jinak VŽDY přiřaď 'RTR'.
- 'LL': Pro HOVS ('hovs') a Putaway ('putaway') VŽDY AUTOMATICKY PŘIŘAĎ 'LL'! (Operátoři na HOVS mají většinou nízkozdvih LL. Pouze pokud je u jména výslovně napsáno "RTR", "(RTR)", "Retrak", přiřaď 'RTR', jinak VŽDY přiřaď 'LL').

REFERENČNÍ SEZNAM PRACOVNÍKŮ ZF OSTROV (využij k přesnému doplnění a opravě překlepů z rukopisu):
Andrii Gurkot, Barnóky Roman, Bereš Zbyněk, Bogár Alexander, BOHDAN BAIOV, Burget David, Červeňák Michael, Daduč Imrich, Daniel Šír, DAVID SVOBODA, DEMIANETS D., Faber Dominik, Fiala Ladislav, Gajdoš Slavomír, Györke Ladislav, Halimov Oleh, Havel Zdeněk, Hemzáček Lukáš, Horváth Valentin, Hosszu Radek, Hřava Dominik, Chrastina Atilla, IHOR Pozniak, IHOR Savchenko, JAKUB PFREIMER, JAKUB SKÁLA, Jiří Nečas, Jiří Teplý, Jiří Vašíček, Josef Bartko, Kateřina Novotná, Kochut Yurii, Kovalchuk O., Kryvoruchko Daria, Kurcius David, Máca Filip, Martin Mazánek, Martin Vlček, Merzliakov O., Mika Dominik, Miroslav Havlík, Miroslav Kónya, Mrhal Aleš, Müller Jan, Mykhailchuk M., Nováček M., Pacelt Jakub, Pavelka Vojtěch, Petrus Oleksandr, Popelář Hynek, Pukančík Ota, Robert Trapl, Sebastian Čermák, SIDEI BOGDAN, Simona Pyttlová, Sivák David, Sivák R., Sovadina Václav, Šándor Milan, Tomáš Bartoš, TONDA HORÁK, Velat Petr, VITALII SAVCHENKO, Vít Varga, Vojtěch Hodl, Zamrii, Serhiievych, Pitec S.

Vrať VÝHRADNĚ validní JSON objekt ve tvaru:
{
  "operators": [
    {
      "name": "Celé Jméno a Příjmení",
      "machineType": "RTR" | "LL" | "NONE",
      "departmentId": "hovc" | "obwi" | "vna" | "hovs" | "putaway" | "vas" | "obwf" | "unassigned",
      "notes": "volitelná poznámka (např. V47, směna 10:00-18:00 apod.)"
    }
  ],
  "absences": [
    {
      "name": "Celé Jméno",
      "reason": "top_absence" | "problem_solver",
      "detail": "důvod (např. Dovolená, PN, Absence vlevo nahoře, PS)"
    }
  ]
}`;

export type ExtractedOperator = {
  name: string;
  machineType: "LL" | "RTR" | "NONE";
  departmentId: string;
  notes?: string;
};

export type FilteredOutRecord = {
  name: string;
  reason: "problem_solver" | "top_absence" | "header_or_invalid";
  detail: string;
};

export function isProblemSolver(name: string, notes?: string, dept?: string): boolean {
  const text = `${name} ${notes || ""} ${dept || ""}`.toLowerCase();
  if (/problem[\s_-]*solv/i.test(text)) return true;
  if (/řešitel|resitel/i.test(text)) return true;
  // Match standalone "PS" tag in name or department (e.g. "PS", "PS:", "(PS)", "[PS]")
  if (
    /(?:^|[\s([_\-,])ps(?::|[\s)\]_\-,]|$)/i.test(name) ||
    /(?:^|[\s([_\-,])ps(?::|[\s)\]_\-,]|$)/i.test(dept || "")
  ) {
    return true;
  }
  // In notes, only match if it explicitly mentions problem solving or stands alone as PS role
  if (
    notes &&
    /(?:^|[\s([_\-,])ps(?::|[\s)\]_\-,]|$)/i.test(notes) &&
    /problem|solver|řešit/i.test(notes)
  ) {
    return true;
  }
  return false;
}

export function isTopAbsenceOrAbsent(name: string, notes?: string, dept?: string): boolean {
  const n = (name || "").toLowerCase();
  const not = (notes || "").toLowerCase();
  const d = (dept || "").toLowerCase();

  // Strong keywords indicating absent workers
  const strongAbsencePattern =
    /absence|dovolen[áa]|neschopenka|nemoc|l[ée]ka[rř]|o[šs]et[rř]ov|nep[rř][íi]tom|neomluven|p[rř]ek[áa][zž]ka|paragraf/i;
  if (strongAbsencePattern.test(n) || strongAbsencePattern.test(d)) return true;
  if (strongAbsencePattern.test(not)) return true;

  // Czech absence abbreviations: PN (pracovní neschopnost), NV (neplacené volno), OČR (ošetřovné)
  // CRITICAL: NEVER match English "OCR" (Optical Character Recognition) as an absence!
  const absenceCodePattern = /(?:^|[\s([_\-,])(pn|nv|očr|ocr_abs)(?:[\s)\]_\-.,]|$)/i;
  if (absenceCodePattern.test(n) || absenceCodePattern.test(d)) return true;
  if (
    not &&
    absenceCodePattern.test(not) &&
    !not.includes("optical") &&
    !not.includes("rozpoznán")
  ) {
    return true;
  }

  // Tag (D) or (DOV) for dovolená
  if (
    /(?:^|[\s([_\-,])d(?:ov)?(?:[\s)\]_\-.,]|$)/i.test(n) &&
    (n.includes("dovol") || not.includes("dovol"))
  ) {
    return true;
  }

  return false;
}

export function isCategoryHeader(name: string): boolean {
  const cleaned = name
    .trim()
    .toLowerCase()
    .replace(/[:\-_.]/g, "");
  const headers = [
    "problem solver",
    "problem solvers",
    "problem solving",
    "ps",
    "absence",
    "dovolená",
    "dovolena",
    "nemoc",
    "outbound",
    "hovc",
    "obwi",
    "vna",
    "vnas",
    "vnac",
    "hovs",
    "putaway",
    "vas",
    "obwf",
    "oddělení",
    "oddeleni",
    "směna",
    "smena",
    "legenda",
    "operátor",
    "operator",
    "operátoři",
    "operatori",
    "zf aftermarket",
    "jméno",
    "jmeno",
    "poznámka",
    "poznamka",
  ];
  return (
    headers.includes(cleaned) || cleaned.startsWith("oddělení") || cleaned.startsWith("oddeleni")
  );
}

function parseGeminiJson(rawContent: string): { operators?: unknown[] } | unknown[] | null {
  if (!rawContent || !rawContent.trim()) return null;
  const trimmed = rawContent.trim();

  try {
    return JSON.parse(trimmed);
  } catch (_e) {
    // try fallback extraction
  }

  const markdownMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (markdownMatch && markdownMatch[1]) {
    try {
      return JSON.parse(markdownMatch[1].trim());
    } catch (_e) {
      // try fallback extraction
    }
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
    } catch (_e) {
      // try fallback extraction
    }
  }

  const firstBracket = trimmed.indexOf("[");
  const lastBracket = trimmed.lastIndexOf("]");
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    try {
      return JSON.parse(trimmed.slice(firstBracket, lastBracket + 1));
    } catch (_e) {
      // try fallback extraction
    }
  }

  return null;
}

export function parseTextFallback(textInput: string): {
  operators: ExtractedOperator[];
  filteredOut: FilteredOutRecord[];
} {
  const operators: ExtractedOperator[] = [];
  const filteredOut: FilteredOutRecord[] = [];

  const lines = textInput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  for (const line of lines) {
    const parts = line.split(/[\t;,]/).map((p) => p.trim());
    const name = parts[0] || "Neznámý";
    const notes = parts.slice(1).join(" | ");

    if (isCategoryHeader(name)) {
      filteredOut.push({
        name,
        reason: "header_or_invalid",
        detail: "Záhlaví nebo název kategorie",
      });
      continue;
    }

    if (isProblemSolver(name, notes)) {
      filteredOut.push({
        name,
        reason: "problem_solver",
        detail: "Kategorie Problem Solver",
      });
      continue;
    }

    if (isTopAbsenceOrAbsent(name, notes)) {
      filteredOut.push({
        name,
        reason: "top_absence",
        detail: "Horní lišta absencí / nepřítomnost",
      });
      continue;
    }

    const upperLine = `${name} ${notes}`.toUpperCase();
    const hasExplicitLL =
      upperLine.includes(" LL") ||
      upperLine.includes("(LL)") ||
      upperLine.includes("-LL") ||
      upperLine.includes("NÍZKOZDVIH");
    const hasExplicitRTR = upperLine.includes("RTR") || upperLine.includes("RETRAK");
    const isVNA = upperLine.includes("VNA") || upperLine.includes("ULIČK");

    let departmentId = "unassigned";
    if (
      upperLine.includes("HOVC") ||
      upperLine.includes("OUTBOUND") ||
      upperLine.includes("EXPEDICE") ||
      upperLine.includes("BALENI")
    ) {
      departmentId = "hovc";
    } else if (upperLine.includes("HOVS") || upperLine.includes("REGALY")) {
      departmentId = "hovs";
    } else if (upperLine.includes("VAS") || upperLine.includes("PREBAL")) {
      departmentId = "vas";
    } else if (
      upperLine.includes("PUTAWAY") ||
      upperLine.includes("ZASKLADNENI") ||
      upperLine.includes("PUT")
    ) {
      departmentId = "putaway";
    } else if (upperLine.includes("OBWF") || upperLine.includes("WATERFRONT")) {
      departmentId = "obwf";
    } else if (isVNA) {
      departmentId = "vna";
    } else if (upperLine.includes("OBWI") || upperLine.includes("WEB")) {
      departmentId = "obwi";
    }

    let machineType: "LL" | "RTR" | "NONE" = "LL";
    if (departmentId === "vna" || departmentId === "unassigned") {
      machineType = "NONE";
    } else if (departmentId === "hovs") {
      machineType = hasExplicitRTR ? "RTR" : "LL";
    } else if (departmentId === "hovc" || departmentId === "obwi") {
      machineType = hasExplicitLL ? "LL" : "RTR";
    } else if (departmentId === "putaway") {
      machineType = hasExplicitRTR ? "RTR" : "LL";
    } else if (departmentId === "vas") {
      machineType = hasExplicitRTR ? "RTR" : hasExplicitLL ? "LL" : "NONE";
    } else {
      machineType = hasExplicitRTR ? "RTR" : "LL";
    }

    if (name.length > 1) {
      operators.push({
        name: name.slice(0, 50),
        machineType,
        departmentId,
        notes: notes.slice(0, 100),
      });
    }
  }

  return { operators, filteredOut };
}

export function normalize(
  list: unknown,
  rawAbsences?: unknown,
): {
  operators: ExtractedOperator[];
  filteredOut: FilteredOutRecord[];
} {
  const operators: ExtractedOperator[] = [];
  const filteredOut: FilteredOutRecord[] = [];
  const seenNames = new Set<string>();

  // 1. Zpracuj explicitně nalezené absence a Problem Solvery (např. z levého horního rohu)
  if (Array.isArray(rawAbsences)) {
    for (const raw of rawAbsences) {
      const item = raw as Record<string, unknown>;
      const name = typeof item["name"] === "string" ? item["name"].trim() : "";
      if (!name || name.length <= 1 || isCategoryHeader(name)) continue;

      const detail =
        typeof item["detail"] === "string" && item["detail"].trim()
          ? item["detail"].trim()
          : "Absence zjištěná vlevo nahoře";
      const reasonRaw = String(item["reason"] || "").toLowerCase();
      const reason: FilteredOutRecord["reason"] =
        reasonRaw === "problem_solver" || isProblemSolver(name, detail)
          ? "problem_solver"
          : "top_absence";

      const key = name.toLowerCase();
      if (!seenNames.has(key)) {
        seenNames.add(key);
        filteredOut.push({
          name,
          reason,
          detail,
        });
      }
    }
  }

  // 2. Zpracuj seznam operátorů přiřazených k oddělením
  if (Array.isArray(list)) {
    for (const raw of list) {
      const op = raw as Record<string, unknown>;
      const name = typeof op["name"] === "string" ? op["name"].trim() : "";
      const dept =
        typeof op["departmentId"] === "string" ? op["departmentId"].toLowerCase() : "hovc";
      const notes = typeof op["notes"] === "string" ? op["notes"] : undefined;

      if (!name || name.length <= 1) continue;

      if (isCategoryHeader(name)) {
        filteredOut.push({
          name,
          reason: "header_or_invalid",
          detail: "Záhlaví nebo název kategorie",
        });
        continue;
      }

      if (isProblemSolver(name, notes, dept)) {
        const key = name.toLowerCase();
        if (!seenNames.has(key)) {
          seenNames.add(key);
          filteredOut.push({
            name,
            reason: "problem_solver",
            detail: notes || "Kategorie Problem Solver",
          });
        }
        continue;
      }

      if (isTopAbsenceOrAbsent(name, notes, dept)) {
        const key = name.toLowerCase();
        if (!seenNames.has(key)) {
          seenNames.add(key);
          filteredOut.push({
            name,
            reason: "top_absence",
            detail: notes || "Horní lišta absencí vlevo nahoře",
          });
        }
        continue;
      }

      // Bezpečnostní pojistka: pokud je zařazen do nezařazených a poznámka obsahuje absenci/dovolenou/pn
      if (
        dept === "unassigned" &&
        notes &&
        /absence|dovolen|pn|neschop|nemoc|lékař|očr/i.test(notes)
      ) {
        const key = name.toLowerCase();
        if (!seenNames.has(key)) {
          seenNames.add(key);
          filteredOut.push({
            name,
            reason: "top_absence",
            detail: notes || "Absence vlevo nahoře (nezařazeno)",
          });
        }
        continue;
      }

      const combinedUpper = `${name} ${notes || ""}`.toUpperCase();
      const hasExplicitLL =
        combinedUpper.includes(" LL") ||
        combinedUpper.includes("(LL)") ||
        combinedUpper.includes("-LL") ||
        combinedUpper.includes("NÍZKOZDVIH");
      const hasExplicitRTR = combinedUpper.includes("RTR") || combinedUpper.includes("RETRAK");

      let machineType: "LL" | "RTR" | "NONE" = "LL";
      if (dept === "vna" || dept === "unassigned") {
        machineType = "NONE";
      } else if (dept === "hovs") {
        machineType = hasExplicitRTR ? "RTR" : "LL";
      } else if (dept === "hovc" || dept === "obwi") {
        machineType = hasExplicitLL ? "LL" : "RTR";
      } else if (dept === "putaway") {
        machineType = hasExplicitRTR ? "RTR" : "LL";
      } else {
        const rawMachine = String(op["machineType"] ?? "").toUpperCase();
        machineType = rawMachine === "RTR" ? "RTR" : rawMachine === "NONE" ? "NONE" : "LL";
      }

      operators.push({
        name,
        machineType,
        departmentId: dept,
        notes,
      });
    }
  }

  return { operators, filteredOut };
}

export const extractOperatorsFn = createServerFn({ method: "POST" })
  .validator(
    (d: {
      imageBase64?: string;
      mimeType?: string;
      textInput?: string;
      customInstructions?: string;
    }) => d,
  )
  .handler(async ({ data }) => {
    const { imageBase64, mimeType = "image/jpeg", textInput, customInstructions } = data;

    if (!imageBase64 && !textInput) {
      throw new Error("Nebyly poskytnuty žádné obrazové ani textové údaje.");
    }

    const geminiKey = process.env["GEMINI_API_KEY"];

    if (!geminiKey) {
      if (textInput) {
        const fallbackResult = parseTextFallback(textInput);
        return { operators: fallbackResult.operators, filteredOut: fallbackResult.filteredOut };
      }
      throw new Error(
        "V prostředí chybí proměnná GEMINI_API_KEY. Přidejte si do administrace Netlify (Site configuration -> Environment variables) klíč GEMINI_API_KEY.",
      );
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    let promptText = EXTRACTION_PROMPT;
    if (customInstructions && customInstructions.trim()) {
      promptText += `\n\n======================================================
DODATEČNÉ VLASTNÍ INSTRUKCE A POKYNY OD DISPEČERA (NEJVYŠŠÍ PRIORITA):
${customInstructions.trim()}
======================================================\n`;
    }
    promptText += `\nVytáhni všechny operátory na směně ("operators") i všechny osoby v absenci ("absences") z přiloženého materiálu. Vrať striktně JSON objekt {"operators": [...], "absences": [...]}.`;

    const parts: Array<Record<string, unknown>> = [
      {
        text: promptText,
      },
    ];

    if (imageBase64) {
      const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, "");
      parts.push({
        inline_data: {
          mime_type: mimeType,
          data: cleanBase64,
        },
      });
    }

    if (textInput) {
      parts.push({ text: `Zdrojový text:\n${textInput}` });
    }

    let operators: ExtractedOperator[] = [];
    let filteredOut: FilteredOutRecord[] = [];

    // Prioritized working Gemini models (gemini-3.6-flash is primary, 3.1-flash-lite is backup)
    const modelsToTry = ["gemini-3.6-flash", "gemini-3.1-flash-lite", "gemini-3.8-flash"];
    let lastError: Error | null = null;

    for (const model of modelsToTry) {
      try {
        console.log(`[OCR] Pokus o extrakci modelem ${model}...`);
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
        const aiResponse = await fetch(apiUrl, {
          method: "POST",
          headers,
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.1,
            },
          }),
          signal: AbortSignal.timeout(20000),
        });

        if (!aiResponse.ok) {
          const detail = await aiResponse.text();
          console.warn(`[OCR] Gemini model ${model} vrátil kód ${aiResponse.status}:`, detail);

          let parsedErrorMessage = `Chyba modelu ${model} (${aiResponse.status})`;
          try {
            const errObj = JSON.parse(detail);
            if (errObj?.error?.message) {
              parsedErrorMessage = errObj.error.message;
            }
          } catch {
            // Keep fallback message
          }

          if (aiResponse.status === 400 && detail.includes("API key not valid")) {
            throw new Error(
              "Zadaný GEMINI_API_KEY není platný. Zkontrolujte prosím svůj klíč v Google AI Studio.",
            );
          }

          // On 429 or 503, continue to try fallback model
          lastError = new Error(parsedErrorMessage);
          continue;
        }

        const payload = (await aiResponse.json()) as {
          candidates?: Array<{
            content?: {
              parts?: Array<{ text?: string; thought?: boolean }>;
            };
          }>;
        };

        const candidateParts = payload.candidates?.[0]?.content?.parts || [];
        // Combine text from non-thought parts first, or fallback to all text parts
        const nonThoughtText = candidateParts
          .filter((p) => !p.thought && typeof p.text === "string")
          .map((p) => p.text)
          .join("\n")
          .trim();

        const allText = candidateParts
          .filter((p) => typeof p.text === "string")
          .map((p) => p.text)
          .join("\n")
          .trim();

        const textToParse = nonThoughtText || allText || "{}";

        const parsed = parseGeminiJson(textToParse);
        if (!parsed) {
          console.warn(
            `[OCR] Model ${model} vrátil text, který se nepodařilo zparsovat jako JSON:`,
            textToParse.slice(0, 200),
          );
          lastError = new Error(`Model ${model} nevrátil platný JSON.`);
          continue;
        }

        const rawList = Array.isArray(parsed)
          ? parsed
          : (parsed as { operators?: unknown[] })?.operators;
        const rawAbsences = !Array.isArray(parsed)
          ? (parsed as { absences?: unknown[] })?.absences
          : undefined;

        const extracted = normalize(rawList, rawAbsences);
        console.log(
          `[OCR] Model ${model} úspěšně extrahoval ${extracted.operators.length} operátorů a ${extracted.filteredOut.length} vyřazených/absencí.`,
        );

        if (extracted.operators.length > 0 || extracted.filteredOut.length > 0) {
          operators = extracted.operators;
          filteredOut = extracted.filteredOut;
          break; // Successfully extracted
        }
      } catch (err: unknown) {
        console.warn(`[OCR] Pokus s modelem ${model} selhal:`, err);
        lastError = err instanceof Error ? err : new Error(String(err));
        if (lastError.message.includes("GEMINI_API_KEY není platný")) {
          break;
        }
      }
    }

    if (operators.length === 0 && filteredOut.length === 0) {
      if (textInput) {
        const fallbackResult = parseTextFallback(textInput);
        operators = fallbackResult.operators;
        filteredOut = fallbackResult.filteredOut;
      } else if (lastError) {
        throw new Error(
          lastError.message ||
            "Při zpracování snímku došlo k chybě. Zkuste to prosím znovu nebo vložte rozpis jako text.",
        );
      }
    }

    if (operators.length === 0 && filteredOut.length === 0 && textInput) {
      const fallbackResult = parseTextFallback(textInput);
      operators = fallbackResult.operators;
      filteredOut = fallbackResult.filteredOut;
    }

    return { operators, filteredOut };
  });
