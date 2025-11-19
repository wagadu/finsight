// TypeScript types for database tables and API responses

export type ModelType = 'baseline' | 'ft' | 'distilled'

export type SectionType = 
  | 'revenue_drivers' 
  | 'key_risks' 
  | 'unit_economics' 
  | 'investment_thesis' 
  | 'financial_trends'

export interface Citation {
  id: string
  chunk_id?: string
  page_number?: number
  excerpt: string
  label?: string
}

export interface EquityAnalystRun {
  id: string
  document_id: string
  model_name: string
  run_type: ModelType
  created_at: string
  completed_at?: string
  status: 'running' | 'completed' | 'failed'
  metadata?: Record<string, any>
}

export interface EquityAnalystSection {
  id: string
  run_id: string
  section_type: SectionType
  question_text: string
  model_answer: string
  citations?: Citation[]
  response_time_ms?: number
  is_gold?: boolean
  created_at: string
}

export interface ChatLog {
  id: string
  document_id?: string
  user_message: string
  assistant_message: string
  model_name?: string
  citations?: Citation[]
  response_time_ms?: number
  created_at: string
}

export interface EquityAnalystRunRequest {
  documentId: string
  modelKey: ModelType
}

export interface EquityAnalystRunResponse {
  runId: string
  status: 'running' | 'completed' | 'failed'
  sections: EquityAnalystSection[]
}

export interface EquityAnalystRunSummary {
  id: string
  document_id: string
  model_name: string
  run_type: ModelType
  status: 'running' | 'completed' | 'failed'
  created_at: string
  completed_at?: string
  section_count: number
  avg_response_time_ms?: number
}

export interface ExportFinetuneDatasetRequest {
  modelName?: string
  isGoldOnly?: boolean
  limit?: number
}

export interface FinetuneMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface FinetuneExample {
  messages: FinetuneMessage[]
}

