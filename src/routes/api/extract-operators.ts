import { createFileRoute } from "@tanstack/react-router";

const EXTRACTION_PROMPT = `
Jsi asistent pro vedoucího směny v logistickém centru ZF Aftermarket v Ostrově.
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
Poznámka: oddělení "hovc" odpovídá sekci "Outbound" / expedice a balení. Pokud operátor nemá uveden stroj LL ani RTR, nastav "machineType": "NONE".
`;

type ExtractedOperator = {
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
      const lower = line.toLowerCase();
      const machineType: ExtractedOperator["machineType"] = lower.includes("rtr")
        ? "RTR"
        : lower.includes("ll")
          ? "LL"
          : "NONE";

      let departmentId = "hovc";
      if (lower.includes("hovs")) departmentId = "hovs";
      else if (lower.includes("put") || lower.includes("zasklad")) departmentId = "putaway";
      else if (lower.includes("vas")) departmentId = "vas";
      else if (lower.includes("obwf")) departmentId = "obwf";
      else if (lower.includes("vna")) departmentId = "vna";
      else if (lower.includes("obwi")) departmentId = "obwi";
      else if (lower.includes("hovc")) departmentId = "hovc";

      const name = line
        .replace(/\b(LL|RTR|HOVC|HOVS|VAS|OBWF|OBWI|VNA|PUTAWAY)\b/gi, "")
        .replace(/[-–|;,]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      return { name: name || line, machineType, departmentId, notes: "Ruční textový vstup" };
    })
    .filter((op) => op.name.length > 1);
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

export const Route = createFileRoute("/api/extract-operators")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => ({}))) as {
          imageBase64?: string;
          mimeType?: string;
          textInput?: string;
        };
        const { imageBase64, mimeType = "image/jpeg", textInput } = body;

        if (!imageBase64 && !textInput) {
          return Response.json(
            { error: "Nebyly poskytnuty žádné obrazové ani textové údaje." },
            { status: 400 },
          );
        }

        const geminiKey = process.env["GEMINI_API_KEY"];
        const lovableKey = process.env["LOVABLE_API_KEY"];

        if (geminiKey) {
          try {
            const parts: Array<Record<string, unknown>> = [
              {
                text: `${EXTRACTION_PROMPT}\nVytáhni všechny operátory z přiloženého materiálu. Vrať striktně JSON objekt {"operators": [...]}.`,
              },
            ];
            if (imageBase64) {
              const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, "");
              parts.push({
                inlineData: {
                  mimeType,
                  data: cleanBase64,
                },
              });
            }
            if (textInput) {
              parts.push({ text: `Zdrojový text:\n${textInput}` });
            }

            const geminiRes = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  contents: [{ parts }],
                  generationConfig: {
                    responseMimeType: "application/json",
                  },
                }),
              },
            );

            if (geminiRes.ok) {
              const payload = (await geminiRes.json()) as {
                candidates?: Array<{
                  content?: { parts?: Array<{ text?: string }> };
                }>;
              };
              const content = payload.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
              const parsed = JSON.parse(
                content
                  .replace(/```json/g, "")
                  .replace(/```/g, "")
                  .trim(),
              );
              const ops = normalize(Array.isArray(parsed) ? parsed : parsed?.operators);
              if (ops.length > 0) {
                return Response.json({ operators: ops });
              }
            }
          } catch (e) {
            console.error("Gemini extraction error:", e);
          }
        }

        if (!lovableKey) {
          if (textInput) {
            return Response.json({ operators: parseTextFallback(textInput) });
          }
          return Response.json(
            {
              error: "Rozpoznávání z fotky není momentálně dostupné. Zadejte prosím jména textem.",
            },
            { status: 503 },
          );
        }

        const userContent: Array<Record<string, unknown>> = [
          {
            type: "text",
            text: `${EXTRACTION_PROMPT}\nVytáhni všechny operátory z přiloženého materiálu. Vrať striktně JSON objekt {"operators": [...]}.`,
          },
        ];
        if (imageBase64) {
          const dataUrl = imageBase64.startsWith("data:")
            ? imageBase64
            : `data:${mimeType};base64,${imageBase64}`;
          userContent.push({ type: "image_url", image_url: { url: dataUrl } });
        }
        if (textInput) {
          userContent.push({ type: "text", text: `Zdrojový text:\n${textInput}` });
        }

        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Lovable-API-Key": apiKey,
            "X-Lovable-AIG-SDK": "fetch",
          },
          body: JSON.stringify({
            model: "google/gemini-3.8-flash",
            messages: [{ role: "user", content: userContent }],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "operators",
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
                          machineType: { type: "string", enum: ["LL", "RTR", "NONE"] },
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
          console.error("AI gateway error", aiResponse.status, detail);
          if (textInput) {
            return Response.json({ operators: parseTextFallback(textInput) });
          }
          const message =
            aiResponse.status === 429
              ? "Rozpoznávání je momentálně zahlcené, zkuste to prosím za chvíli znovu."
              : aiResponse.status === 402
                ? "Vyčerpaný kredit pro rozpoznávání z fotky. Zadejte prosím jména textem."
                : "Rozpoznávání z fotky se nezdařilo. Zkuste to znovu, nebo zadejte jména textem.";
          return Response.json({ error: message }, { status: aiResponse.status });
        }

        const payload = (await aiResponse.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const content = payload.choices?.[0]?.message?.content ?? "{}";
        let operators: ExtractedOperator[] = [];
        try {
          const parsed = JSON.parse(
            content
              .replace(/```json/g, "")
              .replace(/```/g, "")
              .trim(),
          );
          operators = normalize(Array.isArray(parsed) ? parsed : parsed?.operators);
        } catch (error) {
          console.error("Nepodařilo se přečíst odpověď AI", error);
        }

        if (operators.length === 0 && textInput) {
          operators = parseTextFallback(textInput);
        }

        return Response.json({ operators });
      },
    },
  },
});
