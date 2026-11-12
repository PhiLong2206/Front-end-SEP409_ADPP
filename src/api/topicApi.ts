import axiosClient from "./axiosClient";
import {
  Topic,
  CreateTopicDto,
  UpdateTopicDto,
  TopicFilterParams,
  ApiResponse,
  PaginatedResponse,
} from "../types";

const topicApi = {
  getAll: (params?: TopicFilterParams): Promise<ApiResponse<PaginatedResponse<Topic>>> => {
    // Map page -> pageNumber, search -> searchTerm for backend compatibility
    const queryParams: Record<string, unknown> = {
      ...params,
      pageNumber: params?.pageNumber ?? params?.page ?? 1,
      pageSize: params?.pageSize ?? 20,
      searchTerm: params?.searchTerm ?? params?.search,
    };
    return axiosClient.get("/topics", { params: queryParams });
  },

  getById: (id: string | number): Promise<ApiResponse<Topic>> =>
    axiosClient.get(`/topics/${id}`),

  create: (data: CreateTopicDto): Promise<ApiResponse<Topic>> =>
    axiosClient.post("/topics", data),

  update: (id: string | number, data: UpdateTopicDto): Promise<ApiResponse<Topic>> =>
    axiosClient.patch(`/topics/${id}`, data),

  delete: (id: string | number): Promise<ApiResponse<void>> =>
    axiosClient.delete(`/topics/${id}`),
};

export default topicApi;
