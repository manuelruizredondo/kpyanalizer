import { useRef, useEffect } from "react"
import { FileDropZone } from "./FileDropZone"
import { Button } from "@/components/ui/button"
import { FileCode, Trash2 } from "lucide-react"

interface CssInputProps {
  value: string
  onChange: (css: string) => void
}

export function CssInput({ value, onChange }: CssInputProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  function handleTextChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const text = e.target.value
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => onChange(text), 300)
  }

  function handleFileDrop(content: string) {
    onChange(content)
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const size = value ? `${(new Blob([value]).size / 1024).toFixed(1)} KB` : "0 KB"
  const lines = value ? value.split("\n").length : 0

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileCode className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-semibold text-sm">CSS Compilado</h3>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {value && (
            <>
              <span>{size}</span>
              <span>{lines} lineas</span>
              <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => onChange("")}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>
      {!value ? (
        <FileDropZone onFileContent={handleFileDrop} accept=".css" className="min-h-[200px]">
          <div className="flex flex-col items-center justify-center gap-2 p-8 text-muted-foreground">
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
        defaultValue={value}
        onChange={handleTextChange}
        spellCheck={false}
      />
    </div>
  )
}
