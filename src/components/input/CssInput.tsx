import { useState } from "react"
import { FileDropZone } from "./FileDropZone"
import { Button } from "@/components/ui/button"
import { FileCode, Trash2, Loader2, Globe, Download, ExternalLink } from "lucide-react"

const CORS_PROXY = "https://lqgdrkwabcjrnnthlrmi.supabase.co/functions/v1/cors-proxy"

interface CssInputProps {
  value: string
  onChange: (css: string) => void
  isAnalyzing?: boolean
}

export function CssInput({ value, onChange, isAnalyzing }: CssInputProps) {
  const [localValue, setLocalValue] = useState(value)
  const [urlInput, setUrlInput] = useState("")
  const [urlLoading, setUrlLoading] = useState(false)
  const [urlError, setUrlError] = useState<string | null>(null)
  const [urlBlocked, setUrlBlocked] = useState(false)

  function handleTextChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const text = e.target.value
    setLocalValue(text)
    onChange(text)
  }

  function handleFileDrop(content: string) {
    setLocalValue(content)
    onChange(content)
  }

  function handleClear() {
    setLocalValue("")
    onChange("")
    setUrlInput("")
    setUrlError(null)
  }

  async function handleLoadFromUrl() {
    const url = urlInput.trim()
    if (!url) return

    // Basic URL validation
    try {
      new URL(url)
    } catch {
      setUrlError("URL no valida. Asegurate de incluir https://")
      return
    }

    if (!url.endsWith(".css") && !url.includes(".css?")) {
      // Allow but warn
      const proceed = window.confirm(
        "La URL no termina en .css. ¿Quieres intentar descargarla de todos modos?"
      )
      if (!proceed) return
    }

    setUrlLoading(true)
    setUrlError(null)
    setUrlBlocked(false)

    try {
      const proxyUrl = `${CORS_PROXY}?url=${encodeURIComponent(url)}`
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 30000)

      const resp = await fetch(proxyUrl, { signal: controller.signal })
      clearTimeout(timeout)

      if (!resp.ok) {
        // Check if the proxy returned a "blocked" flag
        let blocked = false
        try {
          const json = await resp.json()
          blocked = json.blocked === true
          if (blocked) {
            setUrlBlocked(true)
            setUrlError(json.error || `El servidor bloquea descargas externas (${resp.status})`)
            return
          }
          throw new Error(json.error || `Error ${resp.status}`)
        } catch (jsonErr) {
          if (blocked) return
          throw new Error(`Error ${resp.status}: no se pudo descargar el CSS`)
        }
      }

      const css = await resp.text()

      if (!css.trim()) {
        throw new Error("El archivo descargado esta vacio")
      }

      // Check it looks like CSS (basic heuristic)
      if (css.trim().startsWith("<!DOCTYPE") || css.trim().startsWith("<html")) {
        throw new Error("La URL devolvio HTML en lugar de CSS. Verifica la URL.")
      }

      setLocalValue(css)
      onChange(css)
      setUrlError(null)
      setUrlBlocked(false)
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        setUrlError("Timeout: la descarga tardo demasiado (>30s)")
      } else {
        setUrlError(e instanceof Error ? e.message : "Error al descargar el CSS")
      }
    } finally {
      setUrlLoading(false)
    }
  }

  const size = localValue ? `${(new Blob([localValue]).size / 1024).toFixed(1)} KB` : "0 KB"
  const lines = localValue ? localValue.split("\n").length : 0

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileCode className="h-5 w-5 text-[#3d5a4a]" />
          <h3 className="font-semibold text-sm text-[#1a2e23]">CSS Compilado</h3>
        </div>
        <div className="flex items-center gap-3 text-xs text-[#3d5a4a]">
          {isAnalyzing && (
            <span className="flex items-center gap-1.5 text-[#006c48]">
              <Loader2 className="h-3 w-3 animate-spin" />
              Analizando...
            </span>
          )}
          {localValue && (
            <>
              <span>{size}</span>
              <span>{lines.toLocaleString()} lineas</span>
              <Button variant="ghost" size="sm" className="h-7 px-2" onClick={handleClear}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* URL loader */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Globe className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#3d5a4a]/50" />
          <input
            type="url"
            value={urlInput}
            onChange={(e) => { setUrlInput(e.target.value); setUrlError(null) }}
            onKeyDown={(e) => { if (e.key === "Enter") handleLoadFromUrl() }}
            placeholder="https://ejemplo.com/styles.css"
            className="w-full pl-8 pr-3 py-2 rounded-md border border-input bg-background text-xs font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            disabled={urlLoading}
          />
        </div>
        <Button
          onClick={handleLoadFromUrl}
          disabled={urlLoading || !urlInput.trim()}
          size="sm"
          className="gap-1.5 shrink-0"
        >
          {urlLoading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Descargando...
            </>
          ) : (
            <>
              <Download className="h-3.5 w-3.5" />
              Cargar CSS
            </>
          )}
        </Button>
      </div>
      {urlError && (
        <div className="text-xs bg-[#fef2f1] rounded-lg px-3 py-2 space-y-2">
          <p className="text-[#9e2b25]">{urlError}</p>
          {urlBlocked && urlInput.trim() && (
            <div className="space-y-2 pt-1 border-t border-[#9e2b25]/10">
              <p className="text-[#3d5a4a]">
                El servidor bloquea descargas desde servidores externos. Usa una de estas opciones:
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    // Create a temporary link with download attribute to force .css download
                    const a = document.createElement("a")
                    a.href = urlInput.trim()
                    // Extract filename from URL
                    const filename = urlInput.trim().split("/").pop()?.split("?")[0] || "styles.css"
                    a.download = filename
                    a.target = "_blank"
                    a.rel = "noopener noreferrer"
                    document.body.appendChild(a)
                    a.click()
                    document.body.removeChild(a)
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#006c48] text-white rounded-md hover:bg-[#005a3a] transition-colors font-medium"
                >
                  <Download size={12} />
                  Descargar .css
                </button>
                <span className="text-[#3d5a4a]">y arrastralo aqui</span>
              </div>
              <p className="text-[10px] text-[#3d5a4a]/70">
                Si no se descarga, haz clic derecho en{" "}
                <a
                  href={urlInput.trim()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-[#006c48]"
                >
                  este enlace
                </a>
                {" "}→ "Guardar enlace como..." → arrastra el archivo .css aqui.
              </p>
            </div>
          )}
        </div>
      )}

      {!localValue ? (
        <FileDropZone onFileContent={handleFileDrop} accept=".css" className="min-h-[200px]">
          <div className="flex flex-col items-center justify-center gap-2 p-8 text-[#3d5a4a]">
            <FileCode className="h-10 w-10" />
            <p className="text-sm font-medium">Arrastra tu archivo CSS aqui</p>
            <p className="text-xs">o haz clic para seleccionar un archivo .css</p>
            <p className="text-xs mt-2">Tambien puedes pegar el CSS directamente abajo</p>
          </div>
        </FileDropZone>
      ) : null}
      <textarea
        className="w-full min-h-[150px] max-h-[400px] rounded-md border border-input bg-background px-3 py-2 text-xs font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        placeholder="Pega tu CSS compilado aqui..."
        value={localValue}
        onChange={handleTextChange}
        spellCheck={false}
      />
    </div>
  )
}
