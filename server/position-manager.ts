import { db } from "./db";
import { slides } from "../shared/schema";
import { eq, and, gt, lt, gte, lte, between, ne, asc, desc, sql } from "drizzle-orm";

// Position configuration for each section
export const POSITION_CONFIG = {
  INTRO: { start: 0, end: 10000 },
  DEEP_DIVE: { start: 10000, end: 20000 },
  ENDING: { start: 20000, end: 30000 },
  PACKAGE_GAP: 100000, // Gap between package-level and wine-level slides
  STANDARD_GAP: 1000,  // Standard gap between slides
  MIN_GAP: 0.001,      // Minimum gap before renumbering
  PRECISION: 6         // Decimal precision
};

// Map section types to position ranges
const SECTION_RANGES = {
  'intro': POSITION_CONFIG.INTRO,
  'deep_dive': POSITION_CONFIG.DEEP_DIVE,
  'ending': POSITION_CONFIG.ENDING
} as const;

export type SectionType = keyof typeof SECTION_RANGES;

/**
 * Rounds a position to the configured precision
 */
function roundPosition(position: number): number {
  const factor = Math.pow(10, POSITION_CONFIG.PRECISION);
  return Math.round(position * factor) / factor;
}

/**
 * Gets the position range for a section type
 */
export function getSectionRange(sectionType: SectionType): { start: number; end: number } {
  return SECTION_RANGES[sectionType] || POSITION_CONFIG.INTRO;
}

/**
 * Calculates the midpoint between two positions
 */
export function getPositionBetween(pos1: number, pos2: number): number {
  const midpoint = (pos1 + pos2) / 2;
  return roundPosition(midpoint);
}

/**
 * Finds the nearest free position around a target position
 * @param packageWineId - The wine package ID
 * @param targetPosition - The desired position
 * @param sectionType - The section type to stay within
 * @returns A free position near the target
 */
export async function findNearestFreePosition(
  packageWineId: string,
  targetPosition: number,
  sectionType: SectionType
): Promise<number> {
  const range = getSectionRange(sectionType);
  
  // Ensure target is within section bounds
  targetPosition = Math.max(range.start, Math.min(range.end, targetPosition));
  
  // Check if target position is free
  const existing = await db
    .select()
    .from(slides)
    .where(
      and(
        eq(slides.packageWineId, packageWineId),
        eq(slides.position, targetPosition)
      )
    )
    .limit(1);
  
  if (existing.length === 0) {
    return targetPosition;
  }
  
  // Find slides around the target position
  const [slidesBefore, slidesAfter] = await Promise.all([
    db
      .select()
      .from(slides)
      .where(
        and(
          eq(slides.packageWineId, packageWineId),
          lt(slides.position, targetPosition),
          gte(slides.position, range.start)
        )
      )
      .orderBy(desc(slides.position))
      .limit(1),
    db
      .select()
      .from(slides)
      .where(
        and(
          eq(slides.packageWineId, packageWineId),
          gt(slides.position, targetPosition),
          lte(slides.position, range.end)
        )
      )
      .orderBy(asc(slides.position))
      .limit(1)
  ]);
  
  // Try to find position between target and next slide
  if (slidesAfter.length > 0) {
    const posAfter = slidesAfter[0].position;
    const midpoint = getPositionBetween(targetPosition, posAfter);
    if (midpoint !== targetPosition && midpoint !== posAfter) {
      return midpoint;
    }
  }
  
  // Try to find position between previous and target
  if (slidesBefore.length > 0) {
    const posBefore = slidesBefore[0].position;
    const midpoint = getPositionBetween(posBefore, targetPosition);
    if (midpoint !== posBefore && midpoint !== targetPosition) {
      return midpoint;
    }
  }
  
  // If we can't find a good position between existing slides,
  // find the next available position by incrementing
  let increment = 0.1;
  let attempts = 0;
  const maxAttempts = 100;
  
  while (attempts < maxAttempts) {
    const testPos = roundPosition(targetPosition + increment);
    
    // Check if this position is within bounds and free
    if (testPos <= range.end) {
      const conflict = await db
        .select()
        .from(slides)
        .where(
          and(
            eq(slides.packageWineId, packageWineId),
            eq(slides.position, testPos)
          )
        )
        .limit(1);
      
      if (conflict.length === 0) {
        return testPos;
      }
    }
    
    // Try negative increment if we haven't yet
    if (increment > 0) {
      increment = -increment;
    } else {
      // Increase magnitude and go positive again
      increment = Math.abs(increment) + 0.1;
    }
    
    attempts++;
  }
  
  // If all else fails, renumber the section
  throw new Error('Unable to find free position. Section renumbering required.');
}

/**
 * Checks if a section needs renumbering due to small gaps
 */
export async function shouldRenumberSection(
  packageWineId: string,
  sectionType: SectionType
): Promise<boolean> {
  const sectionSlides = await db
    .select()
    .from(slides)
    .where(
      and(
        eq(slides.packageWineId, packageWineId),
        eq(slides.section_type, sectionType)
      )
    )
    .orderBy(asc(slides.position));
  
  if (sectionSlides.length < 2) {
    return false;
  }
  
  // Check for very small gaps between consecutive slides
  for (let i = 1; i < sectionSlides.length; i++) {
    const gap = sectionSlides[i].position - sectionSlides[i - 1].position;
    if (gap < POSITION_CONFIG.MIN_GAP) {
      return true;
    }
  }
  
  // Check if we're using too much of the position space
  const range = getSectionRange(sectionType);
  const rangeSize = range.end - range.start;
  const usedSpace = sectionSlides[sectionSlides.length - 1].position - sectionSlides[0].position;
  
  return usedSpace > rangeSize * 0.9; // Renumber if using >90% of available space
}

/**
 * Renumbers all slides in a section with even spacing
 */
export async function renumberSectionSlides(
  packageWineId: string,
  sectionType: SectionType
): Promise<void> {
  const range = getSectionRange(sectionType);
  
  // Get all slides in the section
  const sectionSlides = await db
    .select()
    .from(slides)
    .where(
      and(
        eq(slides.packageWineId, packageWineId),
        eq(slides.section_type, sectionType)
      )
    )
    .orderBy(asc(slides.position));
  
  if (sectionSlides.length === 0) {
    return;
  }
  
  // Calculate new positions with even spacing
  const totalSpace = range.end - range.start;
  const gap = Math.min(POSITION_CONFIG.STANDARD_GAP, totalSpace / (sectionSlides.length + 1));
  
  // Update positions in a transaction
  await db.transaction(async (tx) => {
    // First, move all slides to temporary positions to avoid conflicts
    const tempStart = 900000000;
    for (let i = 0; i < sectionSlides.length; i++) {
      await tx
        .update(slides)
        .set({ position: tempStart + i })
        .where(eq(slides.id, sectionSlides[i].id));
    }
    
    // Then assign final positions
    for (let i = 0; i < sectionSlides.length; i++) {
      const newPosition = roundPosition(range.start + gap * (i + 1));
      await tx
        .update(slides)
        .set({ position: newPosition })
        .where(eq(slides.id, sectionSlides[i].id));
    }
  });
}

/**
 * Finds the slide above the current one in the same section
 */
export async function findSlideAbove(
  packageWineId: string,
  currentPosition: number,
  sectionType: SectionType
): Promise<{ id: string; position: number } | null> {
  const result = await db
    .select({ id: slides.id, position: slides.position })
    .from(slides)
    .where(
      and(
        eq(slides.packageWineId, packageWineId),
        eq(slides.section_type, sectionType),
        lt(slides.position, currentPosition)
      )
    )
    .orderBy(desc(slides.position))
    .limit(1);
  
  return result[0] || null;
}

/**
 * Finds the slide below the current one in the same section
 */
export async function findSlideBelow(
  packageWineId: string,
  currentPosition: number,
  sectionType: SectionType
): Promise<{ id: string; position: number } | null> {
  const result = await db
    .select({ id: slides.id, position: slides.position })
    .from(slides)
    .where(
      and(
        eq(slides.packageWineId, packageWineId),
        eq(slides.section_type, sectionType),
        gt(slides.position, currentPosition)
      )
    )
    .orderBy(asc(slides.position))
    .limit(1);
  
  return result[0] || null;
}

/**
 * Safely updates a slide's position with conflict resolution
 */
export async function updateSlidePositionSafely(
  slideId: string,
  targetPosition: number,
  packageWineId: string,
  sectionType: SectionType,
  retries = 3
): Promise<number> {
  try {
    // Round the target position
    targetPosition = roundPosition(targetPosition);
    
    console.log(`🎯 Updating slide ${slideId.slice(-6)} to position ${targetPosition} in section ${sectionType}`);
    
    // Update the position
    await db
      .update(slides)
      .set({ position: targetPosition })
      .where(eq(slides.id, slideId));
    
    console.log(`✅ Successfully moved slide ${slideId.slice(-6)} to position ${targetPosition}`);
    return targetPosition;
  } catch (error: any) {
    // Check for unique constraint violation
    if (error.code === '23505' && retries > 0) {
      console.log(`⚠️ Position conflict for slide ${slideId.slice(-6)} at position ${targetPosition}. Resolving...`);
      
      // Find a nearby free position
      try {
        const freePosition = await findNearestFreePosition(
          packageWineId,
          targetPosition,
          sectionType
        );
        
        console.log(`🔧 Found free position ${freePosition} for slide ${slideId.slice(-6)}`);
        
        // Retry with the free position
        return updateSlidePositionSafely(
          slideId,
          freePosition,
          packageWineId,
          sectionType,
          retries - 1
        );
      } catch (renumberError) {
        console.log(`🔄 Renumbering section ${sectionType} to resolve conflict for slide ${slideId.slice(-6)}`);
        
        // If we need to renumber, do it and retry
        await renumberSectionSlides(packageWineId, sectionType);
        return updateSlidePositionSafely(
          slideId,
          targetPosition,
          packageWineId,
          sectionType,
          retries - 1
        );
      }
    }
    
    throw error;
  }
}

/**
 * Calculates the position for a new slide in a section
 */
export async function calculateNewSlidePosition(
  packageWineId: string,
  sectionType: SectionType,
  afterSlideId?: string
): Promise<number> {
  const range = getSectionRange(sectionType);
  
  // Get all slides in the section
  const sectionSlides = await db
    .select()
    .from(slides)
    .where(
      and(
        eq(slides.packageWineId, packageWineId),
        eq(slides.section_type, sectionType)
      )
    )
    .orderBy(asc(slides.position));
  
  // If no slides exist, use the start of the range
  if (sectionSlides.length === 0) {
    return range.start + POSITION_CONFIG.STANDARD_GAP;
  }
  
  // If afterSlideId is provided, insert after that slide
  if (afterSlideId) {
    const afterIndex = sectionSlides.findIndex(s => s.id === afterSlideId);
    if (afterIndex >= 0) {
      const afterSlide = sectionSlides[afterIndex];
      const nextSlide = sectionSlides[afterIndex + 1];
      
      if (nextSlide) {
        // Insert between two slides
        return getPositionBetween(afterSlide.position, nextSlide.position);
      } else {
        // Insert after the last slide
        const gap = Math.min(
          POSITION_CONFIG.STANDARD_GAP,
          range.end - afterSlide.position - 1
        );
        return roundPosition(afterSlide.position + gap);
      }
    }
  }
  
  // Default: add to the end
  const lastSlide = sectionSlides[sectionSlides.length - 1];
  const remainingSpace = range.end - lastSlide.position;
  
  if (remainingSpace < POSITION_CONFIG.STANDARD_GAP) {
    // Need to renumber
    await renumberSectionSlides(packageWineId, sectionType);
    
    // Recalculate after renumbering
    return calculateNewSlidePosition(packageWineId, sectionType, afterSlideId);
  }
  
  return roundPosition(lastSlide.position + POSITION_CONFIG.STANDARD_GAP);
}