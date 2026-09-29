import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase'
import type { AnalysisResult } from '@/types/analysis'
import { analyzeCss } from '@/lib/analyzer'

/**
 * GET directo a PostgREST con timeout y cancelación. Se usa en lugar de
 * supabase-js para lecturas pesadas porque éste no permite fijar un timeout.
 * El timeout cubre TAMBIÉN la descarga del cuerpo (no solo las cabeceras): con
 * detalles de varios MB, un corte a mitad de descarga dejaría la UI colgada.
 * `signal` permite al llamador abortar (p. ej. al cambiar de proyecto).
 */
export async function restFetch<T = unknown>(
  path: string,
  { timeoutMs = 10000, signal }: { timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Sesión expirada. Por favor, vuelve a iniciar sesión.')
  const controller = new AbortController()
  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort)
  const t = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      signal: controller.signal,
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
    })
    if (!r.ok) throw new Error(`Error ${r.status} al consultar Supabase`)
    return (await r.json()) as T
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError' && !signal?.aborted) {
      throw new Error('Supabase tardó demasiado en responder. Revisa tu conexión.')
    }
    throw err
  } finally {
    clearTimeout(t)
    signal?.removeEventListener('abort', onAbort)
  }
}

/** true si el error viene de un abort pedido por el llamador (no es un fallo real). */
export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError'
}

/**
 * Fila de la vista ligera `scan_metrics`: solo contadores por escaneo (unos KB),
 * frente a los varios MB de `scan_details.analysis_data`. Es lo que deben usar
 * las gráficas de evolución, que solo necesitan cifras.
 */
export interface ScanMetricsRow {
  scan_id: string
  health_score: number
  important_count: number
  id_count: number
  variable_count: number
  reuse_ratio: number
  vendor_prefix_count: number
  universal_count: number
  pseudo_elements: number
  pseudo_classes: number
  angular_count: number
  ang_host: number
  ang_host_context: number
  ang_ng_deep: number
  ang_deep_combinator: number
  colors_count: number
  font_sizes_count: number
  spacing_count: number
  zindex_count: number
  dup_selectors: number
  dup_declarations: number
  media_queries: number
  keyframes_count: number
  font_families: { value: string; normalized: string; count: number }[]
}

export async function getScanMetrics(
  scanIds: string[],
  signal?: AbortSignal,
): Promise<ScanMetricsRow[]> {
  if (scanIds.length === 0) return []
  return restFetch<ScanMetricsRow[]>(
    `scan_metrics?select=*&scan_id=in.(${scanIds.join(',')})`,
    { signal },
  )
}

export interface W3cValidationResult {
  valid: boolean
  errorCount: number
  warningCount: number
  errors: string[]
  warnings: string[]
}

export interface DsCoverageResult {
  colors: number
  fontSizes: number
  spacing: number
  zIndex: number
  overallCoverage: number
}

export interface Creator {
  id: string
  full_name: string
  email: string
}

export interface Scan {
  id: string
  project_id: string
  label: string
  created_at: string
  created_by: string
  file_size: number
  line_count: number
  class_count: number
  id_count: number
  important_count: number
  variable_count: number
  reuse_ratio: number
  health_score: number
  total_selectors: number
  total_declarations: number
  unique_declarations: number
  angular_encapsulation_count: number
  creator?: Creator | null
}

/**
 * Hydrate any list of rows that have a `created_by` field with the matching
 * profile under the `creator` key. One round-trip to profiles, regardless of
 * how many rows.
 */
async function hydrateCreators<T extends { created_by: string; creator?: Creator | null }>(
  rows: T[],
): Promise<T[]> {
  if (rows.length === 0) return rows
  const ids = Array.from(new Set(rows.map(r => r.created_by).filter(Boolean)))
  if (ids.length === 0) return rows
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .in('id', ids)
  if (error || !data) return rows
  const byId = new Map<string, Creator>(
    data.map(p => [p.id, { id: p.id, full_name: p.full_name, email: p.email } as Creator]),
  )
  return rows.map(r => ({ ...r, creator: byId.get(r.created_by) ?? null }))
}

export interface ScanDetail extends Scan {
  analysis_data: AnalysisResult
  w3c_validation?: W3cValidationResult
  ds_coverage?: DsCoverageResult
}

export interface Project {
  id: string
  name: string
  description?: string
  created_at: string
  created_by: string
}

/**
 * Save a scan to the database
 */
export async function saveScan(
  projectId: string,
  label: string,
  analysisResult: AnalysisResult,
  w3cResult?: W3cValidationResult,
  dsCoverage?: DsCoverageResult,
  userId?: string
): Promise<string> {
  // Get current user if userId not provided. Usamos la sesión local
  // (getSession) en vez de getUser(), que hace una llamada de red y puede
  // colgarse dejando el guardado en "Guardando..." indefinidamente.
  let finalUserId = userId
  if (!finalUserId) {
    const user = await ensureAuth()
    finalUserId = user.id
  }

  // Insert into scans table with metrics
  const { data: scanData, error: scanError } = await supabase
    .from('scans')
    .insert({
      project_id: projectId,
      label,
      created_by: finalUserId,
      file_size: analysisResult.fileSize,
      line_count: analysisResult.lineCount,
      class_count: analysisResult.classCount,
      id_count: analysisResult.idCount,
      important_count: analysisResult.importantCount,
      variable_count: analysisResult.variableCount,
      reuse_ratio: analysisResult.reuseRatio,
      health_score: analysisResult.healthScore,
      total_selectors: analysisResult.totalSelectors,
      total_declarations: analysisResult.totalDeclarations,
      unique_declarations: analysisResult.uniqueDeclarations,
      angular_encapsulation_count: analysisResult.angularEncapsulationCount,
    })
    .select('id')
    .single()

  if (scanError) throw scanError
  if (!scanData) throw new Error('Failed to create scan')

  const scanId = scanData.id

  // Insert full analysis data into scan_details table
  const { error: detailError } = await supabase.from('scan_details').insert({
    scan_id: scanId,
    analysis_data: analysisResult,
    w3c_validation: w3cResult || null,
    ds_coverage: dsCoverage || null,
  })

  if (detailError) {
    // Sin transacción entre las dos tablas: si el detalle falla, eliminamos la
    // fila de scans para no dejar un escaneo huérfano (visible en el historial
    // pero sin datos en las vistas de detalle).
    await supabase.from('scans').delete().eq('id', scanId)
    throw detailError
  }

  return scanId
}

export interface RecomputeResult {
  total: number
  updated: number
  skipped: number
  errors: number
}

/**
 * Re-analiza los escaneos guardados de un proyecto con el algoritmo actual y
 * reescribe sus métricas derivadas (incluido el health_score) tanto en la tabla
 * `scans` (columnas denormalizadas que leen las gráficas) como en
 * `scan_details.analysis_data` (copia JSON que leen otras vistas). El CSS
 * original se conserva en `analysis_data.raw`, así que no hace falta volver a
 * subir nada.
 *
 * Es idempotente: re-ejecutarlo sobre escaneos ya actualizados produce el mismo
 * resultado. Se omiten (skipped) los escaneos sin `raw` recuperable.
 */
export async function recomputeProjectScans(projectId: string): Promise<RecomputeResult> {
  // 1. IDs de los escaneos del proyecto.
  const { data: scanRows, error: scanErr } = await supabase
    .from('scans')
    .select('id')
    .eq('project_id', projectId)
  if (scanErr) throw scanErr

  const ids = (scanRows || []).map(r => r.id)
  const result: RecomputeResult = { total: ids.length, updated: 0, skipped: 0, errors: 0 }
  if (ids.length === 0) return result

  // 2. Detalles con el CSS original, UNO A UNO: cada analysis_data pesa varios
  // MB y pedirlos todos en una query supera el statement_timeout (8s) del rol
  // authenticated — la query fallaría entera.
  for (const scanId of ids) {
    // Cede el hilo entre escaneos: analyzeCss es síncrono y con varios CSS de
    // MB seguidos la pestaña quedaría congelada durante todo el proceso.
    await new Promise(r => setTimeout(r, 0))
    const { data: row, error: detErr } = await supabase
      .from('scan_details')
      .select('scan_id, analysis_data')
      .eq('scan_id', scanId)
      .single()
    if (detErr || !row) {
      console.error('recomputeProjectScans: no se pudo leer el detalle de', scanId, detErr)
      result.errors++
      continue
    }

    const raw = (row.analysis_data as AnalysisResult | undefined)?.raw
    if (typeof raw !== 'string' || raw.trim() === '') {
      result.skipped++
      continue
    }

    try {
      const fresh = analyzeCss(raw)

      // Conservamos w3c/ds (no se tocan) y reescribimos analysis_data completo.
      const { error: updDetailErr } = await supabase
        .from('scan_details')
        .update({ analysis_data: fresh })
        .eq('scan_id', row.scan_id)
      if (updDetailErr) throw updDetailErr

      const { error: updScanErr } = await supabase
        .from('scans')
        .update({
          file_size: fresh.fileSize,
          line_count: fresh.lineCount,
          class_count: fresh.classCount,
          id_count: fresh.idCount,
          important_count: fresh.importantCount,
          variable_count: fresh.variableCount,
          reuse_ratio: fresh.reuseRatio,
          health_score: fresh.healthScore,
          total_selectors: fresh.totalSelectors,
          total_declarations: fresh.totalDeclarations,
          unique_declarations: fresh.uniqueDeclarations,
          angular_encapsulation_count: fresh.angularEncapsulationCount,
        })
        .eq('id', row.scan_id)
      if (updScanErr) throw updScanErr

      result.updated++
    } catch (err) {
      console.error('recomputeProjectScans: error en scan', row.scan_id, err)
      result.errors++
    }
  }

  return result
}

/**
 * Get all scans for a project ordered by creation date (newest first).
 * Each scan is hydrated with `creator` (full_name + email) so the UI can show
 * who ran the analysis.
 */
export async function getProjectScans(projectId: string): Promise<Scan[]> {
  const { data, error } = await supabase
    .from('scans')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return hydrateCreators<Scan>(data || [])
}

/**
 * Get a single scan with its full details
 */
export async function getScanDetail(scanId: string, signal?: AbortSignal): Promise<ScanDetail> {
  const { data: scanData, error: scanError } = await supabase
    .from('scans')
    .select('*')
    .eq('id', scanId)
    .single()

  if (scanError) throw scanError
  if (!scanData) throw new Error('Escaneo no encontrado')

  return withFullDetail(scanData as Scan, signal)
}

/**
 * Trae el detalle pesado (varios MB) de un escaneo por REST, con un timeout
 * holgado de descarga, y valida que `analysis_data` tenga forma de análisis.
 * Lanza si falta: un `{}` vacío como análisis hace reventar cualquier vista que
 * lea `result.colors.length` y, sin ErrorBoundary, deja la app en blanco.
 */
async function withFullDetail(scan: Scan, signal?: AbortSignal): Promise<ScanDetail> {
  const rows = await restFetch<
    { analysis_data: AnalysisResult | null; w3c_validation?: W3cValidationResult; ds_coverage?: DsCoverageResult }[]
  >(
    `scan_details?select=analysis_data,w3c_validation,ds_coverage&scan_id=eq.${scan.id}&limit=1`,
    { timeoutMs: 30000, signal },
  )
  const detail = rows[0]
  if (!detail || !isAnalysisResult(detail.analysis_data)) {
    throw new Error('El detalle de este escaneo no está disponible.')
  }
  return {
    ...scan,
    analysis_data: detail.analysis_data,
    w3c_validation: detail.w3c_validation ?? undefined,
    ds_coverage: detail.ds_coverage ?? undefined,
  }
}

/** Comprobación mínima de forma: las vistas asumen estas arrays presentes. */
export function isAnalysisResult(x: unknown): x is AnalysisResult {
  if (!x || typeof x !== 'object') return false
  const a = x as Partial<AnalysisResult>
  return Array.isArray(a.colors) && Array.isArray(a.fontSizes) && Array.isArray(a.duplicateSelectors)
}

/**
 * Get the latest scan detail (with W3C + DS data) for a project
 */
export async function getLatestScanDetail(
  projectId: string,
  signal?: AbortSignal,
): Promise<ScanDetail | null> {
  // maybeSingle: "sin escaneos" devuelve null; un fallo real (red, 401…) lanza,
  // para que el llamador no lo confunda con un proyecto vacío.
  const { data: scanData, error: scanError } = await supabase
    .from('scans')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (scanError) throw scanError
  if (!scanData) return null

  return withFullDetail(scanData as Scan, signal)
}

/**
 * Ensure user has a valid session, throw if not
 * Uses getSession() (local) instead of getUser() (network) to avoid hangs
 */
async function ensureAuth() {
  const { data: { session }, error } = await supabase.auth.getSession()
  if (error || !session) {
    throw new Error('Sesión expirada. Por favor, vuelve a iniciar sesión.')
  }
  return session.user
}

/**
 * Get all projects
 */
export async function getProjects(): Promise<Project[]> {
  await ensureAuth()

  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

/**
 * Create a new project
 */
export async function createProject(
  name: string,
  description?: string,
  userId?: string
): Promise<string> {
  const finalUserId = userId ?? (await ensureAuth()).id

  const { data, error } = await supabase
    .from('projects')
    .insert({
      name,
      description: description || null,
      created_by: finalUserId,
    })
    .select('id')
    .single()

  if (error) throw error
  if (!data) throw new Error('Failed to create project')

  return data.id
}

/**
 * Delete a project (cascades to scans and scan_details)
 */
export async function deleteProject(projectId: string): Promise<void> {
  await deleteOwnedRow('projects', projectId)
}

/**
 * Delete a scan (cascades to scan_details)
 */
export async function deleteScan(scanId: string): Promise<void> {
  await deleteOwnedRow('scans', scanId)
}

/**
 * Borra una fila y comprueba que se borró de verdad. Si RLS lo impide (solo el
 * autor o un super_admin pueden borrar), PostgREST no da error: simplemente
 * borra 0 filas. Sin esta comprobación la UI creería que el borrado funcionó.
 */
async function deleteOwnedRow(table: 'projects' | 'scans' | 'action_items', id: string) {
  const { data, error } = await supabase.from(table).delete().eq('id', id).select('id')
  if (error) throw error
  if (!data || data.length === 0) {
    throw new Error('No se ha podido eliminar: solo su autor o un administrador puede hacerlo.')
  }
}

// ─── Action Items ──────────────────────────────────────────────────

export type ActionPriority = 'critical' | 'high' | 'medium' | 'low'

export interface ActionItem {
  id: string
  project_id: string
  title: string
  description: string
  priority: ActionPriority
  sort_order: number
  created_by: string
  created_at: string
  updated_at: string
  creator?: Creator | null
}

/**
 * Get all action items for a project, ordered by sort_order
 */
export async function getActionItems(projectId: string): Promise<ActionItem[]> {
  const { data, error } = await supabase
    .from('action_items')
    .select('*')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: true })

  if (error) throw error
  return hydrateCreators<ActionItem>(data || [])
}

/**
 * Create a new action item
 */
export async function createActionItem(
  projectId: string,
  title: string,
  priority: ActionPriority,
  description: string = '',
): Promise<ActionItem> {
  const user = await ensureAuth()

  // Get max sort_order for this project
  const { data: existing, error: orderError } = await supabase
    .from('action_items')
    .select('sort_order')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: false })
    .limit(1)
  if (orderError) throw orderError

  const nextOrder = (existing && existing.length > 0 ? existing[0].sort_order : -1) + 1

  const { data, error } = await supabase
    .from('action_items')
    .insert({
      project_id: projectId,
      title,
      description,
      priority,
      sort_order: nextOrder,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) throw error
  const [hydrated] = await hydrateCreators<ActionItem>([data])
  return hydrated
}

/**
 * Update an action item (title, description, priority)
 */
export async function updateActionItem(
  id: string,
  updates: Partial<Pick<ActionItem, 'title' | 'description' | 'priority'>>,
): Promise<void> {
  const { error } = await supabase
    .from('action_items')
    .update(updates)
    .eq('id', id)

  if (error) throw error
}

/**
 * Delete an action item
 */
export async function deleteActionItem(id: string): Promise<void> {
  await deleteOwnedRow('action_items', id)
}

/**
 * Reordena las acciones. Recibe la lista en el orden deseado, con su
 * sort_order ACTUAL, y solo actualiza las filas cuyo orden cambia (un
 * intercambio = 2 UPDATEs, no N). Normaliza a 0..n-1, así que también repara
 * órdenes duplicados que hubieran quedado de antes.
 */
export async function reorderActionItems(
  items: Pick<ActionItem, 'id' | 'sort_order'>[],
): Promise<void> {
  const updates = items
    .map((item, index) => ({ id: item.id, from: item.sort_order, to: index }))
    .filter(u => u.from !== u.to)
    .map(u => supabase.from('action_items').update({ sort_order: u.to }).eq('id', u.id))
  const results = await Promise.all(updates)
  const failed = results.find(r => r.error)
  if (failed?.error) throw failed.error
}
