import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex min-w-0 items-center justify-center gap-1.5 whitespace-normal break-normal rounded-xl text-xs font-semibold leading-tight disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive md:gap-2 md:whitespace-nowrap md:text-sm md:shrink-0",
  {
    variants: {
      variant: {
        default:
          "gradient-primary text-primary-foreground shadow-md hover:shadow-lg hover:opacity-90",
        destructive:
          "gradient-error text-white shadow-md hover:shadow-lg hover:opacity-90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40",
        outline:
          "border border-border/60 bg-card shadow-sm hover:bg-card hover:text-accent-foreground hover:border-border/80 hover:shadow-md",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary hover:shadow-md",
        ghost:
          "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline hover:text-primary-light",
      },
      size: {
        default: "min-h-9 h-auto px-4 py-2 has-[>svg]:px-3 md:h-10 md:px-6 md:py-2.5 md:has-[>svg]:px-4",
        sm: "min-h-8 h-auto rounded-lg gap-1.5 px-3 py-1.5 has-[>svg]:px-2.5 md:h-8 md:px-4 md:py-0 md:has-[>svg]:px-3",
        lg: "min-h-10 h-auto rounded-xl px-5 py-2.5 has-[>svg]:px-4 text-sm md:h-12 md:px-8 md:py-0 md:has-[>svg]:px-6 md:text-base",
        icon: "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
