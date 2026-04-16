import { useState, useRef, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import { Upload } from "lucide-react"

interface FileDropZoneProps {
  onFileContent: (content: string, fileName: string) => void
  accept?: string
  children?: ReactNode
  className?: string
}

export function FileDropZone({ onFileContent, accept = ".css,.json", children, className }: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleDrag(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragging(true)
    } else if (e.type === "dragleave") {
      setIsDragging(false)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) readFile(file)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) readFile(file)
  }

  function readFile(file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === "string") {
        onFileContent(reader.result, file.name)
      }
    }
    reader.readAsText(file)
  }

  return (
    <div
      className={cn(
        "relative border-2 border-dashed rounded-lg transition-colors cursor-pointer",
        isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/50",
        className
      )}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        className="hidden"
      />
      {children ?? (
        <div className="flex flex-col items-center justify-center gap-2 p-6 text-muted-foreground">
          <Upload className="h-8 w-8" />
          <p className="text-sm">Arrastra un archivo o haz clic para seleccionar</p>
        </div>
      )}
      {isDragging && (
        <div className="absolute inset-0 flex items-center justify-center bg-primary/10 rounded-lg">
          <p className="text-sm font-medium text-primary">Suelta el archivo aqui</p>
        </div>
      )}
    </div>
  )
}
