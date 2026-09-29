import { useId } from "react"
import { Info } from "lucide-react"

export function InfoTooltip({ text }: { text: string }) {
  // Enfocable con teclado (tabIndex) y se muestra también con foco; el texto
  // queda asociado al icono vía aria-describedby para lectores de pantalla.
  const tooltipId = useId()
  return (
    <span
      className="relative group inline-flex ml-1 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#006c48]"
      tabIndex={0}
      role="img"
      aria-label="Más información"
      aria-describedby={tooltipId}
    >
      <Info size={13} aria-hidden="true" className="text-[#3d5a4a]/50 hover:text-[#006c48] group-focus-visible:text-[#006c48] cursor-help transition-colors" />
      <span
        id={tooltipId}
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 rounded-lg bg-[#1a2e23] text-white text-xs leading-relaxed px-3 py-2 opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity z-50 shadow-lg"
      >
        {text}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#1a2e23]" aria-hidden="true" />
      </span>
    </span>
  )
}
