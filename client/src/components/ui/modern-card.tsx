import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface ModernCardProps extends React.HTMLAttributes<HTMLDivElement> {
  selected?: boolean;
  interactive?: boolean;
  depth?: "shallow" | "medium" | "deep";
  glow?: boolean;
  children: React.ReactNode;
}

const depthStyles = {
  shallow: "shadow-lg hover:shadow-xl",
  medium: "shadow-xl hover:shadow-2xl",
  deep: "shadow-2xl hover:shadow-3xl"
};

export function ModernCard({ 
  className, 
  children, 
  selected = false, 
  interactive = true,
  depth = "medium",
  glow = false,
  onClick,
  ...props 
}: ModernCardProps) {
  return (
    <motion.div
      className={cn(
        "relative rounded-2xl backdrop-blur-xl border transition-all duration-300",
        "bg-gradient-to-br from-white/10 to-white/5",
        depthStyles[depth],
        selected 
          ? "border-purple-400/60 bg-gradient-to-br from-purple-400/20 to-purple-600/10" 
          : "border-white/20 hover:border-white/30",
        interactive && "cursor-pointer",
        glow && selected && "ring-2 ring-purple-400/30 ring-offset-2 ring-offset-transparent",
        className
      )}
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      whileHover={interactive ? { 
        scale: 1.02, 
        y: -4,
        transition: { duration: 0.2, ease: "easeOut" }
      } : {}}
      whileTap={interactive ? { 
        scale: 0.98,
        transition: { duration: 0.1 }
      } : {}}
      onClick={onClick}
      style={{ transformOrigin: "center" }}
      {...(props as any)}
    >
      {/* Selection glow effect */}
      <AnimatePresence>
        {selected && glow && (
          <motion.div
            className="absolute inset-0 rounded-2xl bg-gradient-to-r from-purple-400/20 to-pink-400/20 blur-lg"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.2 }}
            transition={{ duration: 0.3 }}
          />
        )}
      </AnimatePresence>
      
      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
      
      {/* Interactive ripple on click */}
      <AnimatePresence>
        {interactive && (
          <motion.div
            className="absolute inset-0 rounded-2xl pointer-events-none"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 0.1 }}
            exit={{ scale: 1.5, opacity: 0 }}
            transition={{ duration: 0.6 }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}