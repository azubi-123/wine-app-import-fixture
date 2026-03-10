import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useHaptics } from "@/hooks/useHaptics";

interface ModernSliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  labels?: [string, string];
  labelClassNames?: [string, string];
  progressPercent?: number;
  onChange: (value: number) => void;
  className?: string;
}

export function ModernSlider({ 
  value, 
  min, 
  max, 
  step = 1, 
  labels,
  labelClassNames,
  progressPercent,
  onChange, 
  className 
}: ModernSliderProps) {
  const { triggerHaptic } = useHaptics();
  const [isDragging, setIsDragging] = React.useState(false);
  const [hoverPosition, setHoverPosition] = React.useState<number | null>(null);
  const trackRef = React.useRef<HTMLDivElement>(null);

  // Clamp value to valid range and calculate safe percentage
  const clampedValue = Math.max(min, Math.min(max, value));
  const percentage = Math.max(0, Math.min(100, ((clampedValue - min) / (max - min)) * 100));

  const calculateValueFromPosition = (clientX: number) => {
    if (!trackRef.current) return null;

    const rect = trackRef.current.getBoundingClientRect();
    const posX = clientX - rect.left;
    const posPercentage = (posX / rect.width) * 100;
    const newValue = Math.round((posPercentage / 100) * (max - min) + min);
    return Math.max(min, Math.min(max, newValue));
  };

  const handleClick = (e: React.MouseEvent) => {
    const newValue = calculateValueFromPosition(e.clientX);
    if (newValue !== null) {
      triggerHaptic('selection');
      onChange(newValue);
    }
  };

  // Touch event handlers for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    const touch = e.touches[0];
    const newValue = calculateValueFromPosition(touch.clientX);
    if (newValue !== null && newValue !== value) {
      triggerHaptic('selection');
      onChange(newValue);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    const newValue = calculateValueFromPosition(touch.clientX);
    if (newValue !== null && newValue !== value) {
      onChange(newValue);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    triggerHaptic('selection');
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!trackRef.current) return;
    
    const rect = trackRef.current.getBoundingClientRect();
    const hoverX = e.clientX - rect.left;
    const hoverPercentage = (hoverX / rect.width) * 100;
    setHoverPosition(Math.max(0, Math.min(100, hoverPercentage)));
  };

  const dashCount = Math.floor((max - min) / step) + 1;
  const dashPositions = Array.from({ length: dashCount }, (_, i) => (i / (dashCount - 1)) * 100);

  return (
    <div className={cn("relative overflow-hidden py-4", className)}>
      {/* Slider Track - extra padding for better touch target */}
      <div className="relative">
        <motion.div
          ref={trackRef}
          className="relative h-4 bg-white/20 rounded-full cursor-pointer overflow-hidden backdrop-blur-sm touch-none"
          style={{ maxWidth: '100%' }} // Safety net to prevent overflow
          onClick={handleClick}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverPosition(null)}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          whileHover={{ scaleY: 1.2 }}
          transition={{ duration: 0.2 }}
        >
          {/* Hover indicator */}
          <AnimatePresence>
            {hoverPosition !== null && !isDragging && (
              <motion.div
                className="absolute top-1/2 w-2 h-8 bg-white/30 rounded-full -translate-y-1/2 -translate-x-1/2 pointer-events-none"
                style={{ left: `${hoverPosition}%` }}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0 }}
                transition={{ duration: 0.15 }}
              />
            )}
          </AnimatePresence>

          {/* Progress fill with dynamic glow */}
          <motion.div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full overflow-hidden"
            animate={{ width: `${Math.min(100, percentage)}%` }}
            transition={{ type: "spring", stiffness: 200, damping: 25 }}
          >
            {/* Dynamic intensity glow effect */}
            <motion.div 
              className="absolute inset-0 rounded-full blur-md"
              style={{ 
                background: 'radial-gradient(circle, rgba(233,168,255,0.7) 0%, rgba(192,132,252,0) 70%)' 
              }}
              animate={{ 
                opacity: (progressPercent || percentage / 100), // Glow opacity increases with value
                scale: 1 + ((progressPercent || percentage / 100) * 0.5) // Glow size increases with value
              }}
              transition={{ duration: 0.2 }}
            />
            {/* Base glow effect */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-purple-400/50 to-pink-400/50 rounded-full blur-sm"
              animate={{ opacity: isDragging ? 1 : 0.3 }}
              transition={{ duration: 0.2 }}
            />
          </motion.div>

          {/* Energy Hotspot Glow */}
          {/*<motion.div*/}
          {/*  className="absolute w-8 h-8 rounded-full pointer-events-none"*/}
          {/*  style={{ */}
          {/*    background: 'radial-gradient(circle, rgba(233, 168, 255, 0.5) 0%, rgba(192, 132, 252, 0) 65%)',*/}
          {/*    left: `${Math.min(100, Math.max(0, percentage))}%`, // Constrain to valid range*/}
          {/*    top: `calc(50% - 16px)`, // 16px is half the glow height to center on track*/}
          {/*    transform: 'translateX(-50%)' // Center the glow on the percentage point*/}
          {/*  }}*/}
          {/*  animate={{ */}
          {/*    scale: 1 + (percentage / 100) * 0.5 // Glow gets bigger at higher values*/}
          {/*  }}*/}
          {/*  transition={{ type: 'spring', stiffness: 300, damping: 20 }}*/}
          {/*/>*/}

          {/* Dash marks */}
          {dashPositions.map((position, index) => (
            <motion.div
              key={index}
              className="absolute top-1/2 w-0.5 h-6 bg-white/40 rounded-full -translate-y-1/2 -translate-x-1/2 cursor-pointer"
              style={{ left: `${position}%` }}
              whileHover={{ 
                scaleY: 1.5, 
                backgroundColor: "rgba(255, 255, 255, 0.8)",
                transition: { duration: 0.15 }
              }}
              onClick={(e) => {
                e.stopPropagation();
                const dashValue = Math.round((position / 100) * (max - min) + min);
                triggerHaptic('selection');
                onChange(dashValue);
              }}
            />
          ))}
        </motion.div>

        {/* Thumb with dynamic glow */}
        {/*<motion.div*/}
        {/*  className="absolute w-6 h-6 bg-white rounded-full shadow-lg cursor-grab"*/}
        {/*  style={{ */}
        {/*    left: `${Math.min(100, Math.max(0, percentage))}%`, // Constrain to valid range*/}
        {/*    top: `calc(50% - 12px)`, // 12px is half the thumb height to center on track*/}
        {/*    transform: 'translateX(-50%)' // Center the thumb on the percentage point*/}
        {/*  }}*/}
        {/*  drag="x"*/}
        {/*  dragConstraints={trackRef}*/}
        {/*  dragElastic={0}*/}
        {/*  onDragStart={() => {*/}
        {/*    setIsDragging(true);*/}
        {/*    triggerHaptic('selection');*/}
        {/*  }}*/}
        {/*  onDragEnd={() => setIsDragging(false)}*/}
        {/*  onDrag={(_, info) => {*/}
        {/*    if (!trackRef.current) return;*/}
        {/*    */}
        {/*    const rect = trackRef.current.getBoundingClientRect();*/}
        {/*    // More stable drag calculation with damping for fast movements*/}
        {/*    const sensitivity = Math.min(1, 50 / Math.abs(info.velocity.x || 1)); // Reduce sensitivity for fast drags*/}
        {/*    const dampedDelta = info.delta.x * sensitivity;*/}
        {/*    */}
        {/*    const currentOffset = (percentage / 100) * rect.width;*/}
        {/*    const newOffset = Math.max(0, Math.min(rect.width, currentOffset + dampedDelta));*/}
        {/*    const newPercentage = (newOffset / rect.width) * 100;*/}
        {/*    const newValue = Math.round((newPercentage / 100) * (max - min) + min);*/}
        {/*    */}
        {/*    // Always clamp to valid range*/}
        {/*    const finalValue = Math.max(min, Math.min(max, newValue));*/}
        {/*    if (finalValue !== value) {*/}
        {/*      onChange(finalValue);*/}
        {/*    }*/}
        {/*  }}*/}
        {/*  whileHover={{ */}
        {/*    scale: 1.2,*/}
        {/*    boxShadow: "0 0 20px rgba(147, 51, 234, 0.5)"*/}
        {/*  }}*/}
        {/*  whileDrag={{ */}
        {/*    scale: 1.3,*/}
        {/*    boxShadow: "0 0 30px rgba(147, 51, 234, 0.8)"*/}
        {/*  }}*/}
        {/*  animate={{*/}
        {/*    boxShadow: isDragging */}
        {/*      ? `0px 0px 15px 5px rgba(192, 132, 252, ${0.5 + ((progressPercent || percentage/100)*0.5)})` */}
        {/*      : `0px 0px 8px 2px rgba(192, 132, 252, ${0.2 + ((progressPercent || percentage/100)*0.3)})`*/}
        {/*  }}*/}
        {/*  transition={{ type: "spring", stiffness: 300, damping: 30 }}*/}
        {/*>*/}
        {/*  /!* Dynamic intensity thumb glow *!/*/}
        {/*  <motion.div*/}
        {/*    className="absolute inset-0 bg-purple-400/30 rounded-full blur-md"*/}
        {/*    animate={{ */}
        {/*      scale: isDragging ? 2 : 1 + ((progressPercent || percentage/100) * 0.5),*/}
        {/*      opacity: isDragging ? 1 : 0.3 + ((progressPercent || percentage/100) * 0.4)*/}
        {/*    }}*/}
        {/*    transition={{ duration: 0.2 }}*/}
        {/*  />*/}
        {/*</motion.div>*/}

        {/*/!* Value display *!/*/}
        {/*<AnimatePresence>*/}
        {/*  {isDragging && (*/}
        {/*    <motion.div*/}
        {/*      className="absolute -top-12 left-1/2 -translate-x-1/2 bg-black/80 text-white px-3 py-1 rounded-lg text-sm font-medium backdrop-blur-sm"*/}
        {/*      style={{ left: `${Math.min(100, Math.max(0, percentage))}%` }}*/}
        {/*      initial={{ opacity: 0, y: 10, scale: 0.8 }}*/}
        {/*      animate={{ opacity: 1, y: 0, scale: 1 }}*/}
        {/*      exit={{ opacity: 0, y: 10, scale: 0.8 }}*/}
        {/*      transition={{ duration: 0.2 }}*/}
        {/*    >*/}
        {/*      {clampedValue}*/}
        {/*      <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-black/80" />*/}
        {/*    </motion.div>*/}
        {/*  )}*/}
        {/*</AnimatePresence>*/}
      </div>

    </div>
  );
}