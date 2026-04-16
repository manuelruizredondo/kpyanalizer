import { supabase } from '@/lib/supabase'
import type { AnalysisResult } from '@/types/analysis'

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
  // Get current user if userId not provided
  let finalUserId = userId
  if (!finalUserId) {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')
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

  if (detailError) throw detailError

  return scanId
}

/**
 * Get all scans for a project ordered by creation date (newest first)
 */
export async function getProjectScans(projectId: string): Promise<Scan[]> {
  const { data, error } = await supabase
    .from('scans')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

/**
 * Get a single scan with its full details
 */
export async function getScanDetail(scanId: string): Promise<ScanDetail> {
  const { data: scanData, error: scanError } = await supabase
    .from('scans')
    .select('*')
    .eq('id', scanId)
    .single()

  if (scanError) throw scanError
  if (!scanData) throw new Error('Scan not found')

  const { data: detailData, error: detailError } = await supabase
    .from('scan_details')
    .select('analysis_data, w3c_validation, ds_coverage')
    .eq('scan_id', scanId)
    .single()

  if (detailError) throw detailError

  return {
    ...scanData,
    analysis_data: detailData?.analysis_data || {},
    w3c_validation: detailData?.w3c_validation,
    ds_coverage: detailData?.ds_coverage,
  } as ScanDetail
}

/**
 * Ensure user has a valid session, throw if not
 */
async function ensureAuth() {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    throw new Error('Sesión expirada. Por favor, vuelve a iniciar sesión.')
  }
  return user
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
  // Get current user if userId not provided
  let finalUserId = userId
  if (!finalUserId) {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')
    finalUserId = user.id
  }

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
  const { error } = await supabase.from('projects').delete().eq('id', projectId)
  if (error) throw error
}

/**
 * Delete a scan (cascades to scan_details)
 */
export async function deleteScan(scanId: string): Promise<void> {
  const { error } = await supabase.from('scans').delete().eq('id', scanId)
  if (error) throw error
}
