import type { AnalysisResult } from "@/types/analysis"
import { Badge } from "@/components/ui/badge"
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

export function DuplicatesTab({ result }: DuplicatesTabProps) {
  return (
    <div className="space-y-8">
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
            {result.duplicateSelectors.map((group, i) => (
              <AccordionItem key={i} value={`sel-${i}`}>
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
              <AccordionItem key={i} value={`decl-${i}`}>
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
  )
}
