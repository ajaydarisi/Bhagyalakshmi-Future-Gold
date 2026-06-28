import * as React from "react"

import { cn } from "@/lib/utils"

type InputProps = React.ComponentProps<"input"> & {
  /** Icon rendered inside the field on the leading edge (e.g. search). */
  iconLeft?: React.ReactNode
  /** Trailing adornment inside the field (e.g. a unit like "/day" or a clear button). */
  adornment?: React.ReactNode
}

function Input({ className, type, iconLeft, adornment, ...props }: InputProps) {
  const inputEl = (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        // pad for adornments when present
        iconLeft && "pl-9",
        adornment && "pr-9",
        className
      )}
      {...props}
    />
  )

  // No adornments → render exactly as before (backward compatible).
  if (!iconLeft && !adornment) return inputEl

  return (
    <div data-slot="input-wrapper" className="relative w-full">
      {iconLeft ? (
        <span className="text-muted-foreground pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 [&_svg]:size-4">
          {iconLeft}
        </span>
      ) : null}
      {inputEl}
      {adornment ? (
        <span className="text-muted-foreground absolute inset-y-0 right-0 flex items-center pr-3 [&_svg]:size-4">
          {adornment}
        </span>
      ) : null}
    </div>
  )
}

export { Input }
