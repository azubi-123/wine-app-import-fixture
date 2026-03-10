import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { motion } from "framer-motion"
import { modernButtonVariants, springTransition } from "@/lib/modern-animations"

import { cn } from "@/lib/utils"
import { useHaptics } from "@/hooks/useHaptics"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
  hapticFeedback?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, hapticFeedback = true, onClick, ...props }, ref) => {
    const { triggerHaptic } = useHaptics()
    const [isPressed, setIsPressed] = React.useState(false)

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (hapticFeedback) {
        triggerHaptic('selection')
      }
      if (onClick) {
        onClick(e)
      }
    }

    const handlePointerDown = () => setIsPressed(true)
    const handlePointerUp = () => setIsPressed(false)
    const handlePointerLeave = () => setIsPressed(false)

    if (asChild) {
      return (
        <Slot
          className={cn(buttonVariants({ variant, size, className }))}
          ref={ref}
          onClick={handleClick}
          {...props}
        />
      );
    }

    return (
      <motion.button
        className={cn(
          buttonVariants({ variant, size, className }),
          "relative overflow-hidden transform-gpu"
        )}
        ref={ref}
        onClick={handleClick}
        variants={modernButtonVariants}
        initial="initial"
        whileHover="hover"
        whileTap="tap"
        animate={loading ? "loading" : "initial"}
        transition={springTransition}
        style={{
          transformOrigin: "center"
        }}
        disabled={loading}
        {...(props as any)}
      >
        {loading && (
          <motion.div 
            className="w-4 h-4 border-2 border-current border-t-transparent rounded-full mr-2"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          />
        )}
        {props.children}
      </motion.button>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
