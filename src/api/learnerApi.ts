import axiosClient from "./axiosClient";
import { ApiResponse, FeaturedLearner, FeaturedLearnersParams } from "../types";

const learnerApi = {
  // Public, không cần token
  getFeaturedLearners: (params?: FeaturedLearnersParams): Promise<ApiResponse<FeaturedLearner[]>> =>
    axiosClient.get("/learners/featured", { params }),
};

export default learnerApi;
