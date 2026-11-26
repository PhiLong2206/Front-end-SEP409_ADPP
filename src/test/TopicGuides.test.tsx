import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import TopicGuides from "../components/topic/TopicGuides";
import TaskGuidePanel from "../components/debate/room/TaskGuidePanel";
import TopicSelectCombobox from "../components/topic/TopicSelectCombobox";
import TopicManagement from "../pages/admin/TopicManagement/TopicManagement";
import TopicDetail from "../pages/debater/Topics/TopicDetail";
import {
  defaultGuidePlaceholders,
  guidesForCreate,
  guidesForUpdate,
  initialGuideValues,
} from "../utils/topicGuides";

const mockGetAll = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();

vi.mock("../api/topicApi", () => ({
  default: {
    getAll: (...a: unknown[]) => mockGetAll(...a),
    create: (...a: unknown[]) => mockCreate(...a),
    update: (...a: unknown[]) => mockUpdate(...a),
    getById: vi.fn(),
    delete: vi.fn(),
  },
}));
vi.mock("../api", () => ({ debateApi: { createAiPracticeSession: vi.fn() } }));

const LONG = "Chứng minh rằng kiến nghị đúng. ".repeat(12); // well over 150 characters
const SHORT_PRO = "Bảo vệ kiến nghị.";
const SHORT_CON = "Bác bỏ kiến nghị.";

describe("TopicGuides: the task of each side on a topic", () => {
  it("shows two boxes, PRO and CON, with their own text", () => {
    render(<TopicGuides proGuide={SHORT_PRO} conGuide={SHORT_CON} />);
    expect(screen.getByRole("region", { name: "Nhiệm vụ" })).toBeInTheDocument();
    expect(screen.getByTestId("topic-guide-pro")).toHaveTextContent("Phe Ủng hộ (PRO)");
    expect(screen.getByTestId("topic-guide-pro")).toHaveTextContent(SHORT_PRO);
    expect(screen.getByTestId("topic-guide-con")).toHaveTextContent("Phe Phản đối (CON)");
    expect(screen.getByTestId("topic-guide-con")).toHaveTextContent(SHORT_CON);
    // a short text has no "Xem thêm"
    expect(screen.queryByTestId("topic-guide-pro-toggle")).not.toBeInTheDocument();
  });

  it("a long guide is cut to 3 lines with 'Xem thêm', which opens and closes it", () => {
    render(<TopicGuides proGuide={LONG} conGuide={SHORT_CON} />);
    const text = screen.getByTestId("topic-guide-pro-text");
    expect(text.className).toContain("line-clamp-3");

    fireEvent.click(screen.getByTestId("topic-guide-pro-toggle"));
    expect(screen.getByTestId("topic-guide-pro-text").className).not.toContain("line-clamp-3");
    expect(screen.getByTestId("topic-guide-pro-toggle")).toHaveTextContent("Thu gọn");
    expect(screen.getByTestId("topic-guide-pro-toggle")).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(screen.getByTestId("topic-guide-pro-toggle"));
    expect(screen.getByTestId("topic-guide-pro-text").className).toContain("line-clamp-3");
    expect(screen.getByTestId("topic-guide-pro-toggle")).toHaveTextContent("Xem thêm");
  });

  it("a text with many lines counts as long too", () => {
    render(<TopicGuides proGuide={"1\n2\n3\n4"} conGuide="" />);
    expect(screen.getByTestId("topic-guide-pro-toggle")).toBeInTheDocument();
  });

  it("shows nothing when the topic has no guides", () => {
    const { container } = render(<TopicGuides proGuide="" conGuide="  " />);
    expect(container).toBeEmptyDOMElement();
  });

  it("is on the topic page, in the overview", () => {
    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/debater/topics/7",
            state: { topic: { topicId: 7, title: "Luật AI", motion: "AI cần luật", proGuide: SHORT_PRO, conGuide: SHORT_CON } },
          },
        ]}
      >
        <Routes>
          <Route path="/debater/topics/:id" element={<TopicDetail />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByTestId("topic-guides")).toBeInTheDocument();
    expect(screen.getByTestId("topic-guide-con")).toHaveTextContent(SHORT_CON);
  });
});

describe("TaskGuidePanel: 'Nhiệm vụ của bạn' in the room", () => {
  it("shows the task of my side, highlighted, and the other side's task in a fold", () => {
    render(<TaskGuidePanel side="pro" proGuide={SHORT_PRO} conGuide={SHORT_CON} />);
    const panel = screen.getByTestId("task-guide-panel");
    expect(panel).toHaveAttribute("data-side", "pro");
    expect(screen.getByTestId("task-guide-mine")).toHaveTextContent(SHORT_PRO);
    expect(panel).toHaveTextContent("Nhiệm vụ của bạn");
    expect(panel).toHaveTextContent("Phe Ủng hộ (PRO)");

    const other = screen.getByTestId("task-guide-other");
    expect(other).toHaveTextContent("Nhiệm vụ của Phe Phản đối (CON)");
    expect(other).toHaveTextContent(SHORT_CON); // in the fold, smaller
    expect(within(panel).getByTestId("task-guide-mine")).not.toHaveTextContent(SHORT_CON);
  });

  it("a CON user gets the CON task", () => {
    render(<TaskGuidePanel side="con" proGuide={SHORT_PRO} conGuide={SHORT_CON} />);
    expect(screen.getByTestId("task-guide-mine")).toHaveTextContent(SHORT_CON);
    expect(screen.getByTestId("task-guide-other")).toHaveTextContent(SHORT_PRO);
  });

  it("after a side swap (a new session response) the task follows the new side", () => {
    const { rerender } = render(<TaskGuidePanel side="pro" proGuide={SHORT_PRO} conGuide={SHORT_CON} />);
    expect(screen.getByTestId("task-guide-mine")).toHaveTextContent(SHORT_PRO);
    rerender(<TaskGuidePanel side="con" proGuide={SHORT_PRO} conGuide={SHORT_CON} />);
    expect(screen.getByTestId("task-guide-mine")).toHaveTextContent(SHORT_CON);
    expect(screen.getByTestId("task-guide-panel")).toHaveAttribute("data-side", "con");
  });

  it("a long task has 'Xem thêm'; the whole panel folds to its title bar and opens again", () => {
    render(<TaskGuidePanel side="pro" proGuide={LONG} conGuide={SHORT_CON} />);
    expect(screen.getByTestId("task-guide-mine").className).toContain("line-clamp-3");
    fireEvent.click(screen.getByTestId("task-guide-mine-toggle"));
    expect(screen.getByTestId("task-guide-mine").className).not.toContain("line-clamp-3");

    fireEvent.click(screen.getByTestId("task-guide-toggle"));
    expect(screen.queryByTestId("task-guide-mine")).not.toBeInTheDocument();
    expect(screen.getByTestId("task-guide-toggle")).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(screen.getByTestId("task-guide-toggle"));
    expect(screen.getByTestId("task-guide-mine")).toBeInTheDocument();
  });

  it("starts folded when asked to, and the user's own choice wins afterwards", () => {
    const { rerender } = render(<TaskGuidePanel side="pro" proGuide={SHORT_PRO} conGuide={SHORT_CON} defaultOpen={false} />);
    expect(screen.queryByTestId("task-guide-mine")).not.toBeInTheDocument();

    // the preparation starts: it opens by itself ...
    rerender(<TaskGuidePanel side="pro" proGuide={SHORT_PRO} conGuide={SHORT_CON} defaultOpen />);
    expect(screen.getByTestId("task-guide-mine")).toBeInTheDocument();

    // ... but not once the user chose
    fireEvent.click(screen.getByTestId("task-guide-toggle"));
    rerender(<TaskGuidePanel side="pro" proGuide={SHORT_PRO} conGuide={SHORT_CON} defaultOpen={false} />);
    expect(screen.queryByTestId("task-guide-mine")).not.toBeInTheDocument();
  });

  it("shows nothing when there is no guide", () => {
    const { container } = render(<TaskGuidePanel side="pro" proGuide="" conGuide="" />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("the guides sent by the admin form", () => {
  it("a topic on the default text starts with empty fields and shows the default only as the placeholder", () => {
    const topic = { proGuide: "Mặc định PRO", conGuide: "Mặc định CON", hasCustomGuides: false };
    expect(initialGuideValues(topic)).toEqual({ pro: "", con: "" });
    expect(defaultGuidePlaceholders(topic)).toEqual({ pro: "Mặc định PRO", con: "Mặc định CON" });
  });

  it("a topic with its own guides starts with them, and has no default placeholder", () => {
    const topic = { proGuide: "Riêng PRO", conGuide: "Riêng CON", hasCustomGuides: true };
    expect(initialGuideValues(topic)).toEqual({ pro: "Riêng PRO", con: "Riêng CON" });
    expect(defaultGuidePlaceholders(topic)).toEqual({});
  });

  it("create sends only what was typed", () => {
    expect(guidesForCreate({ pro: "", con: "" })).toEqual({});
    expect(guidesForCreate({ pro: "  Nhiệm vụ PRO ", con: "" })).toEqual({ proGuide: "Nhiệm vụ PRO" });
  });

  it("update leaves out a field that did not change, sends a changed one, and '' for a cleared custom one", () => {
    const initial = { pro: "Riêng PRO", con: "Riêng CON" };
    expect(guidesForUpdate(initial, initial)).toEqual({}); // untouched: the Backend keeps its text
    expect(guidesForUpdate(initial, { pro: "Mới", con: "Riêng CON" })).toEqual({ proGuide: "Mới" });
    expect(guidesForUpdate(initial, { pro: "", con: "Riêng CON" })).toEqual({ proGuide: "" }); // back to default
    expect(guidesForUpdate({ pro: "", con: "" }, { pro: "", con: "" })).toEqual({}); // default topic, nothing typed
  });
});

describe("the admin topic form", () => {
  const defaultTopic = {
    topicId: 1,
    title: "Chủ đề mặc định",
    description: "Kiến nghị 1",
    category: "technology",
    difficulty: "Medium",
    isActive: true,
    proGuide: "Hướng dẫn mặc định PRO",
    conGuide: "Hướng dẫn mặc định CON",
    hasCustomGuides: false,
  };
  const customTopic = {
    ...defaultTopic,
    topicId: 2,
    title: "Chủ đề riêng",
    proGuide: "Hướng dẫn riêng PRO",
    conGuide: "Hướng dẫn riêng CON",
    hasCustomGuides: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAll.mockResolvedValue({
      success: true,
      data: { items: [defaultTopic, customTopic], totalCount: 2, totalPages: 1 },
    });
    mockCreate.mockResolvedValue({ success: true, data: {} });
    mockUpdate.mockResolvedValue({ success: true, data: {} });
  });

  const renderPage = () =>
    render(
      <MemoryRouter>
        <TopicManagement />
      </MemoryRouter>
    );

  const openEdit = async (title: string) => {
    const row = (await screen.findByText(title)).closest("tr") as HTMLElement;
    fireEvent.click(within(row).getByTitle("Chỉnh sửa chủ đề"));
  };

  it("create: two textareas with a counter and a limit of 1000 characters", async () => {
    renderPage();
    fireEvent.click(await screen.findByText("Thêm chủ đề mới"));

    const pro = screen.getByLabelText("Nhiệm vụ phe PRO") as HTMLTextAreaElement;
    const con = screen.getByLabelText("Nhiệm vụ phe CON") as HTMLTextAreaElement;
    expect(pro.maxLength).toBe(1000);
    expect(con.maxLength).toBe(1000);
    expect(screen.getByTestId("topic-create-pro-guide-counter")).toHaveTextContent("0/1000");

    fireEvent.change(pro, { target: { value: "a".repeat(1200) } });
    expect(pro.value).toHaveLength(1000);
    expect(screen.getByTestId("topic-create-pro-guide-counter")).toHaveTextContent("1000/1000");
  });

  it("create: sends proGuide / conGuide only when typed", async () => {
    renderPage();
    fireEvent.click(await screen.findByText("Thêm chủ đề mới"));
    fireEvent.change(screen.getByPlaceholderText(/Chúng tôi tin rằng/), { target: { value: "Chủ đề mới" } });
    fireEvent.change(screen.getByTestId("topic-category-select"), { target: { value: "technology" } }); // required
    fireEvent.change(screen.getByLabelText("Nhiệm vụ phe PRO"), { target: { value: "Nhiệm vụ PRO mới" } });
    fireEvent.click(screen.getByText("Tạo chủ đề"));

    await waitFor(() => expect(mockCreate).toHaveBeenCalled());
    const body = mockCreate.mock.calls[0][0];
    expect(body.proGuide).toBe("Nhiệm vụ PRO mới");
    expect("conGuide" in body).toBe(false); // empty: the Backend uses its default
  });

  it("edit, a topic on the default text: the fields are empty and the default is the placeholder", async () => {
    renderPage();
    await openEdit("Chủ đề mặc định");

    const pro = screen.getByLabelText("Nhiệm vụ phe PRO") as HTMLTextAreaElement;
    const con = screen.getByLabelText("Nhiệm vụ phe CON") as HTMLTextAreaElement;
    expect(pro.value).toBe("");
    expect(con.value).toBe("");
    expect(pro.placeholder).toBe("Hướng dẫn mặc định PRO");
    expect(con.placeholder).toBe("Hướng dẫn mặc định CON");
  });

  it("edit, nothing typed: the default text is NOT saved (both fields left out of the update)", async () => {
    renderPage();
    await openEdit("Chủ đề mặc định");
    fireEvent.click(screen.getByText("Lưu thay đổi"));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
    const body = mockUpdate.mock.calls[0][1];
    expect("proGuide" in body).toBe(false);
    expect("conGuide" in body).toBe(false);
    expect(JSON.stringify(body)).not.toContain("mặc định PRO");
  });

  it("edit, a default topic with a typed guide: only that guide is sent", async () => {
    renderPage();
    await openEdit("Chủ đề mặc định");
    fireEvent.change(screen.getByLabelText("Nhiệm vụ phe CON"), { target: { value: "Nhiệm vụ CON riêng" } });
    fireEvent.click(screen.getByText("Lưu thay đổi"));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
    const body = mockUpdate.mock.calls[0][1];
    expect(body.conGuide).toBe("Nhiệm vụ CON riêng");
    expect("proGuide" in body).toBe(false);
  });

  it("edit, a topic with its own guides: they fill the fields; untouched = left out; cleared = ''", async () => {
    renderPage();
    await openEdit("Chủ đề riêng");
    expect((screen.getByLabelText("Nhiệm vụ phe PRO") as HTMLTextAreaElement).value).toBe("Hướng dẫn riêng PRO");
    expect((screen.getByLabelText("Nhiệm vụ phe CON") as HTMLTextAreaElement).value).toBe("Hướng dẫn riêng CON");

    fireEvent.change(screen.getByLabelText("Nhiệm vụ phe PRO"), { target: { value: "" } }); // back to the default
    fireEvent.click(screen.getByText("Lưu thay đổi"));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
    const body = mockUpdate.mock.calls[0][1];
    expect(body.proGuide).toBe("");
    expect("conGuide" in body).toBe(false); // kept
  });
});

describe("the topic pickers (AI practice, 1v1 and 2v2 rooms) show the guides of the chosen topic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAll.mockResolvedValue({
      success: true,
      data: {
        items: [
          { topicId: 5, title: "Luật AI", description: "AI cần luật", category: "technology", difficulty: "Medium", isActive: true, proGuide: SHORT_PRO, conGuide: SHORT_CON },
          { topicId: 6, title: "Không có hướng dẫn", description: "Kiến nghị khác", category: "society", difficulty: "Easy", isActive: true },
        ],
      },
    });
  });

  it("shows 'Nhiệm vụ' with both sides once a topic with guides is selected", async () => {
    render(<TopicSelectCombobox selectedTopicId={5} onSelect={() => {}} />);
    expect(await screen.findByTestId("topic-guides")).toBeInTheDocument();
    expect(screen.getByTestId("topic-guide-pro")).toHaveTextContent(SHORT_PRO);
    expect(screen.getByTestId("topic-guide-con")).toHaveTextContent(SHORT_CON);
  });

  it("shows nothing for no selection, or a topic without guides", async () => {
    const { rerender } = render(<TopicSelectCombobox selectedTopicId={null} onSelect={() => {}} />);
    await screen.findByTestId("topic-combobox-trigger");
    expect(screen.queryByTestId("topic-guides")).not.toBeInTheDocument();
    rerender(<TopicSelectCombobox selectedTopicId={6} onSelect={() => {}} />);
    expect(screen.queryByTestId("topic-guides")).not.toBeInTheDocument();
  });
});
