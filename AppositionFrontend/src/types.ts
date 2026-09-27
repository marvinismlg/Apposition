// Shapes returned by POST /api/analysis. Field names follow the Python
// pipeline (AppositionBackend/CompetitorAnalysis/api.py) unchanged.

/** The pitch split into fields by Gemini. */
export interface Brief {
  appName: string
  appIdea: string
  keyFeatures: string[]
  targetAudience: string
  /** True when the pitch named none and Gemini derived them */
  featuresInferred: boolean
  audienceInferred: boolean
  /** Other features apps like this often have; only analysed if the founder adds them */
  suggestedFeatures: string[]
  status: 'available' | 'unavailable'
}

export interface Evidence {
  passage: string
  cosine_score: number
}

export interface RankedApp {
  AppName: string
  Developer: string
  /** As Apple formats it, e.g. "Free" or "$2.99" */
  Price: string
  Description: string
  TrackId: number | null
  Genre: string
  Rating: number
  RatingCount: number
  AppStoreUrl: string
  ArtworkUrl: string
  /** Raw cosine similarity, roughly -1 to 1 */
  similarity_score: number
  /** Cosine clamped to a 0–100 similarity index; not a probability or feature share */
  similarity_percentage: number
  /** What the two scores measure, supplied by the ranking engine */
  score_basis: string
}

export interface MatrixCell {
  app_index: number
  app_name: string
  highest_score: number | null
  /** Embedding hint only; Gemini verifies it */
  candidate_match: boolean
  evidence: Evidence[]
}

export interface FeatureMatrix {
  competitors: string[]
  rows: { feature: string; cells: MatrixCell[]; candidate_count: number }[]
  candidate_threshold?: number
}

export interface Review {
  rating: number
  title: string
  text: string
  updated: string
}

export interface ReviewGroup {
  AppName: string
  reviews: Review[]
  error?: string
}

export type Verdict = 'supported' | 'related' | 'not_established'

export interface GeminiAnalysis {
  overall_summary: string
  competitor_summaries: { app_index: number; explanation: string }[]
  feature_comparison: {
    feature: string
    competitors: { app_index: number; verdict: Verdict; evidence: string }[]
  }[]
  differentiation: { idea: string; rationale: string; supporting_app_indices: number[] }[]
  review_improvements: {
    complaint: string
    recommendation: string
    /** quote is checked word for word against the cited review */
    review_refs: { app_index: number; review_index: number; quote: string }[]
  }[]
}

/** Monthly gross revenue estimated from public store signals (a range, never a reported figure). */
export interface RevenueEstimate {
  /** no_store_revenue: free with no in-app purchases */
  status: 'available' | 'unavailable' | 'no_store_revenue'
  estimate?: number
  /** Where the real figure most likely falls */
  likely?: [number, number]
  /** Where it almost certainly falls */
  wide?: [number, number]
  tier?: 'established' | 'small'
  confidence?: 'medium' | 'low'
  basis?: string
  chart_positions?: string[]
  ratings?: number
  paid_app?: boolean
}

export interface AnalysisResult {
  idea: { AppName: string; Description: string; Features: string[]; Target_Audience: string }
  /** The five closest listings, most similar first; app_index points here */
  results: RankedApp[]
  candidate_count: number
  returned_count: number
  feature_matrix: FeatureMatrix
  reviews: { apps: ReviewGroup[] }
  review_status: 'available' | 'partial' | 'unavailable' | 'no_competitors'
  analysis: GeminiAnalysis | null
  analysis_status: 'available' | 'unavailable' | 'no_competitors'
  /** Same order as results */
  revenue?: RevenueEstimate[]
  revenue_status?: 'available' | 'unavailable' | 'no_competitors'
}

export interface AnalysisResponse {
  brief: Brief
  result: AnalysisResult
}
