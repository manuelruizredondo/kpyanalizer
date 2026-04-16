import type { AnalysisResult } from "@/types/analysis"
import { Badge } from "@/components/ui/badge"
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow
} from "@/components/ui/table"

interface HardcodedTabProps {
  result: AnalysisResult
}

export function HardcodedTab({ result }: HardcodedTabProps) {
  return (
    <div className="space-y-8">
      {/* Colors */}
      <section>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          Colores Hardcodeados
          <Badge variant="secondary">{result.colors.length}</Badge>
        </h3>
        {result.colors.length === 0 ? (
          <p className="text-sm text-muted-foreground">No se encontraron colores hardcodeados.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {result.colors.map((color, i) => (
              <div key={i} className="rounded-lg border p-3 space-y-2">
                <div
                  className="w-full h-10 rounded-md border"
                  style={{ backgroundColor: color.normalized }}
                />
                <p className="text-xs font-mono truncate">{color.value}</p>
                <p className="text-xs text-muted-foreground">{color.count} usos</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Font Sizes */}
      <section>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          Font Sizes Hardcodeados
          <Badge variant="secondary">{result.fontSizes.length}</Badge>
        </h3>
        {result.fontSizes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No se encontraron font-sizes hardcodeados.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Valor</TableHead>
                <TableHead>Usos</TableHead>
                <TableHead>Ubicaciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.fontSizes.map((fs, i) => (
                <TableRow key={i}>
                  <TableCell className="font-mono text-sm">{fs.value}</TableCell>
                  <TableCell>{fs.count}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {fs.locations.slice(0, 3).map(l => `L${l.line}`).join(", ")}
                    {fs.locations.length > 3 && ` (+${fs.locations.length - 3})`}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      {/* Spacing */}
      <section>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          Spacing Hardcodeado
          <Badge variant="secondary">{result.spacingValues.length}</Badge>
        </h3>
        {result.spacingValues.length === 0 ? (
          <p className="text-sm text-muted-foreground">No se encontraron valores de spacing hardcodeados.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Valor</TableHead>
                <TableHead>Usos</TableHead>
                <TableHead>Ubicaciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.spacingValues.map((sv, i) => (
                <TableRow key={i}>
                  <TableCell className="font-mono text-sm">{sv.value}</TableCell>
                  <TableCell>{sv.count}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {sv.locations.slice(0, 3).map(l => `L${l.line}`).join(", ")}
                    {sv.locations.length > 3 && ` (+${sv.locations.length - 3})`}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      {/* Z-index */}
      <section>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          Z-index Hardcodeado
          <Badge variant="secondary">{result.zIndexValues.length}</Badge>
        </h3>
        {result.zIndexValues.length === 0 ? (
          <p className="text-sm text-muted-foreground">No se encontraron z-index hardcodeados.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Valor</TableHead>
                <TableHead>Usos</TableHead>
                <TableHead>Ubicaciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.zIndexValues.map((zi, i) => (
                <TableRow key={i}>
                  <TableCell className="font-mono text-sm">{zi.value}</TableCell>
                  <TableCell>{zi.count}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {zi.locations.slice(0, 3).map(l => `L${l.line}`).join(", ")}
                    {zi.locations.length > 3 && ` (+${zi.locations.length - 3})`}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      {/* !important */}
      <section>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          Declaraciones !important
          <Badge variant={result.importants.length > 0 ? "destructive" : "secondary"}>
            {result.importants.length}
          </Badge>
        </h3>
        {result.importants.length === 0 ? (
          <p className="text-sm text-muted-foreground">No se encontraron !important.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Linea</TableHead>
                <TableHead>Selector</TableHead>
                <TableHead>Declaracion</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.importants.map((imp, i) => (
                <TableRow key={i}>
                  <TableCell className="font-mono text-xs">L{imp.line}</TableCell>
                  <TableCell className="font-mono text-xs truncate max-w-[200px]">{imp.selector}</TableCell>
                  <TableCell className="font-mono text-xs truncate max-w-[300px]">{imp.rule}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  )
}
