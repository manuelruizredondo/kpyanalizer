import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Red de seguridad para errores de render: sin ella, cualquier excepción en
 * una vista (p. ej. datos de un escaneo con forma inesperada) desmonta toda la
 * app y deja la página en blanco. Se reinicia al cambiar de ruta (App le pasa
 * `key={pathname}`).
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="py-16 px-8 max-w-xl mx-auto text-center" role="alert">
        <h2 className="text-lg font-semibold text-[#1a2e23] mb-2">Algo ha fallado al mostrar esta página</h2>
        <p className="text-sm text-[#52695b] mb-1">
          El resto de la aplicación sigue funcionando. Puedes reintentar o volver al dashboard.
        </p>
        <p className="text-xs text-[#8a9b92] mb-6 break-words">{error.message}</p>
        <div className="flex gap-3 justify-center">
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white"
            style={{ background: '#012d1d' }}
          >
            Reintentar
          </button>
          <a
            href="/dashboard"
            className="px-4 py-2 rounded-lg text-sm font-medium text-[#1a2e23]"
            style={{ border: '1px solid rgba(11, 31, 22, 0.14)' }}
          >
            Ir al dashboard
          </a>
        </div>
      </div>
    )
  }
}
