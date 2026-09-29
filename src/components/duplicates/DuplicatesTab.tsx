import { useMemo, useState } from "react"
import type { AnalysisResult, DuplicateGroup } from "@/types/analysis"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger
} from "@/components/ui/accordion"
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow
} from "@/components/ui/table"

interface DuplicatesTabProps {
  result: AnalysisResult
}

// Grupos que se pintan de golpe; el resto bajo "Mostrar más" (con CSS grandes
// hay miles de grupos y cada AccordionItem es caro de montar).
const GROUP_PAGE = 200

/**
 * Valor estable para cada AccordionItem basado en la clave del grupo (no en el
 * índice), para que los paneles abiertos sigan mostrando el mismo grupo cuando
 * cambia el CSS. Si una clave se repite, se desambigua con un sufijo.
 */
function stableValues(prefix: string, groups: DuplicateGroup[]): string[] {
  const seen = new Map<string, number>()
  return groups.map(g => {
    const n = seen.get(g.key) ?? 0
    seen.set(g.key, n + 1)
    return n === 0 ? `${prefix}:${g.key}` : `${prefix}:${g.key}#${n}`
  })
}

export function DuplicatesTab({ result }: DuplicatesTabProps) {
  const [selectorLimit, setSelectorLimit] = useState(GROUP_PAGE)
  const selectorValues = useMemo(() => stableValues("sel", result.duplicateSelectors), [result.duplicateSelectors])
  const declValues = useMemo(() => stableValues("decl", result.duplicateDeclarations), [result.duplicateDeclarations])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Duplicate Selectors */}
      <section>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          Selectores Duplicados
          <Badge variant={result.duplicateSelectors.length > 0 ? "destructive" : "secondary"}>
            {result.duplicateSelectors.length}
          </Badge>
        </h3>
        {result.duplicateSelectors.length === 0 ? (
          <p className="text-sm text-muted-foreground">No se encontraron selectores duplicados.</p>
        ) : (
          <Accordion type="multiple" className="w-full">
            {result.duplicateSelectors.slice(0, selectorLimit).map((group, i) => (
              <AccordionItem key={selectorValues[i]} value={selectorValues[i]}>
                <AccordionTrigger className="text-xs font-mono hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{group.occurrences.length}x</Badge>
                    <span className="truncate max-w-[500px]">{group.key}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-1 pl-4">
                    {group.occurrences.map((loc, j) => (
                      <p key={j} className="text-xs text-muted-foreground font-mono">
                        Linea {loc.line}, columna {loc.column}
                      </p>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
        {result.duplicateSelectors.length > selectorLimit && (
          <div className="flex items-center justify-between gap-3 mt-2">
            <p className="text-xs text-muted-foreground">
              Mostrando {selectorLimit} de {result.duplicateSelectors.length} selectores duplicados.
            </p>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setSelectorLimit(l => l + GROUP_PAGE)}>
              Mostrar más
            </Button>
          </div>
        )}
      </section>

      {/* Duplicate Declarations */}
      <section>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          Declaraciones Duplicadas
          <Badge variant={result.duplicateDeclarations.length > 0 ? "destructive" : "secondary"}>
            {result.duplicateDeclarations.length}
          </Badge>
        </h3>
        {result.duplicateDeclarations.length === 0 ? (
          <p className="text-sm text-muted-foreground">No se encontraron declaraciones duplicadas.</p>
        ) : (
          <Accordion type="multiple" className="w-full">
            {result.duplicateDeclarations.slice(0, 50).map((group, i) => (
              <AccordionItem key={declValues[i]} value={declValues[i]}>
                <AccordionTrigger className="text-xs font-mono hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{group.occurrences.length}x</Badge>
                    <span className="truncate max-w-[500px]">{group.key}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-1 pl-4">
                    {group.occurrences.map((loc, j) => (
                      <p key={j} className="text-xs text-muted-foreground font-mono">
                        L{loc.line} — {loc.selector}
                      </p>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
        {result.duplicateDeclarations.length > 50 && (
          <p className="text-xs text-muted-foreground mt-2">
            Mostrando 50 de {result.duplicateDeclarations.length} declaraciones duplicadas.
          </p>
        )}
      </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Media Queries */}
      <section>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          Media Queries
          <Badge variant="secondary">{result.mediaQueries.length}</Badge>
        </h3>
        {result.mediaQueries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No se encontraron media queries.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Query</TableHead>
                <TableHead>Apariciones</TableHead>
                <TableHead>Lineas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.mediaQueries.map((mq, i) => (
                <TableRow key={i}>
                  <TableCell className="font-mono text-xs truncate max-w-[400px]">{mq.query}</TableCell>
                  <TableCell>
                    <Badge variant={mq.count > 1 ? "destructive" : "secondary"}>{mq.count}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {mq.locations.map(l => `L${l.line}`).join(", ")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      {/* Keyframes */}
      <section>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          Keyframes / Animaciones
          <Badge variant="secondary">{result.keyframes.length}</Badge>
        </h3>
        {result.keyframes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No se encontraron keyframes.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Linea</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.keyframes.map((kf, i) => (
                <TableRow key={i}>
                  <TableCell className="font-mono text-sm">{kf.name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">L{kf.line}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
      </div>
    </div>
  )
}
