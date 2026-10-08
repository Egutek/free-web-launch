import { describe, expect, it } from 'vitest';
import { calculateOCRMetrics } from './metrics';
import { sanitizeEmployeeCandidate } from '../lib/validation';

describe('ocr diagnostics', () => {
  it('calculates magnet and confidence metrics from detections', () => {
    const metrics = calculateOCRMetrics(
      [
        { name: 'NOVÁK JAN', area: 'TRANSPORT', raw: 'NOVAK JAN', confidence: 0.97, matched: 'NOVÁK JAN', reviewStatus: 'confirmed' },
        { name: 'SVOBODA PETR', area: 'OUTBOUND', raw: 'SVOBODA PETR', confidence: 0.72, matched: 'SVOBODA PETR', reviewStatus: 'questionable' },
      ],
      [
        { raw: 'NOVAK JAN', area: 'TRANSPORT', confidence: 0.97 },
        { raw: 'BOARD NOTE', area: 'OUTBOUND', confidence: 0.2, warning: 'low' },
      ]
    );

    expect(metrics.magnetCount).toBe(2);
    expect(metrics.assignedCount).toBe(2);
    expect(metrics.unmatchedCount).toBe(0);
    expect(metrics.averageConfidence).toBe(0.58);
    expect(metrics.lowConfidenceCount).toBeGreaterThanOrEqual(1);
  });

  it('rejects non-employee text and accepts valid name-like strings', () => {
    expect(sanitizeEmployeeCandidate('BOARD NOTE')).toBeNull();
    expect(sanitizeEmployeeCandidate('NOVÁK JAN')).toBe('NOVÁK JAN');
    expect(sanitizeEmployeeCandidate('SVOBODA PETR')).toBe('SVOBODA PETR');
    expect(sanitizeEmployeeCandidate('A')).toBeNull();
  });
});
