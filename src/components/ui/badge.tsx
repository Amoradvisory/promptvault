import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const badgeVariants = cva(
  "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-accent/15 text-accent border border-accent/20",
        secondary: "bg-bg-tertiary text-text-secondary border border-border",
        outline: "border border-border text-text-secondary",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  color?: string;
}

function Badge({ className, variant, color, style, ...props }: BadgeProps) {
  const customStyle = color
    ? {
        ...style,
        backgroundColor: `${color}15`,
        color: color,
        borderColor: `${color}30`,
      }
    : style;

  return (
    <span
      className={cn(badgeVariants({ variant: color ? undefined : variant }), className)}
      style={customStyle}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
