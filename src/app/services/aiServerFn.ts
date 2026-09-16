import { createServerFn } from "@tanstack/react-start";

const EXTRACTION_PROMPT = `Jsi špičkový expert na počítačové vidění (OCR) a čtení rukopisu pro logistické centrum ZF Aftermarket v Ostrově.
Tvým úkolem je z poskytnuté fotografie (bílá magnetická tabule, rozpis směn, papírová docházka, nástěnka, monitor) nebo textu pečlivě a bezchybně vytáhnout VŠECHNY přítomné operátory a přiřadit je k jejich oddělením a strojům.

POSTUP PŘI ČTENÍ FOTOGRAFIE BÍLÉ TABULE:
1. Projdi detailně každý sloupec, rámeček a magnetickou lištu na tabuli zleva doprava a shora dolů.
2. Přečti jména na magnetických štítcích, lístcích i psaná fixem (i když jsou napsaná tiskacím, psacím, zkratkou nebo hůře čitelným písmem).
3. Přečti i volně připsaná jména v dolní části tabule, v poznámkách nebo po stranách (např. "PITEC S. - LL", "ZAMRII - LL", "SERHIIEVYCH - LL", "Savchenko Ihor" atd.).
4. Pokud je u jména kód vozíku / pozice (např. "V47 Burget David", "V107 Andrii Gurkot", "V13 ...", "V01 ..."), vytáhni celé jméno a kód vozíku můžeš dát do poznámky.

PŘIŘAZENÍ K ODDĚLENÍM (departmentId):
- 'vna': Sloupce "VNAS", "VNAC", "VNA", "Úzké uličky", vozíky V... s vysokozdvižným zakládáním
- 'hovs': Sloupce "HOVS", "HOVS/ML", "Konsolidace", "Regály"
- 'putaway': Sloupce "PUTAWAY", "Zaskladnění", "Zaskladnovani"
- 'vas': Sloupce "VAS", "Přebal", "Speciální balení"
- 'obwf': Sloupce "OBWF", "Outbound Waterfront", "HAZMAT", "Waterfront"
- 'obwi': Sloupce "OBWI", "Outbound Web", "International", "Expedice Web"
- 'hovc': Sloupce "OUTBOUND", "HOVC", "Expedice", "Balení", "Vstupní/Obalové centrum"
- 'unassigned': Sekce "TRÉNINK", volné poznámky bez určení sekce, nebo pokud oddělení nelze určit

STROJE A KVALIFIKACE (machineType):
- 'RTR': Retrak / vysokozdvižný vozík do úzkých uliček (sekce VNA, HOVS nebo výslovně uvedeno RTR / Retrak).
- 'LL': Nízkozdvižný vozík / běžný pickovací vozík (výchozí pro většinu operátorů na picku, Outboundu, nebo pokud je uvedeno LL).
- 'NONE': Pokud pracovník nemá stroj (např. čisté balení VAS, trénink).

REFERENČNÍ SEZNAM PRACOVNÍKŮ ZF OSTROV (využij k přesnému doplnění a opravě překlepů z rukopisu):
Andrii Gurkot, Barnóky Roman, Bereš Zbyněk, Bogár Alexander, BOHDAN BAIOV, Burget David, Červeňák Michael, Daduč Imrich, Daniel Šír, DAVID SVOBODA, DEMIANETS D., Faber Dominik, Fiala Ladislav, Gajdoš Slavomír, Györke Ladislav, Halimov Oleh, Havel Zdeněk, Hemzáček Lukáš, Horváth Valentin, Hosszu Radek, Hřava Dominik, Chrastina Atilla, IHOR Pozniak, IHOR Savchenko, JAKUB PFREIMER, JAKUB SKÁLA, Jiří Nečas, Jiří Teplý, Jiří Vašíček, Josef Bartko, Kateřina Novotná, Kochut Yurii, Kovalchuk O., Kryvoruchko Daria, Kurcius David, Máca Filip, Martin Mazánek, Martin Vlček, Merzliakov O., Mika Dominik, Miroslav Havlík, Miroslav Kónya, Mrhal Aleš, Müller Jan, Mykhailchuk M., Nováček M., Pacelt Jakub, Pavelka Vojtěch, Petrus Oleksandr, Popelář Hynek, Pukančík Ota, Robert Trapl, Sebastian Čermák, SIDEI BOGDAN, Simona Pyttlová, Sivák David, Sivák R., Sovadina Václav, Šándor Milan, Tomáš Bartoš, TONDA HORÁK, Velat Petr, VITALII SAVCHENKO, Vít Varga, Vojtěch Hodl, Zamrii, Serhiievych, Pitec S.

Vrať VÝHRADNĚ validní JSON objekt ve tvaru {"operators": [...]}, kde každý prvek obsahuje:
{
  "name": "Celé Jméno a Příjmení",
  "machineType": "LL" | "RTR" | "NONE",
  "departmentId": "hovc" | "hovs" | "putaway" | "vas" | "obwf" | "vna" | "obwi" | "unassigned",
  "notes": "volitelná poznámka (např. V47, směna 10:00-18:00 apod.)"
}`;

export type ExtractedOperator = {
  name: string;
  machineType: "LL" | "RTR" | "NONE";
  departmentId: string;
  notes?: string;
};

function parseTextFallback(textInput: string): ExtractedOperator[] {
  return textInput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const parts = line.split(/[\t;,]/).map((p) => p.trim());
      const name = parts[0] || "Neznámý";
      const notes = parts.slice(1).join(" | ");
      const isRTR = notes.toUpperCase().includes("RTR") || notes.toUpperCase().includes("RETRAK");
      const isVNA = notes.toUpperCase().includes("VNA");
      const machineType = isRTR || isVNA ? "RTR" : "LL";
      let departmentId = "unassigned";
      if (notes.toUpperCase().includes("HOVC")) departmentId = "hovc";
      if (notes.toUpperCase().includes("HOVS")) departmentId = "hovs";
      if (notes.toUpperCase().includes("VAS")) departmentId = "vas";
      if (notes.toUpperCase().includes("PUTAWAY") || notes.toUpperCase().includes("ZASKLADNENI"))
        departmentId = "putaway";
      if (notes.toUpperCase().includes("OBWF") || notes.toUpperCase().includes("WATERFRONT"))
        departmentId = "obwf";
      if (isVNA) departmentId = "vna";
      if (notes.toUpperCase().includes("OBWI") || notes.toUpperCase().includes("WEB"))
        departmentId = "obwi";

      return {
        name: name.slice(0, 50),
        machineType,
        departmentId,
        notes: notes.slice(0, 100),
      };
    });
}

function normalize(list: unknown): ExtractedOperator[] {
  if (!Array.isArray(list)) return [];
  return list
    .map((raw) => {
      const op = raw as Record<string, unknown>;
      const name = typeof op["name"] === "string" ? op["name"].trim() : "";
      const machine = String(op["machineType"] ?? "LL").toUpperCase();
      return {
        name,
        machineType: (machine === "RTR" ? "RTR" : machine === "NONE" ? "NONE" : "LL") as
          "LL" | "RTR" | "NONE",
        departmentId: typeof op["departmentId"] === "string" ? op["departmentId"] : "hovc",
        notes: typeof op["notes"] === "string" ? op["notes"] : undefined,
      };
    })
    .filter((op) => op.name.length > 1);
}

export const extractOperatorsFn = createServerFn({ method: "POST" })
  .validator((d: { imageBase64?: string; mimeType?: string; textInput?: string }) => d)
  .handler(async ({ data }) => {
    const { imageBase64, mimeType = "image/jpeg", textInput } = data;

    if (!imageBase64 && !textInput) {
      throw new Error("Nebyly poskytnuty žádné obrazové ani textové údaje.");
    }

    const geminiKey = process.env["GEMINI_API_KEY"];

    if (!geminiKey) {
      if (textInput) {
        return { operators: parseTextFallback(textInput) };
      }
      throw new Error("V prostředí chybí proměnná GEMINI_API_KEY. Přidejte si do administrace Netlify (Site configuration -> Environment variables) klíč GEMINI_API_KEY.");
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    const parts: Array<Record<string, unknown>> = [
      { text: `${EXTRACTION_PROMPT}\nVytáhni všechny operátory z přiloženého materiálu. Vrať striktně JSON objekt {"operators": [...]}.` }
    ];

    if (imageBase64) {
      const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, "");
      parts.push({
        inline_data: {
          mime_type: mimeType,
          data: cleanBase64
        }
      });
    }

    if (textInput) {
      parts.push({ text: `Zdrojový text:\n${textInput}` });
    }

    let operators: ExtractedOperator[] = [];

    // Active free-tier Gemini models with vision capabilities
    const modelsToTry = [
      "gemini-3.6-flash",
      "gemini-flash-latest",
      "gemini-3.8-flash",
      "gemini-3.1-flash-lite",
    ];
    let lastError: Error | null = null;

    for (const model of modelsToTry) {
      try {
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
        });

        if (!aiResponse.ok) {
          const detail = await aiResponse.text();
          console.warn(`Gemini model ${model} returned ${aiResponse.status}:`, detail);

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
            throw new Error("Zadaný GEMINI_API_KEY není platný. Zkontrolujte prosím svůj klíč v Google AI Studio.");
          }
          if (aiResponse.status === 429) {
            throw new Error("Byl překročen limit požadavků na Gemini API (429 Rate limit). Zkuste to prosím za chvíli.");
          }

          lastError = new Error(parsedErrorMessage);
          continue; // Try next fallback model
        }

        const payload = (await aiResponse.json()) as any;
        const content = payload.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";

        const parsed = JSON.parse(
          content
            .replace(/```json/g, "")
            .replace(/```/g, "")
            .trim(),
        );
        const extracted = normalize(Array.isArray(parsed) ? parsed : parsed?.operators);
        if (extracted.length > 0) {
          operators = extracted;
          break; // Successfully extracted
        }
      } catch (err: any) {
        console.warn(`Attempt with ${model} failed:`, err);
        lastError = err instanceof Error ? err : new Error(String(err));
        // If it's a definitive credential or rate limit error, don't keep polling 404s
        if (lastError.message.includes("GEMINI_API_KEY") || lastError.message.includes("Rate limit")) {
          break;
        }
      }
    }

    if (operators.length === 0) {
      if (textInput) {
        operators = parseTextFallback(textInput);
      } else if (lastError) {
        throw new Error(
          lastError.message || "Při zpracování snímku došlo k chybě. Zkuste to prosím znovu nebo vyfoťte tabuli z menší vzdálenosti.",
        );
      }
    }

    if (operators.length === 0 && textInput) {
      operators = parseTextFallback(textInput);
    }

    return { operators };
  });
