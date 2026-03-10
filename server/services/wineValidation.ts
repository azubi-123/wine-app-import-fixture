/**
 * Wine Validation Service
 * Sprint 5: Validates that a photographed wine matches chapter requirements
 */

import type { Chapter, WineValidationResult, WineRecognitionResult } from "@shared/schema";

interface ChapterRequirements {
  description?: string;
  criteria?: Array<{
    field: string;
    operator: 'in' | 'contains' | 'equals';
    value: string | string[];
  }>;
  anyWine?: boolean; // If true, any wine is acceptable
}

/**
 * Validates a recognized wine against chapter requirements
 *
 * @param wineInfo - The wine recognition result from GPT Vision
 * @param chapter - The chapter with requirements to validate against
 * @returns Validation result with pass/fail and detailed criteria results
 */
export function validateWineForChapter(
  wineInfo: WineRecognitionResult,
  chapter: Chapter
): WineValidationResult {
  // Parse requirements from chapter (stored as JSONB)
  const requirements = (chapter.wineRequirements || {}) as ChapterRequirements;

  // If no requirements or anyWine is true, always pass
  if (!requirements.criteria || requirements.criteria.length === 0 || requirements.anyWine) {
    return {
      passed: true,
      confidence: wineInfo.confidence,
      criteriaResults: [],
      wineInfo
    };
  }

  // Validate each criterion
  const criteriaResults = requirements.criteria.map(criterion => {
    const fieldValue = getWineFieldValue(wineInfo, criterion.field);
    const passed = evaluateCriterion(fieldValue, criterion.operator, criterion.value);

    return {
      field: criterion.field,
      operator: criterion.operator,
      expected: criterion.value,
      actual: fieldValue,
      passed
    };
  });

  // All criteria must pass and confidence must be above threshold
  const allCriteriaPassed = criteriaResults.every(r => r.passed);
  const confidenceThreshold = 0.6; // Lowered from 0.7 since models are better now

  return {
    passed: allCriteriaPassed && wineInfo.confidence >= confidenceThreshold,
    confidence: wineInfo.confidence,
    criteriaResults,
    wineInfo
  };
}

/**
 * Get a field value from wine info, handling nested access
 */
function getWineFieldValue(wineInfo: WineRecognitionResult, field: string): string | null {
  switch (field.toLowerCase()) {
    case 'name':
      return wineInfo.name || null;
    case 'region':
      return wineInfo.region || null;
    case 'grape_variety':
    case 'grapevariety':
    case 'grape_varieties':
    case 'grapevarieties':
      // Join grape varieties into a single string for matching
      return wineInfo.grapeVarieties?.join(', ') || null;
    case 'vintage':
      return wineInfo.vintage?.toString() || null;
    case 'producer':
      return wineInfo.producer || null;
    default:
      // Try direct access
      return (wineInfo as Record<string, any>)[field]?.toString() || null;
  }
}

/**
 * Evaluate a single criterion against a field value
 */
function evaluateCriterion(
  fieldValue: string | null,
  operator: 'in' | 'contains' | 'equals',
  expected: string | string[]
): boolean {
  if (fieldValue === null) {
    return false;
  }

  const normalizedField = fieldValue.toLowerCase().trim();

  switch (operator) {
    case 'in':
      // Field value should match one of the expected values
      if (!Array.isArray(expected)) {
        return normalizedField.includes(expected.toLowerCase());
      }
      return expected.some(v =>
        normalizedField.includes(v.toLowerCase()) ||
        v.toLowerCase().includes(normalizedField)
      );

    case 'contains':
      // Field value should contain the expected string
      const expectedStr = Array.isArray(expected) ? expected[0] : expected;
      return normalizedField.includes(expectedStr.toLowerCase());

    case 'equals':
      // Field value should exactly equal the expected value
      const expectedEqual = Array.isArray(expected) ? expected[0] : expected;
      return normalizedField === expectedEqual.toLowerCase();

    default:
      return false;
  }
}

/**
 * Generate a human-readable validation message
 */
export function getValidationMessage(result: WineValidationResult): string {
  if (result.passed) {
    return `Great choice! This ${result.wineInfo.name} matches the chapter requirements.`;
  }

  // Find the first failing criterion to explain why
  const failedCriterion = result.criteriaResults.find(c => !c.passed);

  if (result.confidence < 0.6) {
    return `We couldn't clearly identify this wine. Please try taking another photo with better lighting.`;
  }

  if (failedCriterion) {
    const fieldName = failedCriterion.field.replace('_', ' ');
    const expectedStr = Array.isArray(failedCriterion.expected)
      ? failedCriterion.expected.join(' or ')
      : failedCriterion.expected;

    return `This wine doesn't match the chapter requirements. Looking for ${fieldName}: ${expectedStr}, but found: ${failedCriterion.actual || 'unknown'}.`;
  }

  return `This wine doesn't match the chapter requirements. Please find a wine that matches the criteria.`;
}
