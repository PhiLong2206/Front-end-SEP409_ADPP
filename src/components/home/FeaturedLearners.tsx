import React, { useEffect, useState } from "react";
import learnerApi from "../../api/learnerApi";
import { FeaturedLearner } from "../../types";

const RANGES = [
  { id: "30", label: "30 ngày", days: 30 },
  { id: "all", label: "Mọi thời gian", days: 0 },
] as const;

const MEDALS: Record<number, { icon: string; label: string }> = {
  1: { icon: "🥇", label: "Hạng nhất" },
  2: { icon: "🥈", label: "Hạng nhì" },
  3: { icon: "🥉", label: "Hạng ba" },
};

const LIMIT = 5;
const listShell =
  "mx-auto max-w-[760px] divide-y divide-separator overflow-hidden rounded-ap-xl border border-separator bg-elevated";

const FeaturedLearners: React.FC = () => {
  const [range, setRange] = useState<(typeof RANGES)[number]["id"]>("30");
  const [learners, setLearners] = useState<FeaturedLearner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const days = RANGES.find((r) => r.id === range)?.days ?? 30;

    const fetchList = async (minDebates: number) => {
      const res = await learnerApi.getFeaturedLearners({ days, limit: LIMIT, minDebates });
      return res?.success && Array.isArray(res.data) ? res.data : [];
    };

    const load = async () => {
      setLoading(true);
      try {
        let list = await fetchList(2);
        if (list.length === 0) list = await fetchList(1);
        if (!cancelled) setLearners(list);
      } catch {
        if (!cancelled) setLearners([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [range]);

  return (
    <section id="leaderboard" className="mx-auto w-full max-w-[1200px] scroll-mt-24 px-5 pb-(--s-8) sm:px-8 lg:pb-(--s-9)">
      <div className="mx-auto mb-(--s-6) max-w-[680px] text-center">
        <h2 className="text-(length:--text-section) font-semibold leading-(--leading-tight) tracking-(--tracking-display)">
          Học sinh nổi bật
        </h2>
        <p className="mt-(--s-3) text-(length:--text-body) leading-(--leading-body) text-label-secondary">
          Những người luyện tập đều đặn và đạt điểm Rubric cao nhất.
        </p>
      </div>

      <div className="mb-(--s-5) flex justify-center">
        <div role="group" aria-label="Khoảng thời gian" className="inline-flex gap-1 rounded-ap-pill bg-canvas-secondary p-1">
          {RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              aria-pressed={range === r.id}
              onClick={() => setRange(r.id)}
              className={`min-h-10 cursor-pointer rounded-ap-pill px-(--s-5) text-(length:--text-callout) font-medium transition-[background-color,box-shadow,color] duration-(--t-base) ease-ap focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/30 ${
                range === r.id ? "bg-elevated text-label shadow-ap-sm" : "text-label-secondary hover:text-label"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <ul aria-busy="true" aria-label="Đang tải" data-testid="featured-learners-skeleton" className={listShell}>
          {Array.from({ length: 3 }).map((_, i) => (
            <li key={i} className="flex items-center gap-(--s-4) p-(--s-4) sm:px-(--s-6)">
              <div className="h-12 w-12 shrink-0 animate-pulse rounded-full bg-canvas-secondary motion-reduce:animate-none" />
              <div className="flex-1 space-y-(--s-2)">
                <div className="h-4 w-1/3 animate-pulse rounded bg-canvas-secondary motion-reduce:animate-none" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-canvas-secondary motion-reduce:animate-none" />
              </div>
              <div className="h-8 w-14 animate-pulse rounded bg-canvas-secondary motion-reduce:animate-none" />
            </li>
          ))}
        </ul>
      ) : learners.length === 0 ? (
        <p className="mx-auto max-w-[760px] rounded-ap-xl border border-separator bg-elevated px-(--s-6) py-(--s-7) text-center text-(length:--text-callout) text-label-secondary">
          Chưa có học sinh nổi bật
        </p>
      ) : (
        <ol className={listShell}>
          {learners.map((l) => {
            const medal = MEDALS[l.rank];
            return (
              <li key={`${l.userId}-${l.rank}`} className="flex items-center gap-(--s-4) p-(--s-4) sm:px-(--s-6)">
                <div className="relative shrink-0">
                  <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-accent-soft text-(length:--text-headline) font-semibold text-accent">
                    {l.avatarUrl ? (
                      <img src={l.avatarUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span aria-hidden="true">{(l.fullName || "?").trim().charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  {medal ? (
                    <span role="img" aria-label={medal.label} className="absolute -bottom-1 -right-2 text-(length:--text-headline) leading-none">
                      {medal.icon}
                    </span>
                  ) : (
                    <span className="absolute -bottom-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-canvas-secondary px-1 text-(length:--text-caption) font-medium tabular-nums text-label-secondary">
                      {l.rank}
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-(length:--text-body) font-medium">{l.fullName}</p>
                  <p className="text-(length:--text-callout) text-label-secondary">
                    Thắng {l.wins}/{l.debatesCompleted} trận ({Math.round(l.winRate * 100)}%)
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-(length:--text-callout) font-semibold tabular-nums">Điểm TB {l.averageScore.toFixed(1)}/10</p>
                  <p className="text-(length:--text-caption) tabular-nums text-label-secondary">Cao nhất {l.bestScore.toFixed(1)}</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
};

export default FeaturedLearners;
