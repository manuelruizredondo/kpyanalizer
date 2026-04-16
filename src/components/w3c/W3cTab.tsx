import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, CheckCircle, XCircle, AlertTriangle, Globe } from "lucide-react"
import type { W3cValidationResult } from "@/types/w3c"

interface W3cTabProps {
  result: W3cValidationResult | null
  isValidating: boolean
  error: string | null
  onValidate: () => void
  hasCss: boolean
}

export function W3cTab({ result, isValidating, error, onValidate, hasCss }: W3cTabProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Validacion W3C Jigsaw</h3>
        </div>
        <Button
          onClick={onValidate}
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

      {error && (
        <Card className="border-destructive">
          <CardContent className="p-4">
            <p className="text-sm text-destructive">{error}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Asegurate de tener conexion a internet. El validador W3C requiere acceso externo.
            </p>
          </CardContent>
        </Card>
      )}

      {!result && !error && !isValidating && (
        <div className="text-center py-12 text-muted-foreground">
          <Globe className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">
            {hasCss
              ? "Haz clic en \"Validar CSS\" para enviar tu CSS al validador W3C Jigsaw."
              : "Carga un CSS primero para poder validar."}
          </p>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          {/* Status */}
          <div className="flex items-center gap-3">
            {result.valid ? (
              <Badge className="gap-1 bg-green-100 text-green-800 hover:bg-green-100">
                <CheckCircle className="h-3.5 w-3.5" />
                CSS Valido
              </Badge>
            ) : (
              <Badge variant="destructive" className="gap-1">
                <XCircle className="h-3.5 w-3.5" />
                CSS Invalido
              </Badge>
            )}
            <Badge variant="outline">{result.errorCount} errores</Badge>
            <Badge variant="outline">{result.warningCount} warnings</Badge>
          </div>

          {/* Errors */}
          {result.errors.length > 0 && (
            <section>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2 text-red-600">
                <XCircle className="h-4 w-4" />
                Errores ({result.errors.length})
              </h4>
              <div className="space-y-2">
                {result.errors.map((err, i) => (
                  <Card key={i} className="border-red-200">
                    <CardContent className="p-3">
                      <div className="flex items-start gap-2">
                        <Badge variant="destructive" className="text-xs shrink-0">L{err.line}</Badge>
                        <div>
                          <p className="text-sm">{err.message}</p>
                          {err.context && (
                            <p className="text-xs text-muted-foreground font-mono mt-1">{err.context}</p>
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
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2 text-yellow-600">
                <AlertTriangle className="h-4 w-4" />
                Warnings ({result.warnings.length})
              </h4>
              <div className="space-y-2">
                {result.warnings.map((warn, i) => (
                  <Card key={i} className="border-yellow-200">
                    <CardContent className="p-3">
                      <div className="flex items-start gap-2">
                        <Badge variant="outline" className="text-xs shrink-0 border-yellow-300 text-yellow-700">
                          L{warn.line}
                        </Badge>
                        <div>
                          <p className="text-sm">{warn.message}</p>
                          {warn.context && (
                            <p className="text-xs text-muted-foreground font-mono mt-1">{warn.context}</p>
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
