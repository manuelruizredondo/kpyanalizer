import { Info } from "lucide-react"

export function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="relative group inline-flex ml-1">
      <Info size={13} className="text-[#3d5a4a]/50 hover:text-[#006c48] cursor-help transition-colors" />
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 rounded-lg bg-[#1a2e23] text-white text-xs leading-relaxed px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-lg">
        {text}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#1a2e23]" />
      </span>
    </span>
  )
}
