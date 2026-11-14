import * as React from "react"
import { cn } from "cn"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-9 w-full min-w-0 rounded-md border border-input bg-surface px-2.5 py-1 text-base transition-colors duration-150 outline-none file:inline-flex file:h-6 file:border-0 file:bg-surface file:text-sm file:font-medium file:text-foreground placeholder:text-graphite disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Input }
