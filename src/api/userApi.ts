import axiosClient from "./axiosClient";
import {
  ApiResponse,
  PaginatedResponse,
  PaginationParams,
  UpdateProfileRequest,
  User,
  UserProfileResponse,
} from "../types";

const userApi = {
  /**
   * GET /api/users/me [Authorized]
   * Gets current logged-in user profile with roles and account metadata.
   */
  getMyProfile: (): Promise<ApiResponse<UserProfileResponse>> =>
    axiosClient.get("/users/me"),

  /**
   * Alias for getMyProfile
   */
  getProfile: (): Promise<ApiResponse<UserProfileResponse>> =>
    axiosClient.get("/users/me"),

  /**
   * PUT /api/users/me [Authorized]
   * Updates profile information (FullName, AvatarUrl, DateOfBirth, Gender, PhoneNumber)
   */
  updateMyProfile: (data: UpdateProfileRequest): Promise<ApiResponse<UserProfileResponse>> =>
    axiosClient.put("/users/me", data),

  /**
   * Alias for updateMyProfile
   */
  updateProfile: (data: UpdateProfileRequest): Promise<ApiResponse<UserProfileResponse>> =>
    axiosClient.put("/users/me", data),

  // -------------------------------------------------------------
  // Admin Management Endpoints
  // -------------------------------------------------------------
  getAllUsers: (params?: PaginationParams): Promise<ApiResponse<PaginatedResponse<User>>> => {
    const queryParams: Record<string, unknown> = {
      searchTerm: params?.search,
      pageNumber: params?.page ?? 1,
      pageSize: params?.pageSize ?? 10,
    };
    return axiosClient.get("/admin/users", { params: queryParams });
  },

  getUserById: (id: string | number): Promise<ApiResponse<User>> =>
    axiosClient.get(`/admin/users/${id}`),

  updateUserStatus: (id: string | number, isActive: boolean): Promise<ApiResponse<User>> =>
    axiosClient.patch(`/admin/users/${id}/status`, { isActive }),
};

export default userApi;

