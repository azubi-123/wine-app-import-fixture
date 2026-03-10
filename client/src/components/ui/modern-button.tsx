import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHaptics } from "@/hooks/useHaptics";

// Omit native events that conflict with Framer Motion's signatures
interface ModernButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onDrag' | 'onDragStart' | 'onDragEnd' | 'onAnimationStart'> {
  variant?: "primary" | "secondary" | "ghost" | "destructive";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

const variants = {
  primary: "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg hover:shadow-xl",
  secondary: "bg-white/10 text-white border border-white/20 hover:bg-white/20",
  ghost: "text-white hover:bg-white/10",
  destructive: "bg-gradient-to-r from-red-600 to-red-700 text-white shadow-lg"
};

const sizes = {
  sm: "px-4 py-2 text-sm",
  md: "px-6 py-3 text-base",
  lg: "px-8 py-4 text-lg"
};

export function ModernButton({ 
  className, 
  variant = "primary", 
  size = "md", 
  loading = false,
  icon,
  children, 
  onClick,
  disabled,
  ...props 
}: ModernButtonProps) {
  const { triggerHaptic } = useHaptics();
  const [isPressed, setIsPressed] = React.useState(false);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || loading) return;
    
    triggerHaptic('selection');
    setIsPressed(true);
    setTimeout(() => setIsPressed(false), 150);
    onClick?.(e);
  };

  return (
    <motion.button
      className={cn(
        "relative inline-flex items-center justify-center gap-2 rounded-xl font-medium",
        "transition-all duration-200 transform-gpu focus:outline-none focus:ring-2 focus:ring-purple-400/50",
        "disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden",
        variants[variant],
        sizes[size],
        className
      )}
      initial={{ scale: 1 }}
      whileHover={{ 
        scale: 1.02,
        y: -2,
        transition: { duration: 0.2, ease: "easeOut" }
      }}
      whileTap={{ 
        scale: 0.98,
        y: 0,
        transition: { duration: 0.1 }
      }}
      animate={{
        scale: loading ? [1, 1.02, 1] : 1,
        transition: loading ? { duration: 1.5, repeat: Infinity } : {}
      }}
      onClick={handleClick}
      disabled={disabled || loading}
      {...props}
    >
      {/* Background glow effect */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-purple-400/20 to-pink-400/20 rounded-xl"
        initial={{ opacity: 0 }}
        animate={{ opacity: isPressed ? 1 : 0 }}
        transition={{ duration: 0.3 }}
      />
      
      {/* Ripple effect on click */}
      <AnimatePresence>
        {isPressed && (
          <motion.div
            className="absolute inset-0 bg-white/20 rounded-xl"
            initial={{ scale: 0, opacity: 0.5 }}
            animate={{ scale: 1.5, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
          />
        )}
      </AnimatePresence>
      
      {/* Content */}
      <div className="relative z-10 flex items-center gap-2">
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Loader2 className="w-4 h-4 animate-spin" />
            </motion.div>
          ) : icon ? (
            <motion.div
              key="icon"
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0 }}
              transition={{ duration: 0.2 }}
            >
              {icon}
            </motion.div>
          ) : null}
        </AnimatePresence>
        
        <motion.span
          animate={{ x: loading ? 8 : 0 }}
          transition={{ duration: 0.2 }}
        >
          {children}
        </motion.span>
      </div>
    </motion.button>
  );
}