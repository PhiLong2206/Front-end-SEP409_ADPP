import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AxiosError, AxiosHeaders } from "axios";
import KnowledgeBaseManagement from "../pages/shared/KnowledgeBase/KnowledgeBaseManagement";
import { knowledgeBaseApi } from "../api";
import { useAuth } from "../hooks/useAuth";
import { ROLES } from "../utils/constants";

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return {
    ...actual,
    knowledgeBaseApi: {
      getStats: vi.fn(),
      getSources: vi.fn(),
      createSource: vi.fn(),
      deleteSource: vi.fn(),
      getFacts: vi.fn(),
      updateFact: vi.fn(),
      updateFactStatus: vi.fn(),
      batchUpdateFactStatus: vi.fn(),
      deleteFact: vi.fn(),
    },
  };
});

vi.mock("../hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

const mockedApi = vi.mocked(knowledgeBaseApi);
const mockedUseAuth = vi.mocked(useAuth);

const SAMPLE_STATS = {
  total_sources: 5,
  totals: { approved: 24, pending: 6, rejected: 2, total: 32 },
  by_topic: {
    education: { approved: 14, pending: 4, rejected: 1, total: 19 },
    technology: { approved: 10, pending: 2, rejected: 1, total: 13 },
  },
};

const SAMPLE_SOURCES = {
  items: [
    {
      id: "src-1",
      topic: "education",
      source_type: "document",
      title: "Báo cáo UNESCO 2025",
      url: "https://example.org/unesco",
      dataset_ref: null,
      created_at: "2026-11-24T13:45:00+00:00",
      total_facts: 5,
      approved_facts: 3,
      pending_facts: 2,
      rejected_facts: 0,
    },
  ],
  total: 1,
  page: 1,
  page_size: 20,
};

const SAMPLE_FACTS = {
  items: [
    {
      id: "fact-1",
      source_id: "src-1",
      topic: "education",
      content: "Tỷ lệ biết chữ toàn cầu đạt 95% theo báo cáo mới nhất.",
      citation: "UNESCO Global Report 2025",
      published_date: "2025-09-01",
      status: "pending" as const,
      has_embedding: true,
      created_at: "2026-11-24T13:45:00+00:00",
      source_title: "Báo cáo UNESCO 2025",
    },
  ],
  total: 1,
  page: 1,
  page_size: 20,
};

describe("KnowledgeBaseManagement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseAuth.mockReturnValue({
      role: ROLES.ADMIN,
    } as ReturnType<typeof useAuth>);

    mockedApi.getStats.mockResolvedValue({
      success: true,
      message: "Success",
      data: SAMPLE_STATS,
    });
    mockedApi.getSources.mockResolvedValue({
      success: true,
      message: "Success",
      data: SAMPLE_SOURCES,
    });
    mockedApi.getFacts.mockResolvedValue({
      success: true,
      message: "Success",
      data: SAMPLE_FACTS,
    });
    mockedApi.createSource.mockResolvedValue({
      success: true,
      message: "Created",
      data: { source_id: "src-2", topic: "education", status: "pending", created_facts: 3 },
    });
    mockedApi.batchUpdateFactStatus.mockResolvedValue({
      success: true,
      message: "Updated",
      data: { updated_count: 1, status: "approved" },
    });
  });

  it("renders KPI stats and sources list on initial load", async () => {
    render(<KnowledgeBaseManagement />);

    expect(await screen.findByText("Báo cáo UNESCO 2025")).toBeInTheDocument();
    expect(screen.getByText("24")).toBeInTheDocument();
    expect(screen.getByText("32")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("shows 503 banner gracefully without crashing when RAG service is unavailable", async () => {
    const err503 = new AxiosError(
      "Service Unavailable",
      "ERR_BAD_RESPONSE",
      undefined,
      undefined,
      {
        status: 503,
        statusText: "Service Unavailable",
        headers: new AxiosHeaders(),
        config: { headers: new AxiosHeaders() },
        data: { success: false, message: "RAG_ENABLED=false or pgvector unavailable" },
      }
    );
    mockedApi.getStats.mockRejectedValueOnce(err503);
    mockedApi.getSources.mockRejectedValueOnce(err503);

    render(<KnowledgeBaseManagement />);

    const banner = await screen.findByTestId("kb-service-banner");
    expect(banner).toHaveTextContent("HTTP 503");
    expect(banner).toHaveTextContent("RAG_ENABLED=false or pgvector unavailable");
  });

  it("allows Admin to create a new source and hides autoApprove for Organizer", async () => {
    const { unmount } = render(<KnowledgeBaseManagement />);
    await screen.findByText("Báo cáo UNESCO 2025");

    fireEvent.click(screen.getByRole("button", { name: /Nạp tài liệu mới/i }));
    expect(screen.getByText(/Tự động duyệt ngay/i)).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/Ví dụ: Báo cáo UNESCO 2025/i), {
      target: { value: "Nghiên cứu AI 2026" },
    });
    fireEvent.change(screen.getByPlaceholderText(/Dán nội dung báo cáo/i), {
      target: { value: "Câu 1. Câu 2. Câu 3." },
    });
    fireEvent.click(screen.getByRole("button", { name: /Nạp nguồn tài liệu/i }));

    await waitFor(() => {
      expect(mockedApi.createSource).toHaveBeenCalledWith(
        expect.objectContaining({
          topic: "education",
          sourceType: "document",
          title: "Nghiên cứu AI 2026",
          rawText: "Câu 1. Câu 2. Câu 3.",
        })
      );
    });

    unmount();

    mockedUseAuth.mockReturnValue({
      role: ROLES.ORGANIZER,
    } as ReturnType<typeof useAuth>);
    render(<KnowledgeBaseManagement />);
    await screen.findByText("Báo cáo UNESCO 2025");
    fireEvent.click(screen.getByRole("button", { name: /Nạp tài liệu mới/i }));
    expect(screen.queryByText(/Tự động duyệt ngay/i)).not.toBeInTheDocument();
  });

  it("switches to Fact Cards tab with pending default and supports batch approve", async () => {
    render(<KnowledgeBaseManagement />);
    await screen.findByText("Báo cáo UNESCO 2025");

    fireEvent.click(screen.getByRole("button", { name: /Kiểm duyệt Dữ kiện/i }));

    expect(
      await screen.findByText("Tỷ lệ biết chữ toàn cầu đạt 95% theo báo cáo mới nhất.")
    ).toBeInTheDocument();
    expect(mockedApi.getFacts).toHaveBeenCalledWith(
      expect.objectContaining({ status: "pending", page: 1, pageSize: 20 })
    );

    fireEvent.click(screen.getByLabelText("Chọn fact fact-1"));
    fireEvent.click(screen.getByRole("button", { name: /Duyệt hàng loạt/i }));

    await waitFor(() => {
      expect(mockedApi.batchUpdateFactStatus).toHaveBeenCalledWith({
        factIds: ["fact-1"],
        status: "approved",
      });
    });
  });
});
