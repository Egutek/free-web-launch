import { c as createServerFn, i as TSS_SERVER_FUNCTION } from "./createServerFn-CIHAFgYl.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/aiServerFn-CsZj24ml.js
var createServerRpc = (serverFnMeta, splitImportFn) => {
	const url = "/_serverFn/" + serverFnMeta.id;
	return Object.assign(splitImportFn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
var EXTRACTION_PROMPT = `Jsi špičkový expert na počítačové vidění (OCR) a čtení rukopisu pro logistické centrum ZF Aftermarket v Ostrově.
Tvým úkolem je z poskytnuté fotografie (bílá magnetická tabule, rozpis směn, papírová docházka, nástěnka, monitor) nebo textu pečlivě a bezchybně vytáhnout VŠECHNY přítomné operátory a přiřadit je k jejich oddělením a strojům.

POSTUP PŘI ČTENÍ FOTOGRAFIE BÍLÉ TABULE:
1. Projdi detailně každý sloupec, rámeček a magnetickou lištu na tabuli zleva doprava a shora dolů.
2. Přečti jména na magnetických štítcích, lístcích i psaná fixem (i když jsou napsaná tiskacím, psacím, zkratkou nebo hůře čitelným písmem).
3. Přečti i volně připsaná jména v dolní části tabule, v poznámkách nebo po stranách (např. "PITEC S. - LL", "ZAMRII - LL", "SERHIIEVYCH - LL", "Savchenko Ihor" atd.).
4. Pokud je u jména kód vozíku / pozice (např. "V47 Burget David", "V107 Andrii Gurkot", "V13 ...", "V01 ..."), vytáhni celé jméno a kód vozíku můžeš dát do poznámky.

PŘIŘAZENÍ K ODDĚLENÍM (departmentId):
- 'hovc': Sloupce "OUTBOUND", "HOVC", "Expedice", "Balení", "Vstupní/Obalové centrum"
- 'obwi': Sloupce "OBWI", "Outbound Web", "International", "Expedice Web"
- 'vna': Sloupce "VNAS", "VNAC", "VNA", "Úzké uličky", vozíky V... s vysokozdvižným zakládáním
- 'hovs': Sloupce "HOVS", "HOVS/ML", "Konsolidace", "Regály"
- 'putaway': Sloupce "PUTAWAY", "Zaskladnění", "Zaskladnovani"
- 'vas': Sloupce "VAS", "Přebal", "Speciální balení"
- 'obwf': Sloupce "OBWF", "Outbound Waterfront", "HAZMAT", "Waterfront"
- 'unassigned': Sekce "TRÉNINK", "ABSENCE", "DOVOLENÁ", "PN", volné poznámky bez určení sekce, nebo pokud oddělení nelze určit

PRAVIDLA PRO STROJE A KVALIFIKACE (machineType):
- 'NONE': Pro oddělení VNA ('vna') a Nepřítomnost / Nezařazeno ('unassigned') VŽDY nastav 'NONE'! U VNA se automaticky počítá, že jsou na VNA a nepřiřazuje se jim LL ani RTR.
- 'RTR': Pro Outbound / HOVC ('hovc') a OBWI ('obwi') VŽDY AUTOMATICKY PŘIŘAĎ 'RTR'! Může se stát, že tam bude výjimečně někdo s LL – POUZE pokud je u jména výslovně napsáno "LL", "LL:", "(LL)" nebo "nízkozdvih", přiřaď 'LL', jinak VŽDY přiřaď 'RTR'.
  Pro HOVS ('hovs') rovněž automaticky přiřaď 'RTR' (pokud není výslovně uvedeno LL).
- 'LL': Pro Putaway ('putaway') nastav 'LL' (pokud není výslovně uveden RTR/Retrak), nebo pokud je u pracovníka výslovně napsáno LL.

REFERENČNÍ SEZNAM PRACOVNÍKŮ ZF OSTROV (využij k přesnému doplnění a opravě překlepů z rukopisu):
Andrii Gurkot, Barnóky Roman, Bereš Zbyněk, Bogár Alexander, BOHDAN BAIOV, Burget David, Červeňák Michael, Daduč Imrich, Daniel Šír, DAVID SVOBODA, DEMIANETS D., Faber Dominik, Fiala Ladislav, Gajdoš Slavomír, Györke Ladislav, Halimov Oleh, Havel Zdeněk, Hemzáček Lukáš, Horváth Valentin, Hosszu Radek, Hřava Dominik, Chrastina Atilla, IHOR Pozniak, IHOR Savchenko, JAKUB PFREIMER, JAKUB SKÁLA, Jiří Nečas, Jiří Teplý, Jiří Vašíček, Josef Bartko, Kateřina Novotná, Kochut Yurii, Kovalchuk O., Kryvoruchko Daria, Kurcius David, Máca Filip, Martin Mazánek, Martin Vlček, Merzliakov O., Mika Dominik, Miroslav Havlík, Miroslav Kónya, Mrhal Aleš, Müller Jan, Mykhailchuk M., Nováček M., Pacelt Jakub, Pavelka Vojtěch, Petrus Oleksandr, Popelář Hynek, Pukančík Ota, Robert Trapl, Sebastian Čermák, SIDEI BOGDAN, Simona Pyttlová, Sivák David, Sivák R., Sovadina Václav, Šándor Milan, Tomáš Bartoš, TONDA HORÁK, Velat Petr, VITALII SAVCHENKO, Vít Varga, Vojtěch Hodl, Zamrii, Serhiievych, Pitec S.

Vrať VÝHRADNĚ validní JSON objekt ve tvaru {"operators": [...]}, kde každý prvek obsahuje:
{
  "name": "Celé Jméno a Příjmení",
  "machineType": "RTR" | "LL" | "NONE",
  "departmentId": "hovc" | "obwi" | "vna" | "hovs" | "putaway" | "vas" | "obwf" | "unassigned",
  "notes": "volitelná poznámka (např. V47, směna 10:00-18:00 apod.)"
}`;
function parseTextFallback(textInput) {
	return textInput.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0).map((line) => {
		const parts = line.split(/[\t;,]/).map((p) => p.trim());
		const name = parts[0] || "Neznámý";
		const notes = parts.slice(1).join(" | ");
		const upperLine = `${name} ${notes}`.toUpperCase();
		const hasExplicitLL = upperLine.includes(" LL") || upperLine.includes("(LL)") || upperLine.includes("-LL") || upperLine.includes("NÍZKOZDVIH");
		const hasExplicitRTR = upperLine.includes("RTR") || upperLine.includes("RETRAK");
		const isVNA = upperLine.includes("VNA") || upperLine.includes("ULIČK");
		let departmentId = "unassigned";
		if (upperLine.includes("HOVC") || upperLine.includes("OUTBOUND") || upperLine.includes("EXPEDICE") || upperLine.includes("BALENI")) departmentId = "hovc";
		else if (upperLine.includes("HOVS") || upperLine.includes("REGALY")) departmentId = "hovs";
		else if (upperLine.includes("VAS") || upperLine.includes("PREBAL")) departmentId = "vas";
		else if (upperLine.includes("PUTAWAY") || upperLine.includes("ZASKLADNENI") || upperLine.includes("PUT")) departmentId = "putaway";
		else if (upperLine.includes("OBWF") || upperLine.includes("WATERFRONT")) departmentId = "obwf";
		else if (isVNA) departmentId = "vna";
		else if (upperLine.includes("OBWI") || upperLine.includes("WEB")) departmentId = "obwi";
		let machineType = "LL";
		if (departmentId === "vna" || departmentId === "unassigned") machineType = "NONE";
		else if (departmentId === "hovc" || departmentId === "obwi" || departmentId === "hovs") machineType = hasExplicitLL ? "LL" : "RTR";
		else if (departmentId === "putaway") machineType = hasExplicitRTR ? "RTR" : "LL";
		else if (departmentId === "vas") machineType = hasExplicitRTR ? "RTR" : hasExplicitLL ? "LL" : "NONE";
		else machineType = hasExplicitRTR ? "RTR" : "LL";
		return {
			name: name.slice(0, 50),
			machineType,
			departmentId,
			notes: notes.slice(0, 100)
		};
	});
}
function normalize(list) {
	if (!Array.isArray(list)) return [];
	return list.map((raw) => {
		const op = raw;
		const name = typeof op["name"] === "string" ? op["name"].trim() : "";
		const dept = typeof op["departmentId"] === "string" ? op["departmentId"].toLowerCase() : "hovc";
		const notes = typeof op["notes"] === "string" ? op["notes"] : void 0;
		const combinedUpper = `${name} ${notes || ""}`.toUpperCase();
		const hasExplicitLL = combinedUpper.includes(" LL") || combinedUpper.includes("(LL)") || combinedUpper.includes("-LL") || combinedUpper.includes("NÍZKOZDVIH");
		const hasExplicitRTR = combinedUpper.includes("RTR") || combinedUpper.includes("RETRAK");
		let machineType = "LL";
		if (dept === "vna" || dept === "unassigned") machineType = "NONE";
		else if (dept === "hovc" || dept === "obwi" || dept === "hovs") machineType = hasExplicitLL ? "LL" : "RTR";
		else if (dept === "putaway") machineType = hasExplicitRTR ? "RTR" : "LL";
		else {
			const rawMachine = String(op["machineType"] ?? "").toUpperCase();
			machineType = rawMachine === "RTR" ? "RTR" : rawMachine === "NONE" ? "NONE" : "LL";
		}
		return {
			name,
			machineType,
			departmentId: dept,
			notes
		};
	}).filter((op) => op.name.length > 1);
}
var extractOperatorsFn_createServerFn_handler = createServerRpc({
	id: "ab76cd8d0cf55eac356d439e746cc2fb9137abacbe0deee6302ba943a04b46b9",
	name: "extractOperatorsFn",
	filename: "src/app/services/aiServerFn.ts"
}, (opts) => extractOperatorsFn.__executeServer(opts));
var extractOperatorsFn = createServerFn({ method: "POST" }).validator((d) => d).handler(extractOperatorsFn_createServerFn_handler, async ({ data }) => {
	const { imageBase64, mimeType = "image/jpeg", textInput } = data;
	if (!imageBase64 && !textInput) throw new Error("Nebyly poskytnuty žádné obrazové ani textové údaje.");
	const geminiKey = process.env["GEMINI_API_KEY"];
	if (!geminiKey) {
		if (textInput) return { operators: parseTextFallback(textInput) };
		throw new Error("V prostředí chybí proměnná GEMINI_API_KEY. Přidejte si do administrace Netlify (Site configuration -> Environment variables) klíč GEMINI_API_KEY.");
	}
	const headers = { "Content-Type": "application/json" };
	const parts = [{ text: `${EXTRACTION_PROMPT}\nVytáhni všechny operátory z přiloženého materiálu. Vrať striktně JSON objekt {"operators": [...]}.` }];
	if (imageBase64) {
		const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, "");
		parts.push({ inline_data: {
			mime_type: mimeType,
			data: cleanBase64
		} });
	}
	if (textInput) parts.push({ text: `Zdrojový text:\n${textInput}` });
	let operators = [];
	const modelsToTry = [
		"gemini-3.6-flash",
		"gemini-flash-latest",
		"gemini-3.8-flash",
		"gemini-3.1-flash-lite"
	];
	let lastError = null;
	for (const model of modelsToTry) try {
		const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
		const aiResponse = await fetch(apiUrl, {
			method: "POST",
			headers,
			body: JSON.stringify({
				contents: [{ parts }],
				generationConfig: {
					responseMimeType: "application/json",
					temperature: .1
				}
			})
		});
		if (!aiResponse.ok) {
			const detail = await aiResponse.text();
			console.warn(`Gemini model ${model} returned ${aiResponse.status}:`, detail);
			let parsedErrorMessage = `Chyba modelu ${model} (${aiResponse.status})`;
			try {
				const errObj = JSON.parse(detail);
				if (errObj?.error?.message) parsedErrorMessage = errObj.error.message;
			} catch {}
			if (aiResponse.status === 400 && detail.includes("API key not valid")) throw new Error("Zadaný GEMINI_API_KEY není platný. Zkontrolujte prosím svůj klíč v Google AI Studio.");
			if (aiResponse.status === 429) throw new Error("Byl překročen limit požadavků na Gemini API (429 Rate limit). Zkuste to prosím za chvíli.");
			lastError = new Error(parsedErrorMessage);
			continue;
		}
		const content = (await aiResponse.json()).candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
		const parsed = JSON.parse(content.replace(/```json/g, "").replace(/```/g, "").trim());
		const extracted = normalize(Array.isArray(parsed) ? parsed : parsed?.operators);
		if (extracted.length > 0) {
			operators = extracted;
			break;
		}
	} catch (err) {
		console.warn(`Attempt with ${model} failed:`, err);
		lastError = err instanceof Error ? err : new Error(String(err));
		if (lastError.message.includes("GEMINI_API_KEY") || lastError.message.includes("Rate limit")) break;
	}
	if (operators.length === 0) {
		if (textInput) operators = parseTextFallback(textInput);
		else if (lastError) throw new Error(lastError.message || "Při zpracování snímku došlo k chybě. Zkuste to prosím znovu nebo vyfoťte tabuli z menší vzdálenosti.");
	}
	if (operators.length === 0 && textInput) operators = parseTextFallback(textInput);
	return { operators };
});
//#endregion
export { extractOperatorsFn_createServerFn_handler };
