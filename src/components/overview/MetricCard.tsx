import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

interface MetricCardProps {
  label: string
  value: number | string
  icon: LucideIcon
  description?: string
  variant?: "default" | "warning" | "danger" | "success"
}

const variantColors = {
  default: "text-[#1a2e23]",
  warning: "text-[#a67c00]",
  danger: "text-[#9e2b25]",
  success: "text-[#006c48]",
}

export function MetricCard({ label, value, icon: Icon, description, variant = "default" }: MetricCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={cn("text-2xl font-bold", variantColors[variant])}>{value}</p>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  )
}
