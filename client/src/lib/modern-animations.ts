import { Variants } from "framer-motion";

// Modern spring-based animations with natural motion curves
export const springTransition = {
  type: "spring",
  stiffness: 300,
  damping: 30,
  mass: 0.8
};

export const smoothTransition = {
  type: "spring",
  stiffness: 400,
  damping: 40,
  mass: 0.5
};

// Contemporary button interactions
export const modernButtonVariants: Variants = {
  initial: { 
    scale: 1,
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
    y: 0
  },
  hover: { 
    scale: 1.02,
    boxShadow: "0 8px 25px rgba(0, 0, 0, 0.25)",
    y: -2,
    transition: smoothTransition
  },
  tap: { 
    scale: 0.98,
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
    y: 0,
    transition: { duration: 0.1 }
  },
  loading: {
    scale: [1, 1.05, 1],
    transition: { duration: 1.5, repeat: Infinity }
  }
};

// Advanced card interactions with depth
export const modernCardVariants: Variants = {
  initial: { 
    scale: 1,
    rotateY: 0,
    boxShadow: "0 4px 20px rgba(0, 0, 0, 0.1)",
    borderRadius: 16
  },
  hover: { 
    scale: 1.03,
    rotateY: 2,
    boxShadow: "0 12px 40px rgba(0, 0, 0, 0.2)",
    transition: springTransition
  },
  tap: { 
    scale: 0.97,
    transition: { duration: 0.1 }
  },
  selected: {
    scale: 1.02,
    boxShadow: "0 8px 32px rgba(139, 92, 246, 0.3)",
    borderColor: "rgba(139, 92, 246, 0.6)"
  }
};

// Progressive content reveal
export const staggeredReveal: Variants = {
  hidden: { 
    opacity: 0,
    y: 20,
    scale: 0.95
  },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      ...springTransition,
      delay: i * 0.1
    }
  })
};

// Advanced input field states
export const modernInputVariants: Variants = {
  initial: {
    borderColor: "rgba(255, 255, 255, 0.2)",
    boxShadow: "0 0 0 0 rgba(139, 92, 246, 0)",
    scale: 1
  },
  focus: {
    borderColor: "rgba(139, 92, 246, 0.8)",
    boxShadow: "0 0 0 4px rgba(139, 92, 246, 0.2)",
    scale: 1.01,
    transition: smoothTransition
  },
  error: {
    borderColor: "rgba(239, 68, 68, 0.8)",
    boxShadow: "0 0 0 4px rgba(239, 68, 68, 0.2)",
    x: [-2, 2, -2, 2, 0],
    transition: { duration: 0.4 }
  },
  success: {
    borderColor: "rgba(34, 197, 94, 0.8)",
    boxShadow: "0 0 0 4px rgba(34, 197, 94, 0.2)",
    transition: smoothTransition
  }
};

// Floating action button with physics
export const fabVariants: Variants = {
  initial: {
    scale: 1,
    rotate: 0,
    boxShadow: "0 6px 20px rgba(0, 0, 0, 0.3)"
  },
  hover: {
    scale: 1.1,
    rotate: 5,
    boxShadow: "0 10px 30px rgba(0, 0, 0, 0.4)",
    transition: springTransition
  },
  tap: {
    scale: 0.95,
    rotate: -5,
    transition: { duration: 0.1 }
  }
};

// Page transition animations
export const pageVariants: Variants = {
  initial: {
    opacity: 0,
    x: 100,
    scale: 0.95
  },
  in: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: {
      ...springTransition,
      staggerChildren: 0.1
    }
  },
  out: {
    opacity: 0,
    x: -100,
    scale: 1.05,
    transition: { duration: 0.3 }
  }
};

// Advanced progress bar with physics
export const modernProgressVariants: Variants = {
  initial: { 
    width: 0,
    boxShadow: "0 0 0 rgba(139, 92, 246, 0)"
  },
  animate: (progress: number) => ({
    width: `${progress}%`,
    boxShadow: progress > 50 ? "0 0 20px rgba(139, 92, 246, 0.6)" : "0 0 0 rgba(139, 92, 246, 0)",
    transition: {
      width: { ...springTransition, duration: 1.2 },
      boxShadow: { duration: 0.5 }
    }
  })
};

// Notification toast with modern motion
export const toastVariants: Variants = {
  initial: {
    opacity: 0,
    y: -100,
    scale: 0.8,
    rotateX: -90
  },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    rotateX: 0,
    transition: springTransition
  },
  exit: {
    opacity: 0,
    y: -100,
    scale: 0.8,
    rotateX: 90,
    transition: { duration: 0.3 }
  }
};

// Modern loading states
export const modernLoadingVariants: Variants = {
  initial: { opacity: 0.6 },
  animate: {
    opacity: [0.6, 1, 0.6],
    scale: [1, 1.02, 1],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: "easeInOut"
    }
  }
};

// Glass morphism effect
export const glassMorphVariants: Variants = {
  initial: {
    backdropFilter: "blur(10px)",
    background: "rgba(255, 255, 255, 0.1)",
    borderColor: "rgba(255, 255, 255, 0.2)"
  },
  hover: {
    backdropFilter: "blur(15px)",
    background: "rgba(255, 255, 255, 0.15)",
    borderColor: "rgba(255, 255, 255, 0.3)",
    transition: smoothTransition
  }
};

// Advanced slider interactions
export const modernSliderTrackVariants: Variants = {
  rest: { scaleY: 1 },
  hover: { scaleY: 1.2, transition: smoothTransition }
};

export const modernSliderThumbVariants: Variants = {
  rest: { 
    scale: 1,
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2)"
  },
  hover: { 
    scale: 1.3,
    boxShadow: "0 4px 16px rgba(139, 92, 246, 0.4)",
    transition: smoothTransition
  },
  drag: { 
    scale: 1.5,
    boxShadow: "0 6px 24px rgba(139, 92, 246, 0.6)",
    transition: { duration: 0.1 }
  }
};