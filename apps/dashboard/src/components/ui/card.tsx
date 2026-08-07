import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const cardVariants = cva(
  [
    "rounded-2xl",
    "transition-all",
    "duration-200",
    "bg-[#0b1118]",
    "border",
    "border-white/[0.015]",
  ],
  {
    variants: {
      variant: {
        default: "",

        elevated: [
          "bg-[#0d141d]",
          "shadow-[0_20px_60px_rgba(0,0,0,0.28)]",
        ],

        interactive: [
          "cursor-pointer",
          "hover:bg-[#101827]",
          "hover:border-[#5bb8ff]/10",
          "hover:-translate-y-[1px]",
          "hover:shadow-[0_24px_70px_rgba(0,0,0,0.35)]",
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