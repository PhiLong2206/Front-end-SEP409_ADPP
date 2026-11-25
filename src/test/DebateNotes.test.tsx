import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import DebateNotesPanel from "../components/debate/room/DebateNotesPanel";
import RoundStatusBar from "../components/debate/room/RoundStatusBar";
import {
  MAX_NOTE_CHARS,
  MAX_NOTE_TABS,
  notesKey,
  useDebateNotes,
  type StoredNotes,
} from "../hooks/useDebateNotes";
import { clampRect } from "../hooks/useDraggablePanel";

interface HarnessProps {
  sessionId?: string;
  userId?: number;
  enabled?: boolean;
  ended?: boolean;
  onRoomKey?: (e: React.KeyboardEvent) => void;
  onRoomClick?: () => void;
}

/** The room in miniature: a record button, the notes button and the card, inside a place that listens to keys. */
const Harness: React.FC<HarnessProps> = ({
  sessionId = "s1",
  userId = 1,
  enabled = true,
  ended = false,
  onRoomKey,
  onRoomClick,
}) => {
  const notes = useDebateNotes({ sessionId, userId, enabled, ended, roundLabel: "Phản biện" });
  return (
    <div onKeyDown={onRoomKey} onClick={onRoomClick}>
      <button type="button" data-testid="record">
        Ghi âm
      </button>
      {enabled && (
        <button type="button" data-testid="open-notes" onClick={notes.toggleOpen}>
          Ghi chú {notes.hasNotes ? "(có)" : ""}
        </button>
      )}
      {enabled && notes.open && <DebateNotesPanel notes={notes} roundLabel="Phản biện" />}
    </div>
  );
};

const KEY = notesKey("s1", 1);
const stored = (): StoredNotes | null => {
  const raw = localStorage.getItem(KEY);
  return raw ? (JSON.parse(raw) as StoredNotes) : null;
};
const advance = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};
const open = () => fireEvent.click(screen.getByTestId("open-notes"));
const type = (value: string) => fireEvent.change(screen.getByTestId("notes-textarea"), { target: { value } });

describe("the notes card", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 1024 });
    Object.defineProperty(window, "innerHeight", { configurable: true, writable: true, value: 768 });
  });
  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  describe("pages", () => {
    it("starts with one page named after the round; add, rename, remove; at least one page always stays", () => {
      render(<Harness />);
      open();

      let tabs = screen.getAllByRole("tab");
      expect(tabs).toHaveLength(1);
      expect(tabs[0]).toHaveTextContent("Phản biện");
      expect(screen.getByTestId("notes-remove-tab")).toBeDisabled(); // the last page cannot go

      fireEvent.click(screen.getByTestId("notes-add-tab"));
      fireEvent.click(screen.getByTestId("notes-add-tab"));
      tabs = screen.getAllByRole("tab");
      expect(tabs.map((t) => t.textContent)).toEqual(["Phản biện", "Trang 1", "Trang 2"]);
      expect(tabs[2]).toHaveAttribute("aria-selected", "true"); // the new page is open

      // Rename with a double click: at most 30 characters
      fireEvent.doubleClick(tabs[1]);
      const input = screen.getByTestId("notes-rename-input") as HTMLInputElement;
      expect(input.maxLength).toBe(30);
      fireEvent.change(input, { target: { value: "Luận điểm chính" } });
      fireEvent.keyDown(input, { key: "Enter" });
      expect(screen.getAllByRole("tab")[1]).toHaveTextContent("Luận điểm chính");

      // Remove an empty page: no question
      fireEvent.click(screen.getByTestId("notes-remove-tab"));
      expect(screen.getAllByRole("tab")).toHaveLength(2);
      fireEvent.click(screen.getAllByRole("tab")[1]);
      fireEvent.click(screen.getByTestId("notes-remove-tab"));
      expect(screen.getAllByRole("tab")).toHaveLength(1);
      expect(screen.getByTestId("notes-remove-tab")).toBeDisabled();
    });

    it("removing a page that has text asks first", () => {
      render(<Harness />);
      open();
      fireEvent.click(screen.getByTestId("notes-add-tab"));
      type("Ý quan trọng");

      fireEvent.click(screen.getByTestId("notes-remove-tab"));
      expect(screen.getByTestId("notes-confirm-remove")).toBeInTheDocument();
      expect(screen.getAllByRole("tab")).toHaveLength(2);

      fireEvent.click(screen.getByTestId("notes-confirm-remove-no"));
      expect(screen.getAllByRole("tab")).toHaveLength(2);
      fireEvent.click(screen.getByTestId("notes-remove-tab"));
      fireEvent.click(screen.getByTestId("notes-confirm-remove-yes"));
      expect(screen.getAllByRole("tab")).toHaveLength(1);
    });

    it("at most 10 pages", () => {
      render(<Harness />);
      open();
      for (let i = 0; i < MAX_NOTE_TABS + 3; i += 1) fireEvent.click(screen.getByTestId("notes-add-tab"));
      expect(screen.getAllByRole("tab")).toHaveLength(MAX_NOTE_TABS);
      expect(screen.getByTestId("notes-add-tab")).toBeDisabled();
      expect(screen.getByTestId("notes-add-round-tab")).toBeDisabled();
    });

    it("'Trang cho vòng này' makes a page named after the round", () => {
      render(<Harness />);
      open();
      fireEvent.click(screen.getByTestId("notes-add-round-tab"));
      const tabs = screen.getAllByRole("tab");
      expect(tabs[tabs.length - 1]).toHaveTextContent("Phản biện");
    });

    it("the arrow keys move between pages (tablist / tab / tabpanel)", () => {
      render(<Harness />);
      open();
      fireEvent.click(screen.getByTestId("notes-add-tab"));
      fireEvent.click(screen.getByTestId("notes-add-tab"));
      expect(screen.getByRole("tablist")).toBeInTheDocument();
      expect(screen.getByRole("tabpanel")).toBeInTheDocument();

      fireEvent.click(screen.getAllByRole("tab")[0]);
      fireEvent.keyDown(screen.getAllByRole("tab")[0], { key: "ArrowRight" });
      expect(screen.getAllByRole("tab")[1]).toHaveAttribute("aria-selected", "true");
      fireEvent.keyDown(screen.getAllByRole("tab")[1], { key: "ArrowLeft" });
      expect(screen.getAllByRole("tab")[0]).toHaveAttribute("aria-selected", "true");
      fireEvent.keyDown(screen.getAllByRole("tab")[0], { key: "ArrowLeft" }); // wraps around
      expect(screen.getAllByRole("tab")[2]).toHaveAttribute("aria-selected", "true");
    });
  });

  describe("text and saving", () => {
    it("a page keeps 5,000 characters at most; the counter shows above 4,500", () => {
      render(<Harness />);
      open();
      type("a".repeat(4400));
      expect(screen.queryByTestId("notes-counter")).not.toBeInTheDocument();
      type("a".repeat(4600));
      expect(screen.getByTestId("notes-counter")).toHaveTextContent("4600/5000");
      type("a".repeat(6000));
      expect((screen.getByTestId("notes-textarea") as HTMLTextAreaElement).value).toHaveLength(MAX_NOTE_CHARS);
    });

    it("saves 300 ms after typing under the right key, and says 'Đã lưu'", async () => {
      render(<Harness />);
      open();
      type("Luận điểm 1");
      await advance(250);
      expect(localStorage.getItem(KEY)).toBeNull();
      expect(screen.getByTestId("notes-saved")).toHaveTextContent("");

      await advance(100);
      expect(stored()?.tabs[0].text).toBe("Luận điểm 1");
      expect(stored()?.version).toBe(1);
      expect(typeof stored()?.updatedAt).toBe("number");
      expect(screen.getByTestId("notes-saved")).toHaveTextContent("Đã lưu");
      expect(Object.keys(localStorage)).toEqual(["adpp.debateNotes.s1.1"]);
    });

    it("coming back restores the text, the open page, the place and whether it was open", async () => {
      const first = render(<Harness />);
      open();
      fireEvent.click(screen.getByTestId("notes-add-tab"));
      type("Trang hai");
      fireEvent.click(screen.getAllByRole("tab")[0]);
      type("Trang một");
      fireEvent.click(screen.getAllByRole("tab")[1]);
      // move the card
      const bar = screen.getByTestId("debate-notes-titlebar");
      fireEvent.pointerDown(bar, { clientX: 500, clientY: 300, pointerId: 1, button: 0 });
      fireEvent.pointerMove(bar, { clientX: 450, clientY: 260, pointerId: 1 });
      fireEvent.pointerUp(bar, { clientX: 450, clientY: 260, pointerId: 1 });
      const rect = stored()?.rect ?? null;
      await advance(400);
      const saved = stored()!;
      expect(saved.activeTab).toBe(saved.tabs[1].id);
      expect(rect).toBeNull(); // nothing was written before the 300 ms
      first.unmount();

      render(<Harness />);
      expect(screen.getByTestId("debate-notes-panel")).toBeInTheDocument(); // it was open
      expect(screen.getAllByRole("tab")).toHaveLength(2);
      expect(screen.getAllByRole("tab")[1]).toHaveAttribute("aria-selected", "true");
      expect((screen.getByTestId("notes-textarea") as HTMLTextAreaElement).value).toBe("Trang hai");
      fireEvent.click(screen.getAllByRole("tab")[0]);
      expect((screen.getByTestId("notes-textarea") as HTMLTextAreaElement).value).toBe("Trang một");
      const panel = screen.getByTestId("debate-notes-panel");
      expect(panel.style.left).toBe(`${saved.rect.x}px`);
      expect(panel.style.top).toBe(`${saved.rect.y}px`);
    });

    it("notes saved earlier are read when the role becomes known (the room learns it after its first render)", async () => {
      const saved: StoredNotes = {
        version: 1,
        updatedAt: Date.now(),
        open: true,
        collapsed: false,
        rect: { x: 10, y: 80, w: 340, h: 420 },
        activeTab: "t2",
        tabs: [
          { id: "t1", title: "Mở đầu", text: "Cũ 1" },
          { id: "t2", title: "Phản biện", text: "Cũ 2" },
        ],
      };
      localStorage.setItem(KEY, JSON.stringify(saved));
      const view = render(<Harness enabled={false} />); // role not known yet
      expect(screen.queryByTestId("debate-notes-panel")).not.toBeInTheDocument();

      view.rerender(<Harness enabled />);
      expect(screen.getByTestId("debate-notes-panel")).toBeInTheDocument();
      expect((screen.getByTestId("notes-textarea") as HTMLTextAreaElement).value).toBe("Cũ 2");

      // the first edit adds to the saved notes, it does not replace them
      type("Cũ 2 và mới");
      await advance(400);
      expect(stored()?.tabs.map((t) => t.text)).toEqual(["Cũ 1", "Cũ 2 và mới"]);
    });

    it("a card saved on a bigger screen opens inside this one", () => {
      Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 700 });
      Object.defineProperty(window, "innerHeight", { configurable: true, writable: true, value: 500 });
      const saved: StoredNotes = {
        version: 1,
        updatedAt: Date.now(),
        open: true,
        collapsed: false,
        rect: { x: 1500, y: 900, w: 340, h: 420 },
        activeTab: "t1",
        tabs: [{ id: "t1", title: "Mở đầu", text: "" }],
      };
      localStorage.setItem(KEY, JSON.stringify(saved));
      render(<Harness />);
      const panel = screen.getByTestId("debate-notes-panel");
      expect(parseFloat(panel.style.left) + parseFloat(panel.style.width)).toBeLessThanOrEqual(700);
      expect(parseFloat(panel.style.top) + parseFloat(panel.style.height)).toBeLessThanOrEqual(500);
    });

    it("moving the card saves its place once, when the gesture ends, not on every move", async () => {
      render(<Harness />);
      open();
      await advance(400);
      const setItem = vi.spyOn(Storage.prototype, "setItem");
      const bar = screen.getByTestId("debate-notes-titlebar");

      fireEvent.pointerDown(bar, { clientX: 600, clientY: 400, pointerId: 1, button: 0 });
      for (let i = 1; i <= 10; i += 1) fireEvent.pointerMove(bar, { clientX: 600 - i * 5, clientY: 400, pointerId: 1 });
      await advance(500);
      expect(setItem).not.toHaveBeenCalled(); // still dragging
      expect(screen.getByTestId("notes-saved")).toHaveTextContent("Đã lưu"); // no flicker

      fireEvent.pointerUp(bar, { clientX: 550, clientY: 400, pointerId: 1 });
      await advance(400);
      expect(setItem).toHaveBeenCalledTimes(1);
      expect(stored()?.rect.x).toBeLessThan(700);
      setItem.mockRestore();
    });

    it("leaving the room right after typing still keeps the last text", () => {
      const view = render(<Harness />);
      open();
      type("Gõ vội");
      view.unmount();
      expect(stored()?.tabs[0].text).toBe("Gõ vội");
    });

    it("storage that is broken or blocked: the notes still work, they are just not kept", async () => {
      localStorage.setItem(KEY, "{not json");
      const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });
      render(<Harness />);
      open();
      type("Vẫn gõ được");
      await advance(400);
      expect((screen.getByTestId("notes-textarea") as HTMLTextAreaElement).value).toBe("Vẫn gõ được");
      expect(screen.getByTestId("notes-saved")).toHaveTextContent("");
      setItem.mockRestore();
    });
  });

  describe("cleaning up", () => {
    it("after the debate ended, leaving the room deletes the notes of the session", async () => {
      const view = render(<Harness />);
      open();
      type("Sẽ bị xoá");
      await advance(400);
      expect(stored()).not.toBeNull();

      view.rerender(<Harness ended />);
      expect(stored()).not.toBeNull(); // still there while the learner is in the room
      view.unmount();
      expect(localStorage.getItem(KEY)).toBeNull();
    });

    it("while the debate goes on, leaving keeps them", async () => {
      const view = render(<Harness />);
      open();
      type("Giữ lại");
      await advance(400);
      view.unmount();
      expect(stored()?.tabs[0].text).toBe("Giữ lại");
    });

    it("on entering, notes older than 24 hours are cleaned and recent ones stay", () => {
      const now = Date.now();
      const old: Partial<StoredNotes> = { version: 1, updatedAt: now - 25 * 3600_000, tabs: [] };
      const fresh: Partial<StoredNotes> = { version: 1, updatedAt: now - 2 * 3600_000, tabs: [] };
      localStorage.setItem("adpp.debateNotes.old.9", JSON.stringify(old));
      localStorage.setItem("adpp.debateNotes.fresh.9", JSON.stringify(fresh));
      localStorage.setItem("adpp.debateNotes.broken.9", "{nope");
      localStorage.setItem("something.else", "keep");

      render(<Harness />);

      expect(localStorage.getItem("adpp.debateNotes.old.9")).toBeNull();
      expect(localStorage.getItem("adpp.debateNotes.broken.9")).toBeNull();
      expect(localStorage.getItem("adpp.debateNotes.fresh.9")).not.toBeNull();
      expect(localStorage.getItem("something.else")).toBe("keep");
    });
  });

  describe("moving and resizing", () => {
    it("dragging by the title bar moves the card, and it never leaves the window", () => {
      render(<Harness />);
      open();
      const panel = screen.getByTestId("debate-notes-panel");
      const bar = screen.getByTestId("debate-notes-titlebar");
      const startLeft = parseFloat(panel.style.left);
      const startTop = parseFloat(panel.style.top);

      fireEvent.pointerDown(bar, { clientX: 600, clientY: 400, pointerId: 1, button: 0 });
      fireEvent.pointerMove(bar, { clientX: 560, clientY: 380, pointerId: 1 });
      expect(parseFloat(panel.style.left)).toBe(startLeft - 40);
      expect(parseFloat(panel.style.top)).toBe(startTop - 20);

      // far outside to the top left
      fireEvent.pointerMove(bar, { clientX: -5000, clientY: -5000, pointerId: 1 });
      expect(parseFloat(panel.style.left)).toBe(0);
      expect(parseFloat(panel.style.top)).toBe(0);
      // far outside to the bottom right
      fireEvent.pointerMove(bar, { clientX: 9000, clientY: 9000, pointerId: 1 });
      expect(parseFloat(panel.style.left)).toBe(1024 - parseFloat(panel.style.width));
      expect(parseFloat(panel.style.top)).toBe(768 - parseFloat(panel.style.height));

      fireEvent.pointerUp(bar, { clientX: 9000, clientY: 9000, pointerId: 1 });
      fireEvent.pointerMove(bar, { clientX: 0, clientY: 0, pointerId: 1 });
      expect(parseFloat(panel.style.left)).toBe(1024 - parseFloat(panel.style.width)); // no longer following
    });

    it("pressing a button of the title bar does not start a drag", () => {
      render(<Harness />);
      open();
      const panel = screen.getByTestId("debate-notes-panel");
      const left = panel.style.left;
      fireEvent.pointerDown(screen.getByTestId("notes-collapse"), { clientX: 10, clientY: 10, pointerId: 1, button: 0 });
      fireEvent.pointerMove(screen.getByTestId("debate-notes-titlebar"), { clientX: 300, clientY: 300, pointerId: 1 });
      expect(panel.style.left).toBe(left);
    });

    it("the bottom-right corner resizes it, at least 260 x 200", () => {
      render(<Harness />);
      open();
      const panel = screen.getByTestId("debate-notes-panel");
      const handle = screen.getByTestId("notes-resize");
      expect(panel.style.width).toBe("340px");
      expect(panel.style.height).toBe("420px");

      fireEvent.pointerDown(handle, { clientX: 700, clientY: 600, pointerId: 2, button: 0 });
      fireEvent.pointerMove(handle, { clientX: 5, clientY: 5, pointerId: 2 });
      expect(panel.style.width).toBe("260px");
      expect(panel.style.height).toBe("200px");
    });

    it("clampRect keeps the card inside any window, also a small one", () => {
      expect(clampRect({ x: 900, y: 700, w: 340, h: 420 }, 1024, 768)).toEqual({ x: 684, y: 348, w: 340, h: 420 });
      expect(clampRect({ x: -50, y: -50, w: 100, h: 100 }, 1024, 768)).toEqual({ x: 0, y: 0, w: 260, h: 200 });
      // collapsed: only the title bar has to stay on screen
      expect(clampRect({ x: 0, y: 760, w: 340, h: 420 }, 1024, 768, true).y).toBe(768 - 40);
    });

    it("when the window shrinks the card is pulled back inside", async () => {
      render(<Harness />);
      open();
      Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 800 });
      Object.defineProperty(window, "innerHeight", { configurable: true, writable: true, value: 500 });
      await act(async () => {
        window.dispatchEvent(new Event("resize"));
      });
      const panel = screen.getByTestId("debate-notes-panel");
      expect(parseFloat(panel.style.left) + parseFloat(panel.style.width)).toBeLessThanOrEqual(800);
      expect(parseFloat(panel.style.top) + parseFloat(panel.style.height)).toBeLessThanOrEqual(500);
    });

    it("a narrow screen (< 640 px): a bottom sheet of half the height, no dragging or resizing", () => {
      Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 500 });
      render(<Harness />);
      open();
      const panel = screen.getByTestId("debate-notes-panel");
      expect(panel.style.height).toBe("50vh");
      expect(panel.style.bottom).toBe("0px");
      expect(screen.queryByTestId("notes-resize")).not.toBeInTheDocument();

      const before = panel.style.cssText;
      const rectBefore = JSON.stringify(stored()?.rect ?? null);
      const bar = screen.getByTestId("debate-notes-titlebar");
      fireEvent.pointerDown(bar, { clientX: 100, clientY: 100, pointerId: 1, button: 0 });
      fireEvent.pointerMove(bar, { clientX: 10, clientY: 10, pointerId: 1 });
      fireEvent.pointerUp(bar, { clientX: 10, clientY: 10, pointerId: 1 });
      expect(panel.style.cssText).toBe(before);
      expect(JSON.stringify(stored()?.rect ?? null)).toBe(rectBefore); // not even the saved place moved

      fireEvent.click(screen.getByTestId("notes-collapse"));
      expect(panel.style.height).toBe("40px");
    });
  });

  describe("beside a recording", () => {
    it("typing Space and Enter in the card does not reach the room (the record button and its shortcuts)", () => {
      const onRoomKey = vi.fn();
      const onRoomClick = vi.fn();
      render(<Harness onRoomKey={onRoomKey} onRoomClick={onRoomClick} />);
      open();
      onRoomKey.mockClear();
      onRoomClick.mockClear();

      const area = screen.getByTestId("notes-textarea");
      fireEvent.keyDown(area, { key: " ", code: "Space" });
      fireEvent.keyDown(area, { key: "Enter", code: "Enter" });
      fireEvent.keyDown(area, { key: "a", code: "KeyA" });
      fireEvent.click(area);

      expect(onRoomKey).not.toHaveBeenCalled();
      expect(onRoomClick).not.toHaveBeenCalled();
    });

    it("Alt+N shows and hides the card, from anywhere in the page and from inside the card", () => {
      render(<Harness />);
      expect(screen.queryByTestId("debate-notes-panel")).not.toBeInTheDocument();

      fireEvent.keyDown(document.body, { key: "n", code: "KeyN", altKey: true });
      expect(screen.getByTestId("debate-notes-panel")).toBeInTheDocument();
      // opened with the keyboard: the text box has the focus
      expect(document.activeElement).toBe(screen.getByTestId("notes-textarea"));

      fireEvent.keyDown(screen.getByTestId("notes-textarea"), { key: "n", code: "KeyN", altKey: true });
      expect(screen.queryByTestId("debate-notes-panel")).not.toBeInTheDocument(); // once, not twice

      fireEvent.keyDown(document.body, { key: "n", code: "KeyN", altKey: true });
      expect(screen.getByTestId("debate-notes-panel")).toBeInTheDocument();
    });

    it("opening with the mouse does not take the focus", () => {
      render(<Harness />);
      const recordBtn = screen.getByTestId("record");
      recordBtn.focus();
      open();
      expect(document.activeElement).not.toBe(screen.getByTestId("notes-textarea"));
    });

    it("Alt+N does nothing without the key N, and nothing for a viewer", () => {
      const view = render(<Harness enabled={false} />);
      fireEvent.keyDown(document.body, { key: "n", code: "KeyN", altKey: true });
      expect(screen.queryByTestId("debate-notes-panel")).not.toBeInTheDocument();
      expect(screen.queryByTestId("open-notes")).not.toBeInTheDocument();
      view.unmount();

      render(<Harness />);
      fireEvent.keyDown(document.body, { key: "n", code: "KeyN" }); // no Alt
      expect(screen.queryByTestId("debate-notes-panel")).not.toBeInTheDocument();
    });

    it("Esc folds the card to its title bar; read mode locks the text", () => {
      render(<Harness />);
      open();
      fireEvent.keyDown(screen.getByTestId("notes-textarea"), { key: "Escape" });
      expect(screen.getByTestId("debate-notes-panel")).toHaveAttribute("data-collapsed", "true");
      expect(screen.queryByTestId("notes-textarea")).not.toBeInTheDocument();
      fireEvent.click(screen.getByTestId("notes-collapse"));

      const area = () => screen.getByTestId("notes-textarea") as HTMLTextAreaElement;
      const normalSize = parseFloat(area().style.fontSize);
      fireEvent.click(screen.getByTestId("notes-read-mode"));
      expect(area().readOnly).toBe(true);
      expect(parseFloat(area().style.fontSize)).toBeGreaterThan(normalSize); // bigger letters to read while speaking
      fireEvent.click(screen.getByTestId("notes-read-mode"));
      expect(area().readOnly).toBe(false);
    });

    it("the font size has three steps", () => {
      render(<Harness />);
      open();
      const size = () => parseFloat((screen.getByTestId("notes-textarea") as HTMLTextAreaElement).style.fontSize);
      const mid = size();
      fireEvent.click(screen.getByTestId("notes-font-larger"));
      expect(size()).toBeGreaterThan(mid);
      expect(screen.getByTestId("notes-font-larger")).toBeDisabled();
      fireEvent.click(screen.getByTestId("notes-font-smaller"));
      fireEvent.click(screen.getByTestId("notes-font-smaller"));
      expect(size()).toBeLessThan(mid);
      expect(screen.getByTestId("notes-font-smaller")).toBeDisabled();
    });
  });

  describe("accessibility", () => {
    it("is a dialog called Ghi chú that is not modal; its buttons have names", () => {
      render(<Harness />);
      open();
      const dialog = screen.getByRole("dialog", { name: "Ghi chú" });
      expect(dialog).toHaveAttribute("aria-modal", "false");
      for (const name of ["Đóng ghi chú", "Thu gọn thẻ ghi chú", "Thêm trang", "Tăng cỡ chữ", "Giảm cỡ chữ", "Chế độ đọc", "Xoá trang hiện tại"]) {
        expect(screen.getByRole("button", { name })).toBeInTheDocument();
      }
    });

    it("close hides the card but keeps the notes", () => {
      render(<Harness />);
      open();
      type("Còn đây");
      fireEvent.click(screen.getByTestId("notes-close"));
      expect(screen.queryByTestId("debate-notes-panel")).not.toBeInTheDocument();
      expect(screen.getByTestId("open-notes")).toHaveTextContent("(có)");
      open();
      expect((screen.getByTestId("notes-textarea") as HTMLTextAreaElement).value).toBe("Còn đây");
    });
  });
});

describe("the notes button in the status bar", () => {
  const baseProps: React.ComponentProps<typeof RoundStatusBar> = {
    round: 1,
    totalRounds: 3,
    roundLabel: "Mở đầu",
    isPreparing: false,
    isPrepStarting: false,
    prepSecondsLeft: 0,
    secondsRemaining: 100,
    isAiWriting: false,
    isAiPresenting: false,
    canSpeak: true,
    isExpired: false,
    isCompleted: false,
    isWaitingForOpponent: false,
    canSkipPreparation: false,
    isSkippingPreparation: false,
    onSkipPreparation: () => {},
    readingPartName: null,
    onSkipReading: () => {},
    announcedRound: null,
  };

  it("a viewer or a judge (no notes prop) has no notes button", () => {
    render(<RoundStatusBar {...baseProps} />);
    expect(screen.queryByTestId("notes-toggle-btn")).not.toBeInTheDocument();
  });

  it("a debater has it; a dot says there are notes while the card is hidden", () => {
    const onToggle = vi.fn();
    const { rerender } = render(<RoundStatusBar {...baseProps} notes={{ open: false, hasNotes: true, onToggle }} />);
    const button = screen.getByTestId("notes-toggle-btn");
    expect(button).toHaveAttribute("aria-label", "Ghi chú (Alt+N)");
    expect(screen.getByTestId("notes-dot")).toBeInTheDocument();
    fireEvent.click(button);
    expect(onToggle).toHaveBeenCalledTimes(1);

    rerender(<RoundStatusBar {...baseProps} notes={{ open: false, hasNotes: false, onToggle }} />);
    expect(screen.queryByTestId("notes-dot")).not.toBeInTheDocument();
    rerender(<RoundStatusBar {...baseProps} notes={{ open: true, hasNotes: true, onToggle }} />);
    expect(screen.queryByTestId("notes-dot")).not.toBeInTheDocument(); // shown: no need for a dot
  });
});
