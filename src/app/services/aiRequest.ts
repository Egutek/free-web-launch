function retryDelay(response: Response, attempt: number, now: number): number {
  const value = response.headers.get("retry-after")?.trim();
  if (value) {
    const seconds = Number(value);
    const delay = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(value) - now;
    if (Number.isFinite(delay) && delay >= 0) return Math.max(1000, delay);
  }
  return 5000 * 2 ** attempt;
}

function isQuotaError(detail: string): boolean {
  return /insufficient_quota|quota_exceeded|billing_hard_limit|credit.?balance|(?:credit|budget|billing).{0,60}(?:exhaust|exceed|insufficient)|(?:exhaust|insufficient).{0,60}credit|exceeded your current quota/i.test(detail);
}

// Bound all attempts to leave time for parsing and returning from the server function.
export async function requestAI(
  url: string,
  init: RequestInit,
  dependencies = {
    fetch: globalThis.fetch,
    now: Date.now,
    sleep: (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
  },
): Promise<Response> {
  const deadline = dependencies.now() + 45_000;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const remaining = deadline - dependencies.now();
    if (remaining <= 0) break;
    let response: Response;
    try {
      response = await dependencies.fetch(url, {
        ...init,
        signal: AbortSignal.timeout(remaining),
      });
    } catch {
      throw new Error("AI služba neodpovídá včas. Zkuste to prosím za chvíli znovu, nebo vložte jména textem.");
    }
    if (response.ok) return response;

    // Read provider details only for classification; never expose them or uploaded data in logs.
    const detail = await response.text();
    if (response.status === 402 || isQuotaError(detail)) {
      throw new Error("AI služba má vyčerpaný kredit nebo kvótu. Správce musí zkontrolovat čerpání a fakturaci AI služby. Do té doby vložte jména textem.");
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error("AI služba nemá platné přístupové údaje nebo oprávnění. Správce musí zkontrolovat její nastavení. Jména můžete vložit textem.");
    }
    const temporary = [429, 502, 503, 504].includes(response.status);
    if (!temporary) {
      console.error("AI gateway error:", response.status);
      throw new Error("Rozpoznávání z fotky se nezdařilo. Zkuste to znovu, nebo vložte jména textem.");
    }
    const delay = retryDelay(response, attempt, dependencies.now());
    if (attempt === 2 || dependencies.now() + delay + 5000 >= deadline) {
      const seconds = Math.ceil(Math.max(delay, 60_000) / 1000);
      throw new Error(`AI služba je dočasně vytížená. Zkuste to znovu nejdříve za ${seconds} sekund, nebo vložte jména textem.`);
    }
    await dependencies.sleep(delay);
  }
  throw new Error("Rozpoznávání trvá příliš dlouho. Zkuste to za chvíli znovu, nebo vložte jména textem.");
}
