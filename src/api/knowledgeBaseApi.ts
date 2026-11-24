import axiosClient from "./axiosClient";
import type {
  ApiResponse,
  BatchFactCardStatusRequest,
  BatchFactCardStatusResponse,
  CreateKnowledgeSourceRequest,
  CreateKnowledgeSourceResponse,
  DeleteKnowledgeSourceResponse,
  FactCardFilterParams,
  FactCardItem,
  FactCardListResponse,
  FactCardStatus,
  KnowledgeBaseStats,
  KnowledgeSourceFilterParams,
  KnowledgeSourceListResponse,
  UpdateFactCardRequest,
} from "../types";

const knowledgeBaseApi = {
  getStats: (): Promise<ApiResponse<KnowledgeBaseStats>> =>
    axiosClient.get("/knowledge-base/stats"),

  getSources: (
    params?: KnowledgeSourceFilterParams
  ): Promise<ApiResponse<KnowledgeSourceListResponse>> =>
    axiosClient.get("/knowledge-base/sources", {
      params: {
        topic: params?.topic || undefined,
        page: params?.page ?? 1,
        pageSize: params?.pageSize ?? 20,
      },
    }),

  createSource: (
    data: CreateKnowledgeSourceRequest
  ): Promise<ApiResponse<CreateKnowledgeSourceResponse>> =>
    axiosClient.post("/knowledge-base/sources", data),

  deleteSource: (sourceId: string): Promise<ApiResponse<DeleteKnowledgeSourceResponse>> =>
    axiosClient.delete(`/knowledge-base/sources/${sourceId}`),

  getFacts: (
    params?: FactCardFilterParams
  ): Promise<ApiResponse<FactCardListResponse>> =>
    axiosClient.get("/knowledge-base/facts", {
      params: {
        topic: params?.topic || undefined,
        status: params?.status || undefined,
        sourceId: params?.sourceId || undefined,
        q: params?.q?.trim() || undefined,
        page: params?.page ?? 1,
        pageSize: params?.pageSize ?? 20,
      },
    }),

  updateFact: (
    factId: string,
    data: UpdateFactCardRequest
  ): Promise<ApiResponse<FactCardItem>> =>
    axiosClient.patch(`/knowledge-base/facts/${factId}`, data),

  updateFactStatus: (
    factId: string,
    status: FactCardStatus
  ): Promise<ApiResponse<FactCardItem>> =>
    axiosClient.patch(`/knowledge-base/facts/${factId}/status`, { status }),

  batchUpdateFactStatus: (
    data: BatchFactCardStatusRequest
  ): Promise<ApiResponse<BatchFactCardStatusResponse>> =>
    axiosClient.post("/knowledge-base/facts/batch-status", data),

  deleteFact: (factId: string): Promise<ApiResponse<{ deleted?: boolean }>> =>
    axiosClient.delete(`/knowledge-base/facts/${factId}`),
};

export default knowledgeBaseApi;
