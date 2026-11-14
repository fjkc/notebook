import { cn } from "cn"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("rounded-md bg-rule/60", className)}
      {...props}
    />
  )
}

export { Skeleton }
