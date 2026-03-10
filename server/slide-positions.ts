// Slide position management system
// Using a gap-based approach to allow easy insertion without renumbering

export const POSITION_GAPS = {
  PACKAGE_INTRO: 0,        // Package intro is always first
  WINE_START: 1000,        // Start position for each wine (multiplied by wine position)
  WINE_INTRO: 0,           // Offset within wine for intro
  SECTION_START: 100,      // Offset for each section within wine
  SLIDE_GAP: 10,           // Gap between slides
};

export function calculateWineStartPosition(winePosition: number): number {
  return winePosition * POSITION_GAPS.WINE_START;
}

export function calculateSlidePosition(
  winePosition: number,
  sectionType: 'intro' | 'deep_dive' | 'ending',
  slideIndexInSection: number
): number {
  const wineStart = calculateWineStartPosition(winePosition);
  
  let sectionOffset = 0;
  switch (sectionType) {
    case 'intro':
      sectionOffset = POSITION_GAPS.WINE_INTRO;
      break;
    case 'deep_dive':
      sectionOffset = POSITION_GAPS.SECTION_START;
      break;
    case 'ending':
      sectionOffset = POSITION_GAPS.SECTION_START * 2;
      break;
  }
  
  return wineStart + sectionOffset + (slideIndexInSection * POSITION_GAPS.SLIDE_GAP);
}

export function isPackageIntroPosition(position: number): boolean {
  return position === POSITION_GAPS.PACKAGE_INTRO;
}

export function isWineIntroPosition(position: number): boolean {
  // Wine intro is at the start of each wine section
  return position % POSITION_GAPS.WINE_START === POSITION_GAPS.WINE_INTRO;
}

export function getWineFromPosition(position: number): number {
  return Math.floor(position / POSITION_GAPS.WINE_START);
}

export function getSectionFromPosition(position: number): 'intro' | 'deep_dive' | 'ending' {
  const offsetInWine = position % POSITION_GAPS.WINE_START;
  
  if (offsetInWine < POSITION_GAPS.SECTION_START) {
    return 'intro';
  } else if (offsetInWine < POSITION_GAPS.SECTION_START * 2) {
    return 'deep_dive';
  } else {
    return 'ending';
  }
}