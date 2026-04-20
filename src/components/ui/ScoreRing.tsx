import { C } from "@/lib/colors"

interface ScoreRingProps {
  score: number
  size?: number
}

function scoreColor(s: number) {
  if (s >= 80) return C.green
  if (s >= 60) return C.yellow
  return C.red
}

export function ScoreRing({ score, size = 120 }: ScoreRingProps) {
  const r = 45
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ
  const color = scoreColor(score)
  const fontSize = size < 80 ? 18 : size < 100 ? 22 : 28

  return (
    <div style={{ width: size, height: size }} className="relative shrink-0">
      <svg viewBox="0 0 100 100" className="-rotate-90 w-full h-full">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#f0f2f1" strokeWidth="8" />
        <circle
          cx="50" cy="50" r={r}
          fill="none" stroke={color} strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span style={{ fontSize, color }} className="font-bold">{score}</span>
      </div>
    </div>
  )
}
