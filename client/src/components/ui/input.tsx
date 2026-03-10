import * as React from "react"

import { cn } from "@/lib/utils"
import { useHaptics } from "@/hooks/useHaptics"

export interface InputProps extends React.ComponentProps<"input"> {
  error?: boolean
  success?: boolean
  hapticFeedback?: boolean
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error = false, success = false, hapticFeedback = true, onFocus, onBlur, onChange, ...props }, ref) => {
    const { triggerHaptic } = useHaptics()
    const [isFocused, setIsFocused] = React.useState(false)
    const [hasValue, setHasValue] = React.useState(false)

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true)
      if (hapticFeedback) {
        triggerHaptic('selection')
      }
      if (onFocus) {
        onFocus(e)
      }
    }

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false)
      if (onBlur) {
        onBlur(e)
      }
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setHasValue(e.target.value.length > 0)
      if (onChange) {
        onChange(e)
      }
    }

    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          "transform transition-all duration-300 ease-out",
          "focus:scale-[1.01] focus:shadow-lg focus:border-blue-500",
          error && "border-red-500 animate-pulse",
          success && "border-green-500 shadow-green-100",
          isFocused && "scale-[1.01] shadow-lg border-blue-500",
          className
        )}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onChange={handleChange}
        style={{
          transformOrigin: "center"
        }}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
