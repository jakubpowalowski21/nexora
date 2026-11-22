import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/src/lib/utils";
const button = cva("button", {
  variants: {
    variant: {
      primary: "button-primary",
      secondary: "button-secondary",
      outline: "button-outline",
      ghost: "button-ghost",
    },
    size: { default: "", small: "button-sm", icon: "icon-button" },
  },
  defaultVariants: { variant: "primary", size: "default" },
});
export function Button({
  className,
  variant,
  size,
  asChild,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof button> & { asChild?: boolean }) {
  const Component = asChild ? Slot : "button";
  return (
    <Component
      className={cn(button({ variant, size }), className)}
      {...props}
    />
  );
}
