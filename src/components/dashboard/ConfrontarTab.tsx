import { useMemo, useState } from 'react'
import type { AnalysisResult, HardcodedValue } from '@/types/analysis'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import { ScoreRing } from '@/components/ui/ScoreRing'
import { C } from '@/lib/colors'
import { classifyFamily } from '@/lib/font-utils'
import {
  Loader2, AlertTriangle, CheckCircle, XCircle,
  Palette, Type, Ruler, Layers, Zap, ShieldCheck, Eye,
} from 'lucide-react'

// ─── Helpers ──────────────────────────────────────────────────────
function SectionTitle({ icon: Icon, title, tooltip, count, severity }: {
  icon: React.ElementType; title: string; tooltip: string; count?: number; severity?: 'good' | 'warn' | 'bad'
}) {
  const sevColor = severity === 'good' ? C.green : severity === 'bad' ? C.red : severity === 'warn' ? C.yellow : C.dark
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon size={20} style={{ color: C.green }} />
      <h3 className="text-lg font-semibold text-[#1a2e23]">{title}</h3>
      <InfoTooltip text={tooltip} />
      {count !== undefined && (
        <Badge className="ml-auto text-xs px-2 py-0.5" style={{
          background: severity === 'good' ? '#e0f5ec' : severity === 'bad' ? '#fef2f1' : '#fef6e0',
          color: sevColor,
        }}>
          {count} {severity === 'good' ? '✓' : 'encontrados'}
        </Badge>
      )}
    </div>
  )
}

/** Extract CSS custom properties from raw CSS */
function extractCssVars(raw: string): Map<string, string> {
  const vars = new Map<string, string>()
  const regex = /--([\w-]+)\s*:\s*([^;]+)/g
  let m
  while ((m = regex.exec(raw)) !== null) {
    vars.set(`--${m[1]}`, m[2].trim())
  }
  return vars
}

/** Normalize a color value for comparison (lowercase, strip spaces) */
function normColor(v: string): string {
  return v.toLowerCase().replace(/\s+/g, '').replace(/0\./g, '.')
}

// ─── Main Component ──────────────────────────────────────────────
interface ConfrontarTabProps {
  hg5Result: AnalysisResult | null
  userResult: AnalysisResult | undefined
  hg5Loading: boolean
  hg5Error: string | null
  onRetry: () => void
}

export function ConfrontarTab({ hg5Result, userResult, hg5Loading, hg5Error, onRetry }: ConfrontarTabProps) {
  // ── Loading / Error states ──
  if (hg5Loading) {
    return (
      <div className="flex items-center justify-center py-24 gap-3">
        <Loader2 className="animate-spin text-[#006c48]" size={24} />
        <p className="text-[#3d5a4a]">Descargando y analizando CSS de HG5...</p>
      </div>
    )
  }

  if (hg5Error) {
    return (
      <Card className="p-6 text-center">
        <AlertTriangle size={32} className="mx-auto mb-3 text-[#9e2b25]" />
        <p className="text-sm text-[#9e2b25] mb-3">{hg5Error}</p>
        <Button size="sm" variant="outline" onClick={onRetry}>Reintentar</Button>
      </Card>
    )
  }

  if (!hg5Result) return null

  if (!userResult) {
    return (
      <Card className="p-8 text-center">
        <Info size={32} className="mx-auto mb-3 text-[#3d5a4a]/30" />
        <p className="text-sm text-[#3d5a4a]">No hay escaneos para comparar. Guarda un escaneo desde "Analizar" primero.</p>
      </Card>
    )
  }

  return <AuditContent hg5={hg5Result} user={userResult} onRetry={onRetry} />
}

// ─── Audit Content (memoized heavy computation) ──────────────────
function AuditContent({ hg5, user, onRetry }: { hg5: AnalysisResult; user: AnalysisResult; onRetry: () => void }) {
  const [showAllOverrides, setShowAllOverrides] = useState(false)
  const [showAllImportants, setShowAllImportants] = useState(false)

  // ══════════════════════════════════════════════════════════════════
  // ANALYSIS: compute all audit data
  // ══════════════════════════════════════════════════════════════════
  const audit = useMemo(() => {
    // ── CSS Variables ──
    const hg5Vars = extractCssVars(hg5.raw)
    const userVars = extractCssVars(user.raw)
    const hg5ColorVars = new Map<string, string>()
    const hg5SpacingVars = new Map<string, string>()
    const hg5FontVars = new Map<string, string>()
    const hg5OtherVars = new Map<string, string>()

    for (const [name, value] of hg5Vars) {
      const lName = name.toLowerCase()
      if (/color|bg|border-color|shadow|fill|stroke/i.test(lName) || /^#|rgb|hsl/i.test(value)) {
        hg5ColorVars.set(name, value)
      } else if (/space|gap|margin|padding|size|radius|width|height/i.test(lName)) {
        hg5SpacingVars.set(name, value)
      } else if (/font|text|letter|line-height|weight/i.test(lName)) {
        hg5FontVars.set(name, value)
      } else {
        hg5OtherVars.set(name, value)
      }
    }

    // ── Colors Audit ──
    const hg5ColorSet = new Set(hg5.colors.map(c => normColor(c.normalized)))
    // Also add colors from CSS variables
    for (const v of hg5ColorVars.values()) {
      hg5ColorSet.add(normColor(v))
    }
    const authorizedColors = user.colors.filter(c => hg5ColorSet.has(normColor(c.normalized)))
    const unauthorizedColors = user.colors.filter(c => !hg5ColorSet.has(normColor(c.normalized)))

    // ── Font Families Audit ──
    const hg5FamilySet = new Set(hg5.fontFamilies.map(f => f.normalized.toLowerCase().replace(/['"]/g, '').trim()))
    const authorizedFamilies = user.fontFamilies.filter(f => hg5FamilySet.has(f.normalized.toLowerCase().replace(/['"]/g, '').trim()))
    const unauthorizedFamilies = user.fontFamilies.filter(f => !hg5FamilySet.has(f.normalized.toLowerCase().replace(/['"]/g, '').trim()))

    // ── Font Weights Audit ──
    const hg5WeightSet = new Set(hg5.fontWeights.map(w => w.normalized))
    const authorizedWeights = user.fontWeights.filter(w => hg5WeightSet.has(w.normalized))
    const unauthorizedWeights = user.fontWeights.filter(w => !hg5WeightSet.has(w.normalized))

    // ── Font Sizes Audit ──
    const hg5SizeSet = new Set(hg5.fontSizes.map(s => s.normalized))
    const authorizedSizes = user.fontSizes.filter(s => hg5SizeSet.has(s.normalized))
    const unauthorizedSizes = user.fontSizes.filter(s => !hg5SizeSet.has(s.normalized))

    // ── Spacing Audit ──
    const hg5SpacingSet = new Set(hg5.spacingValues.map(s => s.normalized))
    const authorizedSpacing = user.spacingValues.filter(s => hg5SpacingSet.has(s.normalized))
    const unauthorizedSpacing = user.spacingValues.filter(s => !hg5SpacingSet.has(s.normalized))

    // ── Z-index Audit ──
    const hg5ZSet = new Set(hg5.zIndexValues.map(z => z.value))
    const unauthorizedZ = user.zIndexValues.filter(z => !hg5ZSet.has(z.value))

    // ── Selector Overrides (machaques) ──
    const hg5SelectorSet = new Set(hg5.specificityDistribution.map(s => s.selector.trim()))
    const overriddenSelectors = user.specificityDistribution.filter(s => hg5SelectorSet.has(s.selector.trim()))

    // ── !important audit ──
    const importantsInUser = user.importants || []

    // ── Substitution suggestions: match user hardcoded values → HG5 variables ──
    // Build reverse lookup: normalized value → variable name(s)
    const hg5ValueToVar = new Map<string, string[]>()
    for (const [name, value] of hg5Vars) {
      const nv = normColor(value)
      const existing = hg5ValueToVar.get(nv) || []
      existing.push(name)
      hg5ValueToVar.set(nv, existing)
    }

    // Prioritize semantic variable names over literal/descriptive ones.
    // e.g. --hg-color-primary over --hg-color-black for #000000
    const LITERAL_HINTS = /black|white|grey|gray|red|blue|green|yellow|orange|pink|purple|transparent|-\d{2,3}$/i
    function pickBestVar(vars: string[]): string {
      if (vars.length <= 1) return vars[0]
      const semantic = vars.filter(v => !LITERAL_HINTS.test(v))
      return semantic.length > 0 ? semantic[0] : vars[0]
    }

    // Color substitutions
    type Substitution = { userValue: string; hg5Var: string; hg5VarValue: string; count: number; locations: typeof user.colors[0]['locations'] }
    const colorSubstitutions: Substitution[] = []
    for (const c of user.colors) {
      const nv = normColor(c.normalized)
      const vars = hg5ValueToVar.get(nv)
      if (vars && vars.length > 0) {
        colorSubstitutions.push({ userValue: c.normalized, hg5Var: pickBestVar(vars), hg5VarValue: c.normalized, count: c.count, locations: c.locations })
      }
    }

    // Spacing substitutions
    const spacingSubstitutions: Substitution[] = []
    for (const s of user.spacingValues) {
      const nv = s.normalized.toLowerCase().trim()
      const vars = hg5ValueToVar.get(nv)
      if (vars && vars.length > 0) {
        spacingSubstitutions.push({ userValue: s.normalized, hg5Var: pickBestVar(vars), hg5VarValue: s.normalized, count: s.count, locations: s.locations })
      }
    }

    // Font-size substitutions
    const fontSizeSubstitutions: Substitution[] = []
    for (const fs of user.fontSizes) {
      const nv = fs.normalized.toLowerCase().trim()
      const vars = hg5ValueToVar.get(nv)
      if (vars && vars.length > 0) {
        fontSizeSubstitutions.push({ userValue: fs.normalized, hg5Var: pickBestVar(vars), hg5VarValue: fs.normalized, count: fs.count, locations: fs.locations })
      }
    }

    // ── Compliance score ──
    const totalUserColors = user.colors.length || 1
    const totalUserFamilies = user.fontFamilies.length || 1
    const totalUserWeights = user.fontWeights.length || 1
    const totalUserSizes = user.fontSizes.length || 1
    const totalUserSpacing = user.spacingValues.length || 1

    const colorCompliance = Math.round((authorizedColors.length / totalUserColors) * 100)
    const familyCompliance = Math.round((authorizedFamilies.length / totalUserFamilies) * 100)
    const weightCompliance = Math.round((authorizedWeights.length / totalUserWeights) * 100)
    const sizeCompliance = Math.round((authorizedSizes.length / totalUserSizes) * 100)
    const spacingCompliance = Math.round((authorizedSpacing.length / totalUserSpacing) * 100)
    const overallCompliance = Math.round((colorCompliance + familyCompliance + weightCompliance + sizeCompliance + spacingCompliance) / 5)

    return {
      hg5Vars, userVars,
      hg5ColorVars, hg5SpacingVars, hg5FontVars, hg5OtherVars,
      authorizedColors, unauthorizedColors,
      authorizedFamilies, unauthorizedFamilies,
      authorizedWeights, unauthorizedWeights,
      authorizedSizes, unauthorizedSizes,
      authorizedSpacing, unauthorizedSpacing,
      unauthorizedZ,
      overriddenSelectors,
      importantsInUser,
      colorCompliance, familyCompliance, weightCompliance, sizeCompliance, spacingCompliance,
      overallCompliance,
      colorSubstitutions, spacingSubstitutions, fontSizeSubstitutions,
    }
  }, [hg5, user])

  const {
    hg5Vars, userVars,
    hg5ColorVars, hg5SpacingVars, hg5FontVars,
    authorizedColors, unauthorizedColors,
    authorizedFamilies, unauthorizedFamilies,
    authorizedWeights, unauthorizedWeights,
    authorizedSizes, unauthorizedSizes,
    authorizedSpacing, unauthorizedSpacing,
    unauthorizedZ,
    overriddenSelectors,
    importantsInUser,
    colorCompliance, familyCompliance, weightCompliance, sizeCompliance, spacingCompliance,
    overallCompliance,
    colorSubstitutions, spacingSubstitutions, fontSizeSubstitutions,
  } = audit

  const compSev = (v: number): 'good' | 'warn' | 'bad' => v >= 80 ? 'good' : v >= 50 ? 'warn' : 'bad'

  return (
    <div className="space-y-8">

      {/* ══════════════════════════════════════════════════════════════
           HERO: Overall compliance
         ══════════════════════════════════════════════════════════════ */}
      <Card className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-lg font-semibold text-[#1a2e23]">Auditoría de cumplimiento con HG5</h2>
              <InfoTooltip text="Compara tu CSS contra output.css + dutti.css de HG5. Detecta colores, tipografías, spacing y selectores que no están en el framework." />
            </div>
            <p className="text-sm text-[#3d5a4a]">
              ¿Tu CSS sigue la guía de estilos del framework?
            </p>

            {/* Category scores */}
            <div className="grid grid-cols-5 gap-3 mt-5">
              {[
                { label: 'Colores', value: colorCompliance, icon: Palette },
                { label: 'Familias', value: familyCompliance, icon: Type },
                { label: 'Pesos', value: weightCompliance, icon: Type },
                { label: 'Tamaños', value: sizeCompliance, icon: Ruler },
                { label: 'Spacing', value: spacingCompliance, icon: Layers },
              ].map(({ label, value, icon: Icon }) => {
                const sev = compSev(value)
                const color = sev === 'good' ? C.green : sev === 'warn' ? C.yellow : C.red
                return (
                  <div key={label} className="text-center p-3 rounded-xl" style={{ background: `${color}08` }}>
                    <Icon size={16} className="mx-auto mb-1" style={{ color }} />
                    <p className="text-xl font-bold" style={{ color }}>{value}%</p>
                    <p className="text-[9px] text-[#3d5a4a]">{label}</p>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="flex flex-col items-center gap-2 ml-6">
            <ScoreRing score={overallCompliance} size={110} />
            <p className="text-[10px] uppercase tracking-wider font-semibold text-[#3d5a4a]">Cumplimiento</p>
            <Button size="sm" variant="outline" className="text-xs h-7" onClick={onRetry}>
              Refrescar HG5
            </Button>
          </div>
        </div>
      </Card>

      {/* ══════════════════════════════════════════════════════════════
           1. COLORES
         ══════════════════════════════════════════════════════════════ */}
      <Card className="p-6">
        <SectionTitle
          icon={Palette}
          title="Auditoría de Colores"
          tooltip="Colores en tu CSS que NO existen en el framework HG5. Estos deberían usar variables del tema o ser eliminados."
          count={unauthorizedColors.length}
          severity={unauthorizedColors.length === 0 ? 'good' : unauthorizedColors.length > 20 ? 'bad' : 'warn'}
        />

        {/* Summary bar */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-3 bg-[#f0f2f1] rounded-full overflow-hidden flex">
            <div className="h-full bg-[#006c48] transition-all" style={{ width: `${colorCompliance}%` }} />
            <div className="h-full bg-[#9e2b25]" style={{ width: `${100 - colorCompliance}%` }} />
          </div>
          <span className="text-xs text-[#3d5a4a] shrink-0">{authorizedColors.length} ok / {unauthorizedColors.length} fuera</span>
        </div>

        {unauthorizedColors.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-[#9e2b25] uppercase tracking-wider">Colores fuera de la guía ({unauthorizedColors.length})</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {[...unauthorizedColors].sort((a, b) => b.count - a.count).slice(0, 30).map((c, i) => (
                <div key={i} className="flex items-center gap-2 p-2 rounded-lg border" style={{ borderColor: 'rgba(158, 43, 37, 0.15)' }}>
                  <div className="w-8 h-8 rounded border border-[#f0f2f1] shrink-0" style={{ backgroundColor: c.normalized }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-mono text-[#1a2e23] truncate">{c.normalized}</p>
                    <p className="text-[10px] text-[#9e2b25]">{c.count} usos</p>
                  </div>
                  {c.locations.length > 0 && (
                    <span className="text-[9px] text-[#3d5a4a] shrink-0">L{c.locations[0].line}</span>
                  )}
                </div>
              ))}
            </div>
            {unauthorizedColors.length > 30 && (
              <p className="text-xs text-[#3d5a4a]">+{unauthorizedColors.length - 30} más...</p>
            )}
          </div>
        )}

        {/* HG5 palette reference */}
        <div className="mt-5 pt-4 border-t border-[#f0f2f1]">
          <p className="text-[10px] uppercase tracking-wider font-semibold text-[#3d5a4a] mb-2">Paleta HG5 ({hg5.colors.length} colores en el framework)</p>
          <div className="flex flex-wrap gap-1">
            {[...hg5.colors].sort((a, b) => b.count - a.count).slice(0, 40).map((c, i) => (
              <div key={i} className="w-5 h-5 rounded-sm border border-[#f0f2f1]" style={{ backgroundColor: c.normalized }} title={`${c.normalized} (${c.count}x)`} />
            ))}
            {hg5.colors.length > 40 && <span className="text-[9px] text-[#3d5a4a] self-center ml-1">+{hg5.colors.length - 40}</span>}
          </div>
        </div>
      </Card>

      {/* ══════════════════════════════════════════════════════════════
           2. TIPOGRAFÍA: Familias
         ══════════════════════════════════════════════════════════════ */}
      <Card className="p-6">
        <SectionTitle
          icon={Type}
          title="Auditoría de Tipografía"
          tooltip="Font families, weights y sizes en tu CSS que no están definidos en HG5."
          count={unauthorizedFamilies.length + unauthorizedWeights.length + unauthorizedSizes.length}
          severity={unauthorizedFamilies.length + unauthorizedWeights.length + unauthorizedSizes.length === 0 ? 'good' : 'bad'}
        />

        {/* Font Families */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Unauthorized families */}
          <div>
            <p className="text-xs font-semibold text-[#1a2e23] mb-2">Font Families en tu CSS</p>
            <div className="space-y-1.5">
              {[...user.fontFamilies].sort((a, b) => b.count - a.count).map((f, i) => {
                const inHg5 = hg5.fontFamilies.some(h => h.normalized.toLowerCase().replace(/['"]/g, '').trim() === f.normalized.toLowerCase().replace(/['"]/g, '').trim())
                const cls = classifyFamily(f.normalized)
                const isOk = inHg5 || cls === 'generic'
                return (
                  <div key={i} className="flex items-center gap-2 p-2 rounded-lg" style={{ background: isOk ? '#f8f9fa' : '#fef2f1' }}>
                    {isOk ? <CheckCircle size={14} className="text-[#006c48] shrink-0" /> : <XCircle size={14} className="text-[#9e2b25] shrink-0" />}
                    <span className="text-xs font-mono truncate flex-1" style={{ color: isOk ? C.dark : C.red }}>{f.normalized.replace(/['"]/g, '')}</span>
                    <span className="text-xs font-bold text-[#1a2e23]">{f.count}x</span>
                    {!inHg5 && cls !== 'generic' && <Badge className="text-[9px] px-1 py-0 bg-[#fef2f1] text-[#9e2b25]">No HG5</Badge>}
                    {inHg5 && <Badge className="text-[9px] px-1 py-0 bg-[#e0f5ec] text-[#006c48]">HG5</Badge>}
                  </div>
                )
              })}
            </div>
          </div>

          {/* HG5 font families reference */}
          <div>
            <p className="text-xs font-semibold text-[#1a2e23] mb-2">Font Families en HG5 (referencia)</p>
            <div className="space-y-1.5">
              {[...hg5.fontFamilies].sort((a, b) => b.count - a.count).map((f, i) => {
                const cls = classifyFamily(f.normalized)
                const color = cls === 'ds' ? C.green : cls === 'generic' ? C.yellow : C.red
                return (
                  <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-[#f8f9fa]">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                    <span className="text-xs font-mono truncate flex-1" style={{ color }}>{f.normalized.replace(/['"]/g, '')}</span>
                    <span className="text-xs font-bold text-[#1a2e23]">{f.count}x</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Font Weights */}
        <div className="mt-6 pt-4 border-t border-[#f0f2f1]">
          <p className="text-xs font-semibold text-[#1a2e23] mb-3">Font Weights</p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[#3d5a4a] mb-2">Tu CSS</p>
              <div className="flex flex-wrap gap-2">
                {[...user.fontWeights].sort((a, b) => (parseInt(a.normalized) || 0) - (parseInt(b.normalized) || 0)).map((w, i) => {
                  const inHg5 = hg5.fontWeights.some(h => h.normalized === w.normalized)
                  return (
                    <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border" style={{
                      background: inHg5 ? '#e0f5ec' : '#fef2f1',
                      color: inHg5 ? C.green : C.red,
                      borderColor: inHg5 ? 'rgba(0,108,72,0.15)' : 'rgba(158,43,37,0.15)',
                    }}>
                      <span className="font-bold">{w.normalized}</span>
                      <span className="opacity-60">{w.count}x</span>
                      {!inHg5 && <XCircle size={11} />}
                    </span>
                  )
                })}
              </div>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[#3d5a4a] mb-2">HG5 (referencia)</p>
              <div className="flex flex-wrap gap-2">
                {[...hg5.fontWeights].sort((a, b) => (parseInt(a.normalized) || 0) - (parseInt(b.normalized) || 0)).map((w, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs bg-[#f8f9fa] text-[#1a2e23]">
                    <span className="font-bold">{w.normalized}</span>
                    <span className="opacity-50">{w.count}x</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Font Sizes */}
        {unauthorizedSizes.length > 0 && (
          <div className="mt-6 pt-4 border-t border-[#f0f2f1]">
            <p className="text-xs font-semibold text-[#9e2b25] mb-2">Font Sizes fuera de HG5 ({unauthorizedSizes.length})</p>
            <div className="flex flex-wrap gap-2">
              {[...unauthorizedSizes].sort((a, b) => b.count - a.count).slice(0, 20).map((s, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-[#fef2f1] text-[#9e2b25] font-mono">
                  {s.normalized} <span className="opacity-60">({s.count}x)</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* ══════════════════════════════════════════════════════════════
           3. SPACING
         ══════════════════════════════════════════════════════════════ */}
      <Card className="p-6">
        <SectionTitle
          icon={Ruler}
          title="Auditoría de Spacing"
          tooltip="Valores de margin, padding, gap, etc. en tu CSS que no existen en HG5."
          count={unauthorizedSpacing.length}
          severity={compSev(spacingCompliance)}
        />

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-3 bg-[#f0f2f1] rounded-full overflow-hidden flex">
            <div className="h-full bg-[#006c48] transition-all" style={{ width: `${spacingCompliance}%` }} />
            <div className="h-full bg-[#9e2b25]" style={{ width: `${100 - spacingCompliance}%` }} />
          </div>
          <span className="text-xs text-[#3d5a4a] shrink-0">{authorizedSpacing.length} ok / {unauthorizedSpacing.length} fuera</span>
        </div>

        {unauthorizedSpacing.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-[#9e2b25] mb-2">Spacing fuera de HG5</p>
            <div className="flex flex-wrap gap-1.5">
              {[...unauthorizedSpacing].sort((a, b) => b.count - a.count).slice(0, 30).map((s, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-mono" style={{
                  background: '#fef2f1', color: C.red,
                }}>
                  {s.normalized} <span className="opacity-50">({s.count}x)</span>
                </span>
              ))}
              {unauthorizedSpacing.length > 30 && <span className="text-[10px] text-[#3d5a4a] self-center">+{unauthorizedSpacing.length - 30}</span>}
            </div>
          </div>
        )}

        {/* HG5 spacing scale reference */}
        <div className="mt-4 pt-3 border-t border-[#f0f2f1]">
          <p className="text-[10px] uppercase tracking-wider font-semibold text-[#3d5a4a] mb-2">Escala HG5 (top 20)</p>
          <div className="flex flex-wrap gap-1.5">
            {[...hg5.spacingValues].sort((a, b) => b.count - a.count).slice(0, 20).map((s, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-mono bg-[#e0f5ec] text-[#006c48]">
                {s.normalized} <span className="opacity-50">({s.count}x)</span>
              </span>
            ))}
          </div>
        </div>
      </Card>

      {/* ══════════════════════════════════════════════════════════════
           4. SELECTOR OVERRIDES (MACHAQUES)
         ══════════════════════════════════════════════════════════════ */}
      <Card className="p-6">
        <SectionTitle
          icon={ShieldCheck}
          title="Selectores Sobreescritos (Machaques)"
          tooltip="Selectores de tu CSS que también existen en HG5. Esto significa que estás sobreescribiendo estilos del framework — puede ser intencional o un machaque no deseado."
          count={overriddenSelectors.length}
          severity={overriddenSelectors.length === 0 ? 'good' : overriddenSelectors.length > 50 ? 'bad' : 'warn'}
        />

        {overriddenSelectors.length > 0 ? (
          <div>
            <p className="text-xs text-[#3d5a4a] mb-3">
              Tu CSS redefine <span className="font-bold text-[#a67c00]">{overriddenSelectors.length}</span> selectores que ya existen en HG5. Revisa si son machaques necesarios o código legacy.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b" style={{ borderColor: 'rgba(11, 31, 22, 0.08)' }}>
                    <th className="text-left py-2 pr-3 text-[11px] font-medium text-[#52695b] uppercase tracking-wider">Selector</th>
                    <th className="text-right py-2 pr-3 text-[11px] font-medium text-[#52695b] uppercase tracking-wider">
                      <span className="inline-flex items-center gap-1">Especificidad <InfoTooltip text="Formato (a,b,c): a = IDs, b = clases/atributos/pseudo-clases, c = elementos/pseudo-elementos. Mayor valor = mayor prioridad en la cascada CSS." /></span>
                    </th>
                    <th className="text-right py-2 text-[11px] font-medium text-[#52695b] uppercase tracking-wider">Línea</th>
                  </tr>
                </thead>
                <tbody>
                  {(showAllOverrides ? overriddenSelectors : overriddenSelectors.slice(0, 50)).map((s, i) => (
                    <tr key={i} className="border-b last:border-0" style={{ borderColor: 'rgba(11, 31, 22, 0.05)' }}>
                      <td className="py-1.5 pr-3">
                        <span className="text-xs font-mono text-[#a67c00] truncate block max-w-[400px]">{s.selector}</span>
                      </td>
                      <td className="py-1.5 pr-3 text-right text-xs font-mono text-[#3d5a4a]">{s.specificity.join(',')}</td>
                      <td className="py-1.5 text-right text-xs text-[#3d5a4a]">{s.line}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {overriddenSelectors.length > 50 && (
                <div className="mt-3 text-center">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-7"
                    onClick={() => setShowAllOverrides(!showAllOverrides)}
                  >
                    {showAllOverrides
                      ? 'Mostrar solo 50'
                      : `Ver todos (${overriddenSelectors.length})`}
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-6">
            <CheckCircle size={32} className="mx-auto mb-2 text-[#006c48]" />
            <p className="text-sm font-medium text-[#006c48]">Sin machaques detectados</p>
          </div>
        )}
      </Card>

      {/* ══════════════════════════════════════════════════════════════
           5. !IMPORTANT
         ══════════════════════════════════════════════════════════════ */}
      <Card className="p-6">
        <SectionTitle
          icon={AlertTriangle}
          title="Uso de !important"
          tooltip="!important en tu CSS fuerza la prioridad sobre HG5. Cada uso indica un posible machaque o conflicto con el framework."
          count={user.importantCount}
          severity={user.importantCount === 0 ? 'good' : user.importantCount > 20 ? 'bad' : 'warn'}
        />

        {importantsInUser.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: 'rgba(11, 31, 22, 0.08)' }}>
                  <th className="text-left py-2 pr-3 text-[11px] font-medium text-[#52695b] uppercase">Propiedad</th>
                  <th className="text-left py-2 pr-3 text-[11px] font-medium text-[#52695b] uppercase">Selector</th>
                  <th className="text-right py-2 text-[11px] font-medium text-[#52695b] uppercase">Línea</th>
                </tr>
              </thead>
              <tbody>
                {(showAllImportants ? importantsInUser : importantsInUser.slice(0, 50)).map((imp, i) => (
                  <tr key={i} className="border-b last:border-0" style={{ borderColor: 'rgba(11, 31, 22, 0.05)' }}>
                    <td className="py-1.5 pr-3 text-xs font-mono text-[#9e2b25]">{imp.property}</td>
                    <td className="py-1.5 pr-3 text-xs font-mono text-[#3d5a4a] truncate max-w-[300px]">{imp.selector}</td>
                    <td className="py-1.5 text-right text-xs text-[#3d5a4a]">{imp.line}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {importantsInUser.length > 50 && (
              <div className="mt-3 text-center">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-7"
                  onClick={() => setShowAllImportants(!showAllImportants)}
                >
                  {showAllImportants
                    ? 'Mostrar solo 50'
                    : `Ver todos (${importantsInUser.length})`}
                </Button>
              </div>
            )}
          </div>
        ) : user.importantCount > 0 ? (
          <p className="text-sm text-[#a67c00]">{user.importantCount} usos de !important detectados en tu CSS.</p>
        ) : (
          <div className="text-center py-6">
            <CheckCircle size={32} className="mx-auto mb-2 text-[#006c48]" />
            <p className="text-sm font-medium text-[#006c48]">Sin !important — excelente</p>
          </div>
        )}
      </Card>

      {/* ══════════════════════════════════════════════════════════════
           6. CSS VARIABLES
         ══════════════════════════════════════════════════════════════ */}
      <Card className="p-6">
        <SectionTitle
          icon={Zap}
          title="CSS Variables (Tokens)"
          tooltip="Variables CSS (--custom-properties) definidas en HG5 vs las que usas tú. Las variables de HG5 son los tokens oficiales del framework."
        />

        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="text-center p-3 bg-[#f8f9fa] rounded-xl">
            <p className="text-2xl font-bold text-[#1a2e23]">{hg5Vars.size}</p>
            <p className="text-[10px] text-[#3d5a4a]">Variables HG5</p>
          </div>
          <div className="text-center p-3 bg-[#f8f9fa] rounded-xl">
            <p className="text-2xl font-bold text-[#1a2e23]">{userVars.size}</p>
            <p className="text-[10px] text-[#3d5a4a]">Variables tu CSS</p>
          </div>
          <div className="text-center p-3 bg-[#f8f9fa] rounded-xl">
            <p className="text-2xl font-bold text-[#006c48]">{user.variableCount}</p>
            <p className="text-[10px] text-[#3d5a4a]">Usos de var()</p>
          </div>
        </div>

        {/* HG5 variable categories */}
        <div className="space-y-3">
          {[
            { label: 'Color tokens', vars: hg5ColorVars, color: C.green },
            { label: 'Typography tokens', vars: hg5FontVars, color: C.dark },
            { label: 'Spacing tokens', vars: hg5SpacingVars, color: C.yellow },
          ].map(({ label, vars, color }) => vars.size > 0 && (
            <details key={label} className="group">
              <summary className="flex items-center gap-2 cursor-pointer py-1.5 text-xs font-semibold text-[#1a2e23] hover:text-[#006c48] transition-colors">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                {label} ({vars.size})
                <Eye size={12} className="ml-auto opacity-0 group-hover:opacity-50 transition-opacity" />
              </summary>
              <div className="mt-2 space-y-1 pl-4">
                {Array.from(vars).map(([name, value], i) => (
                  <div key={i} className="flex items-center gap-2 text-[11px] font-mono py-0.5">
                    <span className="text-[#006c48] truncate max-w-[200px]">{name}</span>
                    <span className="text-[#3d5a4a]/30">:</span>
                    <span className="text-[#3d5a4a] truncate">{value}</span>
                    {/^#|rgb|hsl/.test(value) && (
                      <span className="w-3 h-3 rounded-sm border border-[#f0f2f1] shrink-0" style={{ backgroundColor: value.split(' ')[0] }} />
                    )}
                  </div>
                ))}
              </div>
            </details>
          ))}
        </div>
      </Card>

      {/* ══════════════════════════════════════════════════════════════
           6.5 SUGERENCIAS DE SUSTITUCIÓN
         ══════════════════════════════════════════════════════════════ */}
      {(colorSubstitutions.length > 0 || spacingSubstitutions.length > 0 || fontSizeSubstitutions.length > 0) && (
        <Card className="p-6">
          <SectionTitle
            icon={Zap}
            title="Sugerencias de Sustitución"
            tooltip="Valores hardcodeados en tu CSS que coinciden con variables de HG5. Sustitúyelos por var(--nombre) para eliminar redundancia y mantener coherencia con el design system."
            count={colorSubstitutions.length + spacingSubstitutions.length + fontSizeSubstitutions.length}
            severity="warn"
          />

          <p className="text-xs text-[#3d5a4a] mb-4">
            Estos valores hardcodeados ya existen como variables en HG5. Reemplázalos por <code className="px-1 py-0.5 rounded bg-[#e0f5ec] text-[#006c48] text-[11px]">var(--nombre)</code> para reducir redundancia.
          </p>

          {/* Color substitutions */}
          {colorSubstitutions.length > 0 && (
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-2">
                <Palette size={14} style={{ color: C.green }} />
                <p className="text-xs font-semibold text-[#1a2e23]">Colores ({colorSubstitutions.length})</p>
              </div>
              <div className="space-y-1">
                {[...colorSubstitutions].sort((a, b) => b.count - a.count).map((sub, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#fef6e0]/50 border border-[#a67c00]/10">
                    <div className="w-5 h-5 rounded border border-[#f0f2f1] shrink-0" style={{ backgroundColor: sub.userValue }} />
                    <span className="text-[11px] font-mono text-[#9e2b25] shrink-0">{sub.userValue}</span>
                    <span className="text-[11px] text-[#3d5a4a]">→</span>
                    <span className="text-[11px] font-mono text-[#006c48] font-semibold truncate">var({sub.hg5Var})</span>
                    <span className="text-[10px] text-[#3d5a4a] ml-auto shrink-0">{sub.count}x</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Spacing substitutions */}
          {spacingSubstitutions.length > 0 && (
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-2">
                <Ruler size={14} style={{ color: C.green }} />
                <p className="text-xs font-semibold text-[#1a2e23]">Spacing ({spacingSubstitutions.length})</p>
              </div>
              <div className="space-y-1">
                {[...spacingSubstitutions].sort((a, b) => b.count - a.count).map((sub, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#fef6e0]/50 border border-[#a67c00]/10">
                    <span className="text-[11px] font-mono text-[#9e2b25] shrink-0">{sub.userValue}</span>
                    <span className="text-[11px] text-[#3d5a4a]">→</span>
                    <span className="text-[11px] font-mono text-[#006c48] font-semibold truncate">var({sub.hg5Var})</span>
                    <span className="text-[10px] text-[#3d5a4a] ml-auto shrink-0">{sub.count}x</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Font size substitutions */}
          {fontSizeSubstitutions.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Type size={14} style={{ color: C.green }} />
                <p className="text-xs font-semibold text-[#1a2e23]">Font Sizes ({fontSizeSubstitutions.length})</p>
              </div>
              <div className="space-y-1">
                {[...fontSizeSubstitutions].sort((a, b) => b.count - a.count).map((sub, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#fef6e0]/50 border border-[#a67c00]/10">
                    <span className="text-[11px] font-mono text-[#9e2b25] shrink-0">{sub.userValue}</span>
                    <span className="text-[11px] text-[#3d5a4a]">→</span>
                    <span className="text-[11px] font-mono text-[#006c48] font-semibold truncate">var({sub.hg5Var})</span>
                    <span className="text-[10px] text-[#3d5a4a] ml-auto shrink-0">{sub.count}x</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* ══════════════════════════════════════════════════════════════
           7. Z-INDEX (full depth analysis)
         ══════════════════════════════════════════════════════════════ */}
      {user.zIndexValues.length > 0 && (() => {
        const DEPTH_DEFS: Record<number, { name: string; desc: string }> = {
          [-1]:  { name: 'Negativos',          desc: 'Elementos ocultos detras del contenido base, fondos decorativos'                },
          0:     { name: 'Contenido base',     desc: 'Flujo normal del documento, elementos inline, texto, imagenes'                  },
          1000:  { name: 'Elementos elevados', desc: 'Cards flotantes, badges, elementos con sombra que necesitan sobresalir'         },
          2000:  { name: 'Dropdowns y popups', desc: 'Menus desplegables, selects abiertos, autocompletado, popovers'                },
          3000:  { name: 'Headers y barras',   desc: 'Headers fijos (sticky), barras de navegacion, toolbars persistentes'            },
          4000:  { name: 'Sidebars y drawers', desc: 'Paneles laterales, drawers deslizantes, navegacion off-canvas'                  },
          5000:  { name: 'Overlays',           desc: 'Fondos oscuros (backdrop), capas semi-transparentes detras de modales'          },
          6000:  { name: 'Modales y dialogos', desc: 'Ventanas modales, dialogos de confirmacion, lightboxes'                        },
          7000:  { name: 'Tooltips y toasts',  desc: 'Tooltips, notificaciones toast, snackbars, hints flotantes'                     },
          8000:  { name: 'Alertas criticas',   desc: 'Banners de error critico, alertas de sesion expirada, avisos legales'           },
          9000:  { name: 'Sistema / max',      desc: 'Loaders a pantalla completa, splash screens, debuggers, reservado para el sistema' },
        }
        const UNKNOWN_DEPTH = { name: 'Fuera de rango', desc: 'Valores excesivamente altos que rompen la escala. Deben reducirse.' }

        const parsed = user.zIndexValues.map(item => ({ ...item, num: parseInt(item.value, 10) })).filter(p => !isNaN(p.num))
        const negatives = parsed.filter(p => p.num < 0)
        const positives = parsed.filter(p => p.num >= 0)
        const isCorrect = (n: number) => n === 0 || (n > 0 && n % 1000 === 0)
        const irregularCount = parsed.filter(p => !isCorrect(p.num)).length

        // Group positives by depth
        const depthMap = new Map<number, typeof parsed>()
        for (const p of positives) {
          const depth = Math.floor(p.num / 1000) * 1000
          if (!depthMap.has(depth)) depthMap.set(depth, [])
          depthMap.get(depth)!.push(p)
        }
        const allKeys = new Set([...depthMap.keys(), 0, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000])
        const depths = [...allKeys].sort((a, b) => a - b).map(d => ({
          depth: d, label: `${d} – ${d + 999}`,
          values: (depthMap.get(d) || []).sort((a, b) => a.num - b.num),
          def: DEPTH_DEFS[d] || UNKNOWN_DEPTH,
        }))

        return (
          <Card className="p-6">
            <SectionTitle
              icon={Layers}
              title="Z-index Hardcodeado"
              tooltip="El z-index debería ir de 1000 en 1000. Cada rango está reservado para un tipo de elemento UI. Valores intermedios rompen la escala."
              count={user.zIndexValues.length}
              severity={irregularCount > 10 ? 'bad' : irregularCount > 0 ? 'warn' : 'good'}
            />

            <p className="text-xs text-[#3d5a4a] mb-3">
              El z-index debería ir de 1000 en 1000. Cada rango está reservado para un tipo de elemento UI.
              Valores intermedios rompen la escala y generan conflictos de apilamiento.
            </p>

            {irregularCount > 0 && (
              <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-[#fef2f1] rounded-lg">
                <AlertTriangle size={14} className="text-[#9e2b25] shrink-0" />
                <p className="text-xs text-[#9e2b25]">
                  <strong>{irregularCount}</strong> valor{irregularCount !== 1 ? 'es' : ''} no sigue{irregularCount === 1 ? '' : 'n'} la escala de miles — deben ajustarse al múltiplo de 1000 más cercano
                </p>
              </div>
            )}

            <div className="space-y-1">
              {/* Negatives */}
              {negatives.length > 0 && (
                <div className="rounded-lg border border-[#9e2b25]/10 overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-2 bg-[#fef2f1]/50">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-[#9e2b25]">Negativos</span>
                        <span className="text-[10px] text-[#9e2b25]/60">{DEPTH_DEFS[-1].name}</span>
                      </div>
                      <p className="text-[10px] text-[#3d5a4a] leading-tight">{DEPTH_DEFS[-1].desc}</p>
                    </div>
                    <Badge variant="secondary" className="text-[10px] shrink-0">{negatives.length}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-1.5 px-3 py-2">
                    {negatives.sort((a, b) => a.num - b.num).map((item, i) => (
                      <div key={i} className="inline-flex items-center gap-1.5 rounded px-2 py-1 bg-[#fef2f1] border border-[#9e2b25]/15">
                        <AlertTriangle size={10} className="text-[#9e2b25]" />
                        <span className="text-[11px] font-mono font-semibold text-[#9e2b25]">{item.value}</span>
                        <span className="text-[10px] text-[#3d5a4a]">{item.count}x</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* All depth layers */}
              {depths.map(({ depth, label, values, def }) => {
                const hasValues = values.length > 0
                return (
                  <div key={depth} className={`rounded-lg border overflow-hidden ${hasValues ? 'border-[#f0f2f1]' : 'border-[#f0f2f1]/50'}`}>
                    <div className={`flex items-center gap-2 px-3 py-2 ${hasValues ? 'bg-[#f8f9fa]' : 'bg-[#fafafa]'}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-semibold text-[#1a2e23]">{label}</span>
                          <span className={`text-[10px] font-medium ${hasValues ? 'text-[#006c48]' : 'text-[#3d5a4a]'}`}>{def.name}</span>
                        </div>
                        <p className="text-[10px] leading-tight text-[#3d5a4a]">{def.desc}</p>
                      </div>
                      {hasValues ? (
                        <Badge variant="secondary" className="text-[10px] shrink-0">{values.length}</Badge>
                      ) : (
                        <span className="text-[10px] text-[#3d5a4a] shrink-0 italic">vacío</span>
                      )}
                    </div>
                    {hasValues && (
                      <div className="flex flex-wrap gap-1.5 px-3 py-2">
                        {values.map((item, i) => {
                          const ok = isCorrect(item.num)
                          return (
                            <div key={i} className={`inline-flex items-center gap-1.5 rounded px-2 py-1 border ${ok ? 'bg-[#e0f5ec]/50 border-[#006c48]/15' : 'bg-[#fef2f1] border-[#9e2b25]/15'}`}>
                              {ok
                                ? <CheckCircle size={10} className="text-[#006c48]" />
                                : <AlertTriangle size={10} className="text-[#9e2b25]" />
                              }
                              <span className={`text-[11px] font-mono font-semibold ${ok ? 'text-[#006c48]' : 'text-[#9e2b25]'}`}>{item.value}</span>
                              <span className="text-[10px] text-[#3d5a4a]">{item.count}x</span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </Card>
        )
      })()}

      {/* ══════════════════════════════════════════════════════════════
           8. RESUMEN COMPARATIVO RÁPIDO
         ══════════════════════════════════════════════════════════════ */}
      <Card className="p-6">
        <SectionTitle
          icon={Eye}
          title="Métricas comparativas"
          tooltip="Comparación numérica lado a lado de las métricas principales entre HG5 y tu CSS."
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: 'rgba(11, 31, 22, 0.08)' }}>
                <th className="text-left py-2 pr-4 text-[11px] font-medium text-[#52695b] uppercase">Métrica</th>
                <th className="text-right py-2 pr-4 text-[11px] font-medium text-[#52695b] uppercase">HG5</th>
                <th className="text-right py-2 pr-4 text-[11px] font-medium text-[#52695b] uppercase">Tu CSS</th>
                <th className="text-right py-2 text-[11px] font-medium text-[#52695b] uppercase">Estado</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: 'Health Score', hg5: hg5.healthScore, user: user.healthScore, lowerBetter: false },
                { label: 'Peso (KB)', hg5: +(hg5.fileSize/1024).toFixed(1), user: +(user.fileSize/1024).toFixed(1), lowerBetter: true },
                { label: 'Líneas', hg5: hg5.lineCount, user: user.lineCount, lowerBetter: true },
                { label: '!important', hg5: hg5.importantCount, user: user.importantCount, lowerBetter: true },
                { label: 'IDs', hg5: hg5.idCount, user: user.idCount, lowerBetter: true },
                { label: 'Variables CSS', hg5: hg5.variableCount, user: user.variableCount, lowerBetter: false },
                { label: 'Duplicados selector', hg5: hg5.duplicateSelectors.length, user: user.duplicateSelectors.length, lowerBetter: true },
                { label: 'Duplicados declaración', hg5: hg5.duplicateDeclarations.length, user: user.duplicateDeclarations.length, lowerBetter: true },
                { label: 'Reutilización', hg5: +(hg5.reuseRatio*100).toFixed(1), user: +(user.reuseRatio*100).toFixed(1), lowerBetter: false, unit: '%' },
                { label: 'Vendor prefixes', hg5: hg5.vendorPrefixCount, user: user.vendorPrefixCount, lowerBetter: true },
                { label: 'Max especificidad', hg5: hg5.maxSpecificity.join(','), user: user.maxSpecificity.join(','), lowerBetter: true, isStr: true },
                { label: 'Anidamiento máx', hg5: hg5.deepestNesting, user: user.deepestNesting, lowerBetter: true },
              ].map((row, i) => {
                const diff = row.isStr ? 0 : (row.user as number) - (row.hg5 as number)
                const isGood = row.isStr ? String(row.user) === String(row.hg5) : (row.lowerBetter ? diff <= 0 : diff >= 0)
                const isBig = !row.isStr && Math.abs(diff) > Math.abs(row.hg5 as number) * 0.3
                const status = isGood ? 'good' : isBig ? 'bad' : 'warn'
                const sColor = status === 'good' ? C.green : status === 'bad' ? C.red : C.yellow
                const sBg = status === 'good' ? '#e0f5ec' : status === 'bad' ? '#fef2f1' : '#fef6e0'
                return (
                  <tr key={i} className="border-b last:border-0" style={{ borderColor: 'rgba(11, 31, 22, 0.05)' }}>
                    <td className="py-2 pr-4 text-[13px] text-[#1a2e23]">{row.label}</td>
                    <td className="py-2 pr-4 text-right text-[13px] font-mono text-[#3d5a4a]">{row.hg5}{row.unit || ''}</td>
                    <td className="py-2 pr-4 text-right text-[13px] font-mono font-semibold text-[#1a2e23]">{row.user}{row.unit || ''}</td>
                    <td className="py-2 text-right">
                      <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: sBg, color: sColor }}>
                        {isGood ? '✓' : isBig ? '✗' : '~'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
