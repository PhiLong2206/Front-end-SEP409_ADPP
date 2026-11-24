export type KnowledgeTopic = "education" | "technology" | "society";

export type KnowledgeSourceType = "manual" | "document" | "url" | "dataset";

export type FactCardStatus = "pending" | "approved" | "rejected";

export interface KnowledgeBaseTopicStats {
  approved: number;
  pending: number;
  rejected: number;
  total: number;
}

export interface KnowledgeBaseStats {
  total_sources: number;
  totals: KnowledgeBaseTopicStats;
  by_topic: Record<string, KnowledgeBaseTopicStats>;
}

export interface KnowledgeSourceItem {
  id: string;
  topic: KnowledgeTopic | string;
  source_type: KnowledgeSourceType | string;
  title: string;
  url: string | null;
  dataset_ref: string | null;
  created_at: string;
  total_facts: number;
  approved_facts: number;
  pending_facts: number;
  rejected_facts: number;
}

export interface KnowledgeSourceListResponse {
  items: KnowledgeSourceItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface KnowledgeSourceFilterParams {
  topic?: string;
  page?: number;
  pageSize?: number;
}

export interface CreateKnowledgeSourceRequest {
  topic: KnowledgeTopic;
  sourceType: KnowledgeSourceType;
  title: string;
  url?: string | null;
  citation?: string | null;
  publishedDate?: string | null;
  rawText?: string | null;
  facts?: string[];
  autoApprove?: boolean;
  chunkSentences?: number;
  chunkOverlap?: number;
}

export interface CreateKnowledgeSourceResponse {
  source_id: string;
  topic: string;
  status: FactCardStatus | string;
  created_facts: number;
}

export interface DeleteKnowledgeSourceResponse {
  deleted: boolean;
  source_id: string;
}

export interface FactCardItem {
  id: string;
  source_id: string;
  topic: KnowledgeTopic | string;
  content: string;
  citation: string | null;
  published_date: string | null;
  status: FactCardStatus;
  has_embedding: boolean;
  created_at: string;
  source_title: string | null;
}

export interface FactCardListResponse {
  items: FactCardItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface FactCardFilterParams {
  topic?: string;
  status?: FactCardStatus | "";
  sourceId?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}

export interface UpdateFactCardRequest {
  content?: string;
  citation?: string | null;
  publishedDate?: string | null;
}

export interface BatchFactCardStatusRequest {
  factIds: string[];
  status: FactCardStatus;
}

export interface BatchFactCardStatusResponse {
  updated_count: number;
  status: FactCardStatus;
}
