export const animations = {
  // Slide transitions with spring physics
  slideIn: {
    initial: { x: 300, opacity: 0 },
    animate: { 
      x: 0, 
      opacity: 1,
      transition: { type: "spring", stiffness: 300, damping: 30 }
    },
    exit: { x: -300, opacity: 0 }
  },
  
  // Card interactions
  cardHover: {
    scale: 1.02,
    transition: { type: "spring", stiffness: 400 }
  },
  
  // Success celebration
  successPulse: {
    scale: [1, 1.05, 0.95, 1],
    transition: { times: [0, 0.2, 0.4, 1] }
  },
  
  // Loading shimmer
  shimmer: {
    backgroundPosition: ["200% 0", "-200% 0"],
    transition: { duration: 1.5, repeat: Infinity }
  },

  // Float animation for wine elements
  float: {
    y: [0, -10, 0],
    rotate: [0, 2, -2, 0],
    transition: { duration: 6, repeat: Infinity, ease: "easeInOut" }
  },
  
  // Varied float animations for background elements
  floatSlow: {
    y: [0, -8, 0],
    rotate: [0, 1, -1, 0],
    transition: { duration: 8, repeat: Infinity, ease: "easeInOut" }
  },
  
  floatFast: {
    y: [0, -12, 0],
    rotate: [0, 3, -3, 0],
    transition: { duration: 5, repeat: Infinity, ease: "easeInOut" }
  }
};

export const hapticPatterns = {
  success: [10, 50, 10, 50, 20], // Double tap + hold
  error: [50, 100, 50], // Strong buzz
  warning: [20, 40, 20], // Gentle double tap
  selection: [10], // Light tap
  navigation: [5, 10, 5], // Subtle transition
  milestone: [20, 40, 20, 40, 60], // Celebration pattern
};
