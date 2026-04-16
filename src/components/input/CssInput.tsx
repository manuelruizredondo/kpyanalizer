import { useState } from "react"
import { FileDropZone } from "./FileDropZone"
import { Button } from "@/components/ui/button"
import { FileCode, Trash2, Loader2 } from "lucide-react"

interface CssInputProps {
  value: string
  onChange: (css: string) => void
  isAnalyzing?: boolean
}

export function CssInput({ value, onChange, isAnalyzing }: CssInputProps) {
  const [localValue, setLocalValue] = useState(value)

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
