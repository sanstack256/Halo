import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const cardVariants = cva(
  [
    "rounded-xl",
    "transition-all",
    "duration-150",
    "bg-[#080c12]",
    "border",
    "border-white/[0.04]",
  ],
  {
    variants: {
      variant: {
        default: "",

        elevated: [
          "bg-[#0b1018]",
        ],

        interactive: [
          "cursor-pointer",
          "hover:bg-[#0e1522]",
          "hover:border-white/10",
        ],
      },

      padding: {
        none: "p-0",
        sm: "p-4",
        md: "p-6",
        lg: "p-8",
      },
    },

    defaultVariants: {
      variant: "default",
      padding: "md",
    },
  }
);

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

export function Card({
  className,
  variant,
  padding,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        cardVariants({
          variant,
          padding,
        }),
        className
      )}
      {...props}
    />
  );
}