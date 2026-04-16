import { cn } from "@/lib/utils"

interface HealthScoreProps {
  score: number
}

function getScoreColor(score: number) {
  if (score >= 80) return { text: "text-green-600", stroke: "#16a34a", bg: "bg-green-50" }
  if (score >= 60) return { text: "text-yellow-600", stroke: "#ca8a04", bg: "bg-yellow-50" }
  if (score >= 40) return { text: "text-orange-600", stroke: "#ea580c", bg: "bg-orange-50" }
  return { text: "text-red-600", stroke: "#dc2626", bg: "bg-red-50" }
}

function getScoreLabel(score: number) {
  if (score >= 80) return "Excelente"
  if (score >= 60) return "Bueno"
  if (score >= 40) return "Regular"
  return "Necesita mejoras"
}

export function HealthScore({ score }: HealthScoreProps) {
  const colors = getScoreColor(score)
  const circumference = 2 * Math.PI * 45
  const offset = circumference - (score / 100) * circumference

  return (
    <div className={cn("flex flex-col items-center gap-3 p-6 rounded-xl", colors.bg)}>
      <p className="text-sm font-medium text-muted-foreground">CSS Health Score</p>
      <div className="relative w-32 h-32">
        <svg className="w-32 h-32 -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50" cy="50" r="45"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-muted/30"
          />
          <circle
            cx="50" cy="50" r="45"
            fill="none"
            stroke={colors.stroke}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn("text-3xl font-bold", colors.text)}>{score}</span>
          <span className="text-xs text-muted-foreground">/100</span>
        </div>
      </div>
      <p className={cn("text-sm font-semibold", colors.text)}>{getScoreLabel(score)}</p>
    </div>
  )
}
