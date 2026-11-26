export interface FeaturedLearner {
  rank: number;
  userId: number | string;
  fullName: string;
  avatarUrl?: string | null;
  debatesCompleted: number;
  wins: number;
  /** 0–1 */
  winRate: number;
  /** 0–10 */
  averageScore: number;
  bestScore: number;
  lastDebateAt?: string | null;
}

export interface FeaturedLearnersParams {
  /** 0 = mọi thời gian */
  days?: number;
  limit?: number;
  minDebates?: number;
}
