import { describe, expect, it } from 'vitest';
import {
  ConfidenceLevel,
  boostConfidence,
  combineConfidences,
  getConfidenceLevel,
  meetsMinimumConfidence,
} from './confidence';

describe('confidence helpers', () => {
  it('classifies confidence values into HIGH, MEDIUM, and LOW buckets', () => {
    expect(getConfidenceLevel(1)).toBe(ConfidenceLevel.HIGH);
    expect(getConfidenceLevel(0.9)).toBe(ConfidenceLevel.MEDIUM);
    expect(getConfidenceLevel(0.75)).toBe(ConfidenceLevel.LOW);
  });

  it('checks minimum confidence thresholds correctly', () => {
    expect(meetsMinimumConfidence(0.95, ConfidenceLevel.HIGH)).toBe(true);
    expect(meetsMinimumConfidence(0.94, ConfidenceLevel.HIGH)).toBe(false);
    expect(meetsMinimumConfidence(0.8, ConfidenceLevel.MEDIUM)).toBe(true);
    expect(meetsMinimumConfidence(0.79, ConfidenceLevel.MEDIUM)).toBe(false);
    expect(meetsMinimumConfidence(0.2, ConfidenceLevel.LOW)).toBe(true);
  });

  it('combines multiple confidence scores conservatively', () => {
    expect(combineConfidences(0.9, 0.9)).toBeCloseTo(Math.sqrt(0.81), 10);
    expect(combineConfidences(0.5, 0.5, 0.5)).toBeCloseTo(0.5, 10);
    expect(combineConfidences()).toBe(0);
  });

  it('applies contextual boosts without exceeding 1.0', () => {
    expect(boostConfidence(0.5, { exactMatch: true })).toBeCloseTo(0.55, 10);
    expect(boostConfidence(0.9, { exactMatch: true, consistentPlacement: true })).toBe(1);
    expect(boostConfidence(0.99, { highContrast: true })).toBe(1);
  });
});
