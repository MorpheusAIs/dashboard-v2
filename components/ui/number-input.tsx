"use client"

import * as React from "react"
import { Minus, Plus } from "lucide-react"
import { cn } from "@/lib/utils"

interface NumberInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onValueChange?: (value: number) => void
  min?: number
  max?: number
  step?: number
  defaultValue?: number
  value?: number
  className?: string
  buttonClassName?: string
}

export const NumberInput = React.forwardRef<HTMLDivElement, NumberInputProps>(
  ({ 
    className, 
    onValueChange, 
    min = 0, 
    max, 
    step = 1, 
    defaultValue, 
    value, 
    buttonClassName,
    ...props 
  }, ref) => {
    const [internalValue, setInternalValue] = React.useState<number | undefined>(
      value !== undefined ? value : defaultValue
    )

    React.useEffect(() => {
      if (value !== undefined) {
        setInternalValue(value)
      }
    }, [value])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      // Allow empty input (will be treated as 0 when blurred)
      if (e.target.value === "") {
        setInternalValue(undefined)
        return
      }

      const newValue = parseInt(e.target.value, 10)
      
      if (!isNaN(newValue)) {
        setInternalValue(newValue)
        onValueChange?.(newValue)
      }
    }

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      // If empty or undefined, set to min value
      if (e.target.value === "" || internalValue === undefined) {
        const defaultVal = min === 0 ? 0 : 1
        setInternalValue(defaultVal)
        onValueChange?.(defaultVal)
        return
      }

      // Ensure value is within bounds
      let newValue = internalValue
      
      if (max !== undefined && newValue > max) {
        newValue = max
      }
      
      if (newValue < min) {
        newValue = min
      }
      
      setInternalValue(newValue)
      onValueChange?.(newValue)
    }

    const increment = () => {
      const currentValue = internalValue ?? min
      const newValue = max !== undefined 
        ? Math.min(currentValue + step, max) 
        : currentValue + step
      
      setInternalValue(newValue)
      onValueChange?.(newValue)
    }

    const decrement = () => {
      const currentValue = internalValue ?? min
      const newValue = Math.max(currentValue - step, min)
      
      setInternalValue(newValue)
      onValueChange?.(newValue)
    }

    return (
      <div 
        className={cn("flex h-10 w-full rounded-md border border-input", className)}
        ref={ref}
      >
        <button
          type="button"
          onClick={decrement}
          className={cn(
            "flex items-center justify-center px-3 text-muted-foreground hover:text-emerald-500 disabled:opacity-50",
            "border-r border-input",
            buttonClassName
          )}
          disabled={internalValue !== undefined && internalValue <= min}
        >
          <Minus className="h-4 w-4" />
        </button>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={internalValue === undefined ? "" : internalValue}
          onChange={handleChange}
          onBlur={handleBlur}
          className="w-full px-3 py-2 text-center border-0 focus:ring-0 focus:outline-none bg-transparent"
          {...props}
        />
        <button
          type="button"
          onClick={increment}
          className={cn(
            "flex items-center justify-center px-3 text-muted-foreground hover:text-emerald-500 disabled:opacity-50",
            "border-l border-input",
            buttonClassName
          )}
          disabled={max !== undefined && internalValue !== undefined && internalValue >= max}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    )
  }
)

NumberInput.displayName = "NumberInput" 