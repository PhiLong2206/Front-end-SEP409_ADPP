import { PaginationParams } from "./api.types";

export type TopicDifficulty = "Easy" | "Medium" | "Hard" | "Dễ" | "Trung bình" | "Khó";

export interface TopicMaterial {
  id: string;
  topicId: string;
  title: string;
  content: string;
  sourceUrl?: string;
  fileUrl?: string;
  createdAt: string;
}

export interface Topic {
  id?: string | number;
  topicId?: number;
  title: string;
  motion?: string;
  description?: string;
  category?: string;
  difficulty?: TopicDifficulty | string;
  educatorId?: string;
  educatorName?: string;
  organizerId?: string;
  organizerName?: string;
  createdBy?: number;
  createdByUserName?: string;
  materials?: TopicMaterial[];
  backgroundInfo?: string;
  prosHints?: string[];
  consHints?: string[];
  imageUrl?: string;
  /** The task of each side (never null from the Backend): the default text, or the admin's own when hasCustomGuides. */
  proGuide?: string;
  conGuide?: string;
  hasCustomGuides?: boolean;
  practicesCount?: number;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateTopicDto {
  title: string;
  motion?: string;
  description?: string;
  category?: string;
  difficulty?: TopicDifficulty | string;
  backgroundInfo?: string;
  prosHints?: string[];
  consHints?: string[];
  /** Left out: the default text. Up to 1000 characters. */
  proGuide?: string;
  conGuide?: string;
}

export interface UpdateTopicDto extends Partial<CreateTopicDto> {
  isActive?: boolean;
}

export interface TopicFilterParams extends PaginationParams {
  category?: string;
  difficulty?: TopicDifficulty | string;
  isActive?: boolean;
  pageNumber?: number;
  searchTerm?: string;
}
