import React from "react";

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
  /** "apple": quiet round numbers, the open page filled with the accent. The default is the look of the admin tables. */
  appearance?: "default" | "apple";
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  className = "",
  appearance = "default",
}) => {
  if (totalPages <= 1) return null;

  const pages: number[] = [];
  for (let i = 1; i <= totalPages; i++) {
    pages.push(i);
  }

  if (appearance === "apple") {
    const step =
      "inline-flex h-11 min-w-11 cursor-pointer items-center justify-center rounded-full px-(--s-4) text-(length:--text-callout) font-medium transition-colors duration-(--t-fast) focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-40";
    return (
      <nav aria-label="Phân trang" className={`flex flex-wrap items-center justify-center gap-1 ${className}`}>
        <button
          type="button"
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
          className={`${step} text-label-secondary hover:bg-canvas-secondary hover:text-label`}
        >
          Trước
        </button>
        {pages.map((page) => (
          <button
            key={page}
            type="button"
            aria-current={page === currentPage ? "page" : undefined}
            onClick={() => onPageChange(page)}
            className={`${step} tabular-nums ${
              page === currentPage
                ? "bg-accent text-accent-contrast"
                : "text-label-secondary hover:bg-canvas-secondary hover:text-label"
            }`}
          >
            {page}
          </button>
        ))}
        <button
          type="button"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className={`${step} text-label-secondary hover:bg-canvas-secondary hover:text-label`}
        >
          Sau
        </button>
      </nav>
    );
  }

  return (
    <div className={`flex items-center justify-center gap-2 mt-6 ${className}`}>
      <button
        type="button"
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
        className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xs"
      >
        Trước
      </button>

      {pages.map((page) => (
        <button
          key={page}
          type="button"
          onClick={() => onPageChange(page)}
          className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
            page === currentPage
              ? "bg-[#0B5ED7] text-white shadow-sm shadow-[#0B5ED7]/20"
              : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
          }`}
        >
          {page}
        </button>
      ))}

      <button
        type="button"
        disabled={currentPage === totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xs"
      >
        Sau
      </button>
    </div>
  );
};

export default Pagination;
