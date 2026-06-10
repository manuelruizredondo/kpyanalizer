import type { ReactNode } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'

interface KpiTrendCardProps {
  title: string
  tooltip?: string
  data: { date: string; value: number; isCurrent?: boolean }[]
  /** Stroke color for the line */
  color?: string
  /** Reference goal line. Defaults to 0. Set to undefined to hide. */
  goal?: number
  goalLabel?: string
  /** Higher is better (e.g. variables). Defaults to false. */
  higherIsBetter?: boolean
  height?: number
}

/**
 * Mini line-chart card for tracking the evolution of a single KPI across scans.
 * Shows: title, latest value, trend badge (▼/▲/=), and a small line chart with a
 * goal reference line.
 */
export function KpiTrendCard({
  title,
  tooltip,
  data,
  color = '#9e2b25',
  goal = 0,
  goalLabel,
  higherIsBetter = false,
  height = 160,
}: KpiTrendCardProps) {
  const safeData = data ?? []
  const first = safeData[0]?.value ?? 0
  const last = safeData[safeData.length - 1]?.value ?? 0
  const diff = last - first
  const pct = first > 0 ? Math.round(((last - first) / first) * 100) : 0

  let trendBadge: ReactNode = null
  if (safeData.length >= 2) {
    if (diff === 0) {
      trendBadge = (
        <Badge className="bg-[#f0f2f1] text-[#3d5a4a] text-[10px] px-1.5 py-0">= sin cambio</Badge>
      )
    } else {
      const isImprovement = higherIsBetter ? diff > 0 : diff < 0
      const arrow = diff < 0 ? '▼' : '▲'
      const colorClass = isImprovement
        ? 'bg-[#e0f5ec] text-[#006c48]'
        : 'bg-[#fef2f1] text-[#9e2b25]'
      // Si partíamos de 0 el porcentaje no tiene sentido (división por cero):
      // mostramos el delta absoluto en su lugar.
      const deltaLabel = first > 0 ? `${Math.abs(pct)}%` : `${diff > 0 ? '+' : ''}${diff}`
      trendBadge = (
        <Badge className={`${colorClass} text-[10px] px-1.5 py-0`}>
          {arrow} {deltaLabel}
        </Badge>
      )
    }
  }

  const resolvedGoalLabel = goalLabel ?? (goal === 0 ? 'Objetivo: 0' : `Ref: ${goal}`)

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <p className="text-xs font-semibold text-[#1a2e23] truncate">{title}</p>
          {tooltip && <InfoTooltip text={tooltip} />}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-sm font-bold" style={{ color }}>
            {last.toLocaleString()}
          </span>
          {trendBadge}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={safeData} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f1" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 9, fill: '#3d5a4a' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 9, fill: '#3d5a4a' }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            width={30}
          />
          <Tooltip
            contentStyle={{
              borderRadius: '8px',
              border: 'none',
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              fontSize: 11,
            }}
            labelStyle={{ fontWeight: 600 }}
          />
          {goal !== undefined && (
            <ReferenceLine
              y={goal}
              stroke="#006c48"
              strokeDasharray="4 3"
              strokeOpacity={0.35}
              label={{ value: resolvedGoalLabel, position: 'right', fontSize: 9, fill: '#006c48' }}
            />
          )}
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={{ r: 2.5, fill: color }}
            activeDot={{ r: 4 }}
            name={title}
          />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  )
}
