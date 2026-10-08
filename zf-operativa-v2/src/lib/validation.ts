import type { Area, Detection } from '../types';
import { combineConfidences } from './confidence';

export function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseRoster(raw: string): { names: string[]; duplicates: string[] } {
  const names: string[] = [];
  const seen = new Map<string, string>();
  const duplicateNames: string[] = [];
  raw.split(/[\r\n,;]+/).forEach((value) => {
    const name = sanitizeEmployeeCandidate(value);
    if (!name) return;
    const key = normalizeName(name);
    if (seen.has(key)) {
      const first = seen.get(key)!;
      if (!duplicateNames.includes(first)) duplicateNames.push(first);
      return;
    }
    seen.set(key, name);
    names.push(name);
  });
  return { names, duplicates: duplicateNames };
}

function editDistance(left: string, right: string): number {
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  let current = new Array<number>(right.length + 1);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    current[0] = leftIndex;
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      current[rightIndex] = Math.min(
        previous[rightIndex] + 1,
        current[rightIndex - 1] + 1,
        previous[rightIndex - 1] + substitutionCost
      );
    }
    [previous, current] = [current, previous];
  }

  return previous[right.length];
}

export function sanitizeEmployeeCandidate(raw: string): string | null {
  const candidate = raw?.trim();
  if (!candidate) return null;

  const cleaned = candidate
    .replace(/[^A-Za-zÁČĎÉĚÍŇÓŘŠŤÚŮÝŽáčďéěíňóřšťúůýž\s\-']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length < 3 || /\d/.test(cleaned)) return null;
  if (/(^|\s)(BOARD|NOTE|NOTES|TABULE|HAND|WRITE|TEXT|PODPIS|SIGNATURE|DOPLNEK|KOREKCE)(\s|$)/i.test(cleaned)) return null;
  if (cleaned.split(/\s+/).length < 2) return null;
  return cleaned;
}

export function validate(raw: string, roster: string[], confidence: number, area: Area): Detection {
  const cleaned = sanitizeEmployeeCandidate(raw) ?? raw.trim();
  const normalizedCandidate = normalizeName(cleaned);
  const normalizedRoster = roster
    .map((name) => ({ name, normalized: normalizeName(name) }))
    .filter((item) => item.normalized.length > 0);

  let bestName: string | undefined;
  let bestScore = 0;
  for (const candidate of normalizedRoster) {
    const score = 1 - editDistance(normalizedCandidate, candidate.normalized) /
      Math.max(normalizedCandidate.length, candidate.normalized.length, 1);
    if (score > bestScore) {
      bestName = candidate.name;
      bestScore = score;
    }
  }

  const safeOCRConfidence = Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0;
  const matched = bestName && bestScore >= 0.72 ? bestName : undefined;
  const warnings: string[] = [];
  if (!matched) warnings.push('Jméno se nepodařilo bezpečně spárovat');
  if (safeOCRConfidence < 0.85) warnings.push('Nízká jistota OCR');

  return {
    raw: cleaned,
    matched,
    area,
    ocrConfidence: safeOCRConfidence,
    matchConfidence: bestScore,
    confidence: combineConfidences(safeOCRConfidence, bestScore),
    warning: warnings.length ? warnings.join('; ') : undefined,
  };
}

export function duplicates(items: Detection[]): string[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    if (item.matched) {
      const key = normalizeName(item.matched);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return [...counts].filter(([, count]) => count > 1).map(([key]) => items.find((item) => item.matched && normalizeName(item.matched) === key)?.matched ?? key);
}
