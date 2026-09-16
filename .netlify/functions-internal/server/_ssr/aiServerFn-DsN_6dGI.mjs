import { c as createServerFn, i as TSS_SERVER_FUNCTION } from "./createServerFn-CIHAFgYl.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/aiServerFn-DsN_6dGI.js
var createServerRpc = (serverFnMeta, splitImportFn) => {
  const url = "/_serverFn/" + serverFnMeta.id;
  return Object.assign(splitImportFn, {
    url,
    serverFnMeta,
    [TSS_SERVER_FUNCTION]: true,
  });
};
var EXTRACTION_PROMPT = `Jsi asistent pro vedoucího směny v logistickém centru ZF Aftermarket v Ostrově.
Tvým úkolem je z poskytnutého snímku (fotka rozpisu směn, papírová docházka, nástěnka, tabulka na monitoru) nebo textu vytáhnout seznam operátorů pro oddělení PICK.

Oddělení PICK se dělí výhradně na tyto pododdělení:
- 'hovc': HOVC (High-bay Obalové / Vstupní centrum)
- 'hovs': HOVS (High-bay Skladové regály & konsolidace)
- 'putaway': Putaway / Zaskladnění
- 'vas': VAS (Value Added Services / speciální balení)
- 'obwf': OBWF (Outbound Waterfront)
- 'vna': VNA (Very Narrow Aisle - úzké uličky)
- 'obwi': OBWI (Outbound Web & International)
- 'unassigned': Pokud oddělení nelze určit

Stroje/Kvalifikace:
- Pouze 'LL' nebo 'RTR'. Pokud není výslovně uvedeno, odhadni z kontextu (např. VNA/HOVS často RTR, běžný pick LL), výchozí je 'LL'.
- ŽÁDNÉ jiné stroje, žádná osobní čísla, žádné směny.

Zde je referenční seznam známých pracovníků skladu v ZF Ostrov (použij pro přesné rozpoznání i z méně čitelných fotek, zkratek a tabulek):
Andrii Gurkot, Barnóky Roman, Bereš Zbyněk, Bogár Alexander, BOHDAN BAIOV, Burget David, Červeňák Michael, Daduč Imrich, Daniel Šír, DAVID SVOBODA, DEMIANETS D., Faber Dominik, Fiala Ladislav, Gajdoš Slavomír, Györke Ladislav, Halimov Oleh, Havel Zdeněk, Hemzáček Lukáš, Horváth Valentin, Hosszu Radek, Hřava Dominik, Chrastina Atilla, IHOR Pozniak, IHOR Savchenko, JAKUB PFREIMER, JAKUB SKÁLA, Jiří Nečas, Jiří Teplý, Jiří Vašíček, Josef Bartko, Kateřina Novotná, Kochut Yurii, Kovalchuk O., Kryvoruchko Daria, Kurcius David, Máca Filip, Martin Mazánek, Martin Vlček, Merzliakov O., Mika Dominik, Miroslav Havlík, Miroslav Kónya, Mrhal Aleš, Müller Jan, Mykhailchuk M., Nováček M., Pacelt Jakub, Pavelka Vojtěch, Petrus Oleksandr, Popelář Hynek, Pukančík Ota, Robert Trapl, Sebastian Čermák, SIDEI BOGDAN, Simona Pyttlová, Sivák David, Sivák R., Sovadina Václav, Šándor Milan, Tomáš Bartoš, TONDA HORÁK, Velat Petr, VITALII SAVCHENKO, Vít Varga, Vojtěch Hodl.

Vrať POUZE validní JSON objekt ve tvaru {"operators": [...]}, kde každý prvek má strukturu:
{
  "name": "Celé Jméno a Příjmení",
  "machineType": "LL" | "RTR" | "NONE",
  "departmentId": "hovc" | "hovs" | "putaway" | "vas" | "obwf" | "vna" | "obwi" | "unassigned",
  "notes": "volitelná krátká poznámka (např. pozice nebo původní údaj z tabulky)"
}
Poznámka: oddělení "hovc" odpovídá sekci "Outbound" / expedice a balení. Pokud operátor nemá uveden stroj LL ani RTR, nastav "machineType": "NONE".`;
function parseTextFallback(textInput) {
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
function normalize(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((raw) => {
      const op = raw;
      const name = typeof op["name"] === "string" ? op["name"].trim() : "";
      const machine = String(op["machineType"] ?? "LL").toUpperCase();
      return {
        name,
        machineType: machine === "RTR" ? "RTR" : machine === "NONE" ? "NONE" : "LL",
        departmentId: typeof op["departmentId"] === "string" ? op["departmentId"] : "hovc",
        notes: typeof op["notes"] === "string" ? op["notes"] : void 0,
      };
    })
    .filter((op) => op.name.length > 1);
}
var extractOperatorsFn_createServerFn_handler = createServerRpc(
  {
    id: "ab76cd8d0cf55eac356d439e746cc2fb9137abacbe0deee6302ba943a04b46b9",
    name: "extractOperatorsFn",
    filename: "src/app/services/aiServerFn.ts",
  },
  (opts) => extractOperatorsFn.__executeServer(opts),
);
var extractOperatorsFn = createServerFn({ method: "POST" })
  .validator((d) => d)
  .handler(extractOperatorsFn_createServerFn_handler, async ({ data }) => {
    const { imageBase64, mimeType = "image/jpeg", textInput } = data;
    if (!imageBase64 && !textInput)
      throw new Error("Nebyly poskytnuty žádné obrazové ani textové údaje.");
    const openaiKey = process.env["OPENAI_API_KEY"];
    const lovableKey = process.env["LOVABLE_API_KEY"];
    if (!(openaiKey || lovableKey)) {
      if (textInput) return { operators: parseTextFallback(textInput) };
      throw new Error("AI služba není dostupná. Zadejte prosím jména textem.");
    }
    const apiUrl = openaiKey
      ? "https://api.openai.com/v1/chat/completions"
      : "https://ai.gateway.lovable.dev/v1/chat/completions";
    const headers = { "Content-Type": "application/json" };
    if (openaiKey) headers["Authorization"] = `Bearer ${openaiKey}`;
    else {
      headers["Lovable-API-Key"] = lovableKey;
      headers["X-Lovable-AIG-SDK"] = "fetch";
    }
    const userContent = [
      {
        type: "text",
        text: `${EXTRACTION_PROMPT}\nVytáhni všechny operátory z přiloženého materiálu. Vrať striktně JSON objekt {"operators": [...]}.`,
      },
    ];
    if (imageBase64) {
      const dataUrl = `data:${mimeType};base64,${imageBase64.replace(/^data:[^;]+;base64,/, "")}`;
      userContent.push({
        type: "image_url",
        image_url: { url: dataUrl },
      });
    }
    if (textInput)
      userContent.push({
        type: "text",
        text: `Zdrojový text:\n${textInput}`,
      });
    let operators = [];
    try {
      const aiResponse = await fetch(apiUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            {
              role: "user",
              content: userContent,
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "operators_schema",
              strict: true,
              schema: {
                type: "object",
                additionalProperties: false,
                required: ["operators"],
                properties: {
                  operators: {
                    type: "array",
                    items: {
                      type: "object",
                      additionalProperties: false,
                      required: ["name", "machineType", "departmentId", "notes"],
                      properties: {
                        name: { type: "string" },
                        machineType: {
                          type: "string",
                          enum: ["LL", "RTR", "NONE"],
                        },
                        departmentId: {
                          type: "string",
                          enum: [
                            "hovc",
                            "hovs",
                            "putaway",
                            "vas",
                            "obwf",
                            "vna",
                            "obwi",
                            "unassigned",
                          ],
                        },
                        notes: { type: ["string", "null"] },
                      },
                    },
                  },
                },
              },
            },
          },
        }),
      });
      if (!aiResponse.ok) {
        const detail = await aiResponse.text();
        console.error("AI gateway error:", aiResponse.status, detail);
        if (textInput) return { operators: parseTextFallback(textInput) };
        const message =
          aiResponse.status === 429
            ? "Rozpoznávání je momentálně zahlcené, zkuste to prosím za chvíli znovu."
            : aiResponse.status === 402 || aiResponse.status === 401
              ? "Chyba ověření nebo vyčerpaný kredit pro AI. Zadejte prosím jména textem."
              : "Rozpoznávání z fotky se nezdařilo (Chyba AI). Zkuste to znovu, nebo zadejte jména textem.";
        throw new Error(message);
      }
      const content = (await aiResponse.json()).choices?.[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(
        content
          .replace(/```json/g, "")
          .replace(/```/g, "")
          .trim(),
      );
      operators = normalize(Array.isArray(parsed) ? parsed : parsed?.operators);
    } catch (error) {
      console.error("AI request or parsing failed:", error);
      if (textInput) operators = parseTextFallback(textInput);
      else
        throw new Error(
          error?.message || "Při zpracování snímku došlo k chybě (výpadek AI služby).",
        );
    }
    if (operators.length === 0 && textInput) operators = parseTextFallback(textInput);
    return { operators };
  });
//#endregion
export { extractOperatorsFn_createServerFn_handler };
