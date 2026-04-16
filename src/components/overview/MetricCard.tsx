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
  default: "text-foreground",
  warning: "text-yellow-600",
  danger: "text-red-600",
  success: "text-green-600",
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
