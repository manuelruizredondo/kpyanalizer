import { useMemo, useState } from "react"
import { FileDropZone } from "./FileDropZone"
import { Button } from "@/components/ui/button"
import { FileCode, Trash2, Loader2, Globe, Download } from "lucide-react"
import { fetchViaCorsProxy, parseHttpUrl } from "@/lib/edge-functions"

/** Tamaño UTF-8 en bytes sin copiar el texto (equivale a new Blob([text]).size). */
function utf8ByteLength(text: string): number {
  let bytes = 0
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    if (code < 0x80) bytes += 1
    else if (code < 0x800) bytes += 2
    else if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length) {
      const next = text.charCodeAt(i + 1)
      if (next >= 0xdc00 && next <= 0xdfff) { bytes += 4; i++ } else bytes += 3
    } else bytes += 3
  }
  return bytes
}

/** Nº de líneas sin crear un array con split() sobre todo el CSS. */
function countLines(text: string): number {
  if (!text) return 0
  let n = 1
  for (let i = text.indexOf("\n"); i !== -1; i = text.indexOf("\n", i + 1)) n++
  return n
}

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
  // Aviso de la zona de arrastre (p.ej. varios archivos soltados)
  const [fileNotice, setFileNotice] = useState<string | null>(null)

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
    setFileNotice(null)
  }

  async function handleLoadFromUrl() {
    const url = urlInput.trim()
    if (!url) return

    // Basic URL validation (solo http/https: nada de javascript:, data:, file:…)
    try {
      new URL(url)
    } catch {
      setUrlError("URL no valida. Asegurate de incluir https://")
      return
    }
    if (!parseHttpUrl(url)) {
      setUrlError("Solo se admiten URLs http:// o https://")
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
      // El helper valida el esquema, envía las cabeceras de auth y aplica un
      // timeout que cubre también la descarga del cuerpo.
      const resp = await fetchViaCorsProxy(url, { timeoutMs: 30000 })

      if (!resp.ok) {
        // Check if the proxy returned a "blocked" flag. El JSON se parsea
        // aparte para no tragarse el mensaje real del proxy.
        let json: { blocked?: boolean; error?: string } | null = null
        try {
          json = await resp.json()
        } catch {
          json = null
        }
        if (json?.blocked === true) {
          setUrlBlocked(true)
          setUrlError(json.error || `El servidor bloquea descargas externas (${resp.status})`)
          return
        }
        throw new Error(json?.error || `Error ${resp.status}: no se pudo descargar el CSS`)
      }

      const css = await resp.text()

      if (!css.trim()) {
        throw new Error("El archivo descargado esta vacio")
      }

      // Check it looks like CSS (basic heuristic): cabecera HTML (sin distinguir
      // mayúsculas) o content-type text/html con un cuerpo que empieza por "<"
      // (un CSS nunca empieza así; no nos fiamos solo del content-type del proxy).
      const contentType = (resp.headers.get("content-type") || "").toLowerCase()
      const head = css.trimStart().slice(0, 100).toLowerCase()
      if (
        head.startsWith("<!doctype") ||
        head.startsWith("<html") ||
        (contentType.includes("text/html") && head.startsWith("<"))
      ) {
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

  // Se recalculan solo cuando cambia el texto (no en cada render)
  const size = useMemo(
    () => (localValue ? `${(utf8ByteLength(localValue) / 1024).toFixed(1)} KB` : "0 KB"),
    [localValue],
  )
  const lines = useMemo(() => countLines(localValue), [localValue])
  // URL para el enlace de descarga manual: solo http/https (nunca javascript:)
  const safeBlockedUrl = urlBlocked ? parseHttpUrl(urlInput)?.href ?? null : null

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
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={handleClear}
                aria-label="Borrar CSS"
                title="Borrar CSS"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
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
            aria-label="URL del archivo CSS"
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
          {urlBlocked && safeBlockedUrl && (
            <div className="space-y-2 pt-1 border-t border-[#9e2b25]/10">
              <p className="text-[#3d5a4a]">
                El servidor bloquea descargas desde servidores externos. Usa una de estas opciones:
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    // Revalidar el esquema justo antes de usarlo (solo http/https)
                    const safeUrl = parseHttpUrl(urlInput)
                    if (!safeUrl) {
                      setUrlError("Solo se admiten URLs http:// o https://")
                      setUrlBlocked(false)
                      return
                    }
                    // Create a temporary link with download attribute to force .css download
                    const a = document.createElement("a")
                    a.href = safeUrl.href
                    // Extract filename from URL
                    const filename = safeUrl.pathname.split("/").pop() || "styles.css"
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
                  href={safeBlockedUrl}
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

      {fileNotice && (
        <p className="text-xs text-[#a67c00] bg-[#fef6e0] rounded-lg px-3 py-2" role="status">{fileNotice}</p>
      )}
      {!localValue ? (
        <FileDropZone onFileContent={handleFileDrop} onNotice={setFileNotice} accept=".css" className="min-h-[200px]">
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
        aria-label="CSS compilado"
        value={localValue}
        onChange={handleTextChange}
        spellCheck={false}
      />
    </div>
  )
}
