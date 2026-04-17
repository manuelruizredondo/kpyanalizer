import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, CheckCircle, XCircle, AlertTriangle, Shield, Globe } from "lucide-react"
import type { W3cValidationResult } from "@/types/w3c"
import type { ValidationMode } from "@/hooks/useW3cValidation"

interface W3cTabProps {
  result: W3cValidationResult | null
  isValidating: boolean
  error: string | null
  onValidate: (mode?: ValidationMode) => void
  hasCss: boolean
  mode: ValidationMode
  onModeChange: (mode: ValidationMode) => void
}

export function W3cTab({ result, isValidating, error, onValidate, hasCss, mode, onModeChange }: W3cTabProps) {
  return (
    <div className="space-y-6">
      {/* Header with mode switch */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-[#006c48]" />
          <h3 className="text-sm font-semibold text-[#1a2e23]">Validacion CSS</h3>
        </div>
        <div className="flex items-center gap-2">
          {/* Mode toggle */}
          <div className="flex rounded-lg border border-[#f0f2f1] overflow-hidden text-xs">
            <button
              onClick={() => onModeChange("local")}
              className={`px-3 py-1.5 transition-colors ${
                mode === "local"
                  ? "bg-[#006c48] text-white"
                  : "bg-white text-[#3d5a4a] hover:bg-[#f8f9fa]"
              }`}
            >
              Local
            </button>
            <button
              onClick={() => onModeChange("w3c")}
              className={`px-3 py-1.5 transition-colors ${
                mode === "w3c"
                  ? "bg-[#006c48] text-white"
                  : "bg-white text-[#3d5a4a] hover:bg-[#f8f9fa]"
              }`}
            >
              W3C
            </button>
          </div>
          <Button
            onClick={() => onValidate(mode)}
            disabled={isValidating || !hasCss}
            size="sm"
          >
            {isValidating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Validando...
              </>
            ) : (
              "Validar CSS"
            )}
          </Button>
        </div>
      </div>

      {/* Mode description */}
      <div className="flex items-start gap-2 p-3 bg-[#f8f9fa] rounded-lg">
        {mode === "local" ? (
          <>
            <Shield size={14} className="text-[#006c48] shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-[#1a2e23]">Validador Local (css-tree)</p>
              <p className="text-xs text-[#3d5a4a]">
                Instantaneo, sin conexion a internet. Detecta errores de sintaxis, propiedades desconocidas,
                valores invalidos, reglas vacias, propiedades duplicadas y uso de !important.
              </p>
            </div>
          </>
        ) : (
          <>
            <Globe size={14} className="text-[#a67c00] shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-[#1a2e23]">Validador W3C Jigsaw</p>
              <p className="text-xs text-[#3d5a4a]">
                Validador oficial del W3C. Requiere conexion a internet. Puede fallar con CSS muy grandes
                o si el servidor del W3C no esta disponible.
              </p>
            </div>
          </>
        )}
      </div>

      {error && (
        <Card className="border-[#9e2b25]/30">
          <CardContent className="p-4">
            <p className="text-sm text-[#9e2b25]">{error}</p>
            {mode === "w3c" && (
              <div className="mt-2 flex items-center gap-2">
                <p className="text-xs text-[#3d5a4a]">El servidor W3C no responde.</p>
                <button
                  onClick={() => { onModeChange("local"); onValidate("local") }}
                  className="text-xs text-[#006c48] underline hover:text-[#2a9d6e]"
                >
                  Usar validador local
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!result && !error && !isValidating && (
        <div className="text-center py-12 text-[#3d5a4a]">
          <Shield className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p className="text-sm">
            {hasCss
              ? `Haz clic en "Validar CSS" para analizar tu CSS con el validador ${mode === "local" ? "local" : "W3C"}.`
              : "Carga un CSS primero para poder validar."}
          </p>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          {/* Status */}
          <div className="flex items-center gap-3">
            {result.valid ? (
              <Badge className="gap-1 bg-[#e0f5ec] text-[#006c48] hover:bg-[#e0f5ec]">
                <CheckCircle className="h-3.5 w-3.5" />
                CSS Valido
              </Badge>
            ) : (
              <Badge className="gap-1 bg-[#fef2f1] text-[#9e2b25] hover:bg-[#fef2f1]">
                <XCircle className="h-3.5 w-3.5" />
                CSS con errores
              </Badge>
            )}
            <Badge variant="outline" className={result.errorCount > 0 ? "border-[#9e2b25] text-[#9e2b25]" : ""}>
              {result.errorCount} errores
            </Badge>
            <Badge variant="outline" className={result.warningCount > 0 ? "border-[#a67c00] text-[#a67c00]" : ""}>
              {result.warningCount} warnings
            </Badge>
            <Badge variant="outline" className="text-[#3d5a4a]">
              {mode === "local" ? "Local" : "W3C"}
            </Badge>
          </div>

          {/* Errors */}
          {result.errors.length > 0 && (
            <section>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2 text-[#9e2b25]">
                <XCircle className="h-4 w-4" />
                Errores ({result.errors.length})
              </h4>
              <div className="space-y-2">
                {result.errors.map((err, i) => (
                  <Card key={i} className="border-[#9e2b25]/20">
                    <CardContent className="p-3">
                      <div className="flex items-start gap-2">
                        <Badge className="bg-[#fef2f1] text-[#9e2b25] text-xs shrink-0">L{err.line}</Badge>
                        {err.type && (
                          <Badge variant="outline" className="text-[10px] shrink-0 text-[#3d5a4a]">
                            {err.type}
                          </Badge>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm text-[#1a2e23]">{err.message}</p>
                          {err.context && (
                            <p className="text-xs text-[#3d5a4a] font-mono mt-1 truncate">{err.context}</p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {/* Warnings */}
          {result.warnings.length > 0 && (
            <section>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2 text-[#a67c00]">
                <AlertTriangle className="h-4 w-4" />
                Warnings ({result.warnings.length})
              </h4>
              <div className="space-y-2">
                {result.warnings.map((warn, i) => (
                  <Card key={i} className="border-[#a67c00]/20">
                    <CardContent className="p-3">
                      <div className="flex items-start gap-2">
                        <Badge className="bg-[#fef6e0] text-[#a67c00] text-xs shrink-0">
                          L{warn.line}
                        </Badge>
                        {warn.type && (
                          <Badge variant="outline" className="text-[10px] shrink-0 text-[#3d5a4a]">
                            {warn.type}
                          </Badge>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm text-[#1a2e23]">{warn.message}</p>
                          {warn.context && (
                            <p className="text-xs text-[#3d5a4a] font-mono mt-1 truncate">{warn.context}</p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
