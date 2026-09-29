import { useState, useRef, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import { Upload } from "lucide-react"

/** Tamaño máximo de archivo aceptado (10 MB) */
const MAX_FILE_SIZE = 10 * 1024 * 1024

interface FileDropZoneProps {
  onFileContent: (content: string, fileName: string) => void
  accept?: string
  children?: ReactNode
  className?: string
  /**
   * Avisos informativos (p.ej. "se usó solo el primer archivo"). Útil cuando el
   * padre desmonta la zona tras cargar el archivo y el aviso se perdería. Si no
   * se pasa, el aviso se muestra dentro de la propia zona.
   */
  onNotice?: (message: string | null) => void
}

/**
 * ¿Encaja el archivo con el `accept` del input? Soporta extensiones (".css"),
 * MIME exactos ("text/css") y comodines ("text/*").
 */
function matchesAccept(file: File, accept: string): boolean {
  const tokens = accept.split(",").map(t => t.trim().toLowerCase()).filter(Boolean)
  if (tokens.length === 0) return true
  const name = file.name.toLowerCase()
  const type = (file.type || "").toLowerCase()
  return tokens.some(t => {
    if (t.startsWith(".")) return name.endsWith(t)
    if (t.endsWith("/*")) return type.startsWith(t.slice(0, -1))
    return type === t
  })
}

/** Lista legible de extensiones aceptadas: ".json,.css" → ".json o .css" */
function describeAccept(accept: string): string {
  const tokens = accept.split(",").map(t => t.trim()).filter(Boolean)
  if (tokens.length <= 1) return tokens[0] ?? ""
  return `${tokens.slice(0, -1).join(", ")} o ${tokens[tokens.length - 1]}`
}

export function FileDropZone({ onFileContent, accept = ".css,.json", children, className, onNotice }: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  // Contador enter/leave: dragleave también salta al pasar sobre los hijos,
  // lo que hacía parpadear el overlay.
  const dragDepth = useRef(0)

  function showNotice(message: string | null) {
    if (onNotice) onNotice(message)
    else setNotice(message)
  }

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    dragDepth.current++
    setIsDragging(true)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    dragDepth.current = Math.max(0, dragDepth.current - 1)
    if (dragDepth.current === 0) setIsDragging(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    dragDepth.current = 0
    setIsDragging(false)
    const files = e.dataTransfer.files
    const file = files[0]
    if (!file) return
    showNotice(
      files.length > 1
        ? `Has soltado ${files.length} archivos; solo se usa el primero (${file.name}).`
        : null
    )
    readFile(file)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    showNotice(null)
    if (file) readFile(file)
    // Permite volver a seleccionar el mismo archivo tras un error
    e.target.value = ""
  }

  function readFile(file: File) {
    setError(null)
    if (!matchesAccept(file, accept)) {
      setError(`Tipo de archivo no admitido (${file.name}). Solo se aceptan archivos ${describeAccept(accept)}.`)
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      setError(
        `El archivo es demasiado grande (${(file.size / 1024 / 1024).toFixed(1)} MB). El maximo es ${MAX_FILE_SIZE / 1024 / 1024} MB.`
      )
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === "string") {
        onFileContent(reader.result, file.name)
      }
    }
    reader.onerror = () => {
      setError(`No se pudo leer el archivo ${file.name}. Intentalo de nuevo.`)
    }
    reader.readAsText(file)
  }

  function openPicker() {
    inputRef.current?.click()
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Seleccionar o arrastrar un archivo (${describeAccept(accept)})`}
      className={cn(
        "relative border-2 border-dashed rounded-lg transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/50",
        className
      )}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={openPicker}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          openPicker()
        }
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        // El click programático burbujea al contenedor: no reabrir el selector
        onClick={(e) => e.stopPropagation()}
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
      />
      {children ?? (
        <div className="flex flex-col items-center justify-center gap-2 p-6 text-muted-foreground">
          <Upload className="h-8 w-8" />
          <p className="text-sm">Arrastra un archivo o haz clic para seleccionar</p>
        </div>
      )}
      {(error || notice) && (
        <div className="px-4 pb-3 text-center" aria-live="polite">
          {error && <p role="alert" className="text-xs text-[#9e2b25]">{error}</p>}
          {notice && <p className="text-xs text-[#a67c00]">{notice}</p>}
        </div>
      )}
      {isDragging && (
        <div className="absolute inset-0 flex items-center justify-center bg-primary/10 rounded-lg pointer-events-none">
          <p className="text-sm font-medium text-primary">Suelta el archivo aqui</p>
        </div>
      )}
    </div>
  )
}
