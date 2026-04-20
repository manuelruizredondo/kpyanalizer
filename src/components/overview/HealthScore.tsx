import { cn } from "@/lib/utils"

interface HealthScoreProps {
  score: number
}

function getScoreColor(score: number) {
  if (score >= 80) return { text: "text-[#006c48]", stroke: "#006c48", bg: "bg-white" }
  if (score >= 60) return { text: "text-[#a67c00]", stroke: "#a67c00", bg: "bg-white" }
  if (score >= 40) return { text: "text-[#a67c00]", stroke: "#a67c00", bg: "bg-white" }
  return { text: "text-[#9e2b25]", stroke: "#9e2b25", bg: "bg-white" }
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
            fill="white"
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
