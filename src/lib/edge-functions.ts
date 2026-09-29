import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase'

/** URL de una Edge Function del proyecto (respeta VITE_SUPABASE_URL). */
export function edgeFunctionUrl(name: string): string {
  return `${SUPABASE_URL}/functions/v1/${name}`
}

/**
 * Cabeceras para llamar a una Edge Function como el usuario autenticado.
 * Enviar el JWT permite activar `verify_jwt` en las funciones (hoy aceptan
 * peticiones anónimas, lo que deja el proxy CORS abierto a cualquiera).
 */
export async function edgeFunctionHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${session?.access_token ?? SUPABASE_ANON_KEY}`,
  }
}

/** Solo se permiten URLs http(s) hacia el proxy (nada de javascript:, data:, file:…). */
export function parseHttpUrl(raw: string): URL | null {
  try {
    const url = new URL(raw.trim())
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null
  } catch {
    return null
  }
}

/** GET de un recurso externo a través del proxy CORS, con timeout que cubre la descarga. */
export async function fetchViaCorsProxy(
  rawUrl: string,
  { timeoutMs = 20000, signal }: { timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<Response> {
  const url = parseHttpUrl(rawUrl)
  if (!url) throw new Error('La URL debe empezar por http:// o https://')
  const controller = new AbortController()
  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort)
  const t = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const target = `${edgeFunctionUrl('cors-proxy')}?url=${encodeURIComponent(url.toString())}`
    let resp: Response
    try {
      resp = await fetch(target, { signal: controller.signal, headers: await edgeFunctionHeaders() })
    } catch (err) {
      // Transición: la versión antigua de `cors-proxy` solo admite `Content-Type`
      // en su CORS y el navegador bloquea el preflight (TypeError). Se reintenta
      // sin cabeceras para que la app funcione con la función vieja y con la
      // nueva (que exige el token). Quitar este reintento cuando la nueva esté
      // desplegada.
      if (!(err instanceof TypeError) || controller.signal.aborted) throw err
      resp = await fetch(target, { signal: controller.signal })
    }
    // Se lee el cuerpo aquí dentro para que el timeout cubra también la descarga.
    const body = await resp.arrayBuffer()
    return new Response(body, { status: resp.status, statusText: resp.statusText, headers: resp.headers })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError' && !signal?.aborted) {
      throw new Error('La descarga tardó demasiado. Inténtalo de nuevo.')
    }
    throw err
  } finally {
    clearTimeout(t)
    signal?.removeEventListener('abort', onAbort)
  }
}
