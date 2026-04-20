import { EditorialHeader } from './EditorialHeader'

interface AppLayoutProps {
  children: React.ReactNode
  /** Optional second-row content for the sticky header (tabs, selectors, etc.) */
  secondRow?: React.ReactNode
}

export function AppLayout({ children, secondRow }: AppLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f6f7f5' }}>
      <EditorialHeader secondRow={secondRow} />
      <main className="flex-1 w-full">
        {children}
      </main>
    </div>
  )
}
