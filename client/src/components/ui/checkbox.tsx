import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { Check } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useHaptics } from "@/hooks/useHaptics"
import { springTransition } from "@/lib/modern-animations"

import { cn } from "@/lib/utils"

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => {
  const { triggerHaptic } = useHaptics();
  const [isChecked, setIsChecked] = React.useState(false);

  const handleCheckedChange = (checked: boolean) => {
    setIsChecked(checked);
    triggerHaptic('selection');
    props.onCheckedChange?.(checked);
  };

  return (
    <motion.div
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      transition={springTransition}
    >
      <CheckboxPrimitive.Root
        ref={ref}
        className={cn(
          "peer h-5 w-5 shrink-0 rounded-lg border-2 border-white/30 bg-white/10 backdrop-blur-sm",
          "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/50 focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "data-[state=checked]:bg-purple-500 data-[state=checked]:border-purple-400 data-[state=checked]:text-white",
          "transition-all duration-200 hover:border-white/50",
          className
        )}
        onCheckedChange={handleCheckedChange}
        {...props}
      >
        <CheckboxPrimitive.Indicator
          className={cn("flex items-center justify-center text-current")}
        >
          <AnimatePresence>
            <motion.div
              initial={{ scale: 0, rotate: -90 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, rotate: 90 }}
              transition={springTransition}
            >
              <Check className="h-3 w-3" />
            </motion.div>
          </AnimatePresence>
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
    </motion.div>
  );
})
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }
