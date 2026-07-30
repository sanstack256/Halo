import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "group/button inline-flex cursor-pointer shrink-0 items-center justify-center rounded-lg border border-transparent text-sm font-medium whitespace-nowrap transition-[background-color,border-color,color,transform] duration-150 ease-out outline-none select-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:brightness-110",

        outline:
          "border-border bg-background hover:bg-muted hover:text-foreground",

        secondary:
          "bg-secondary text-secondary-foreground hover:brightness-105",

        ghost:
          "hover:bg-muted hover:text-foreground",

        destructive:
          "bg-destructive text-destructive-foreground hover:brightness-110",

        link:
          "text-primary underline-offset-4 hover:underline",
      },

      size: {
        default: "h-10 gap-2 px-4",

        xs:
          "h-7 gap-1 rounded-md px-2 text-xs [&_svg:not([class*='size-'])]:size-3",

        sm:
          "h-9 gap-2 px-3 text-sm [&_svg:not([class*='size-'])]:size-3.5",

        lg:
          "h-11 gap-2 px-5 text-base",

        icon: "size-10",

        "icon-xs":
          "size-7 rounded-md [&_svg:not([class*='size-'])]:size-3",

        "icon-sm":
          "size-9 rounded-lg",

        "icon-lg":
          "size-11 rounded-lg",
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
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };