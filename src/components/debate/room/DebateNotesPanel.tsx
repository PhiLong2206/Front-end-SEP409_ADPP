import React, { useEffect, useRef, useState } from "react";
import { BookOpen, ChevronDown, ChevronUp, NotebookPen, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  MAX_NOTE_CHARS,
  MAX_NOTE_TABS,
  MAX_TAB_TITLE,
  NOTE_CHARS_WARNING,
  NOTE_FONT_SIZES,
  type DebateNotes,
} from "../../../hooks/useDebateNotes";
import { TITLE_BAR_H, useDraggablePanel } from "../../../hooks/useDraggablePanel";

interface DebateNotesPanelProps {
  notes: DebateNotes;
  /** Name of the current round: the quick button makes a page for it. */
  roundLabel: string;
}

/**
 * A floating card for notes during the debate. Not modal: the room stays usable (also while recording) and the card
 * stays readable. Keys typed inside it never reach the room.
 */
const DebateNotesPanel: React.FC<DebateNotesPanelProps> = ({ notes, roundLabel }) => {
  const { rect, collapsed, tabs, activeTabData, fontSize } = notes;
  const { isNarrow, isDragging, dragHandlers, resizeHandlers } = useDraggablePanel({
    rect,
    onRectChange: notes.setRect,
    collapsed,
    onGestureEnd: notes.saveNow,
  });
  const [readMode, setReadMode] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const textRef = useRef<HTMLTextAreaElement | null>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Opened with the keyboard (Alt+N): the text box takes the focus. Opened with the mouse: it never does.
  useEffect(() => {
    if (notes.focusRequest > 0) textRef.current?.focus();
  }, [notes.focusRequest]);

  const text = activeTabData.text;
  const fontPx = NOTE_FONT_SIZES[Math.min(2, Math.max(0, fontSize))] + (readMode ? 4 : 0);

  const startRename = (id: string, title: string) => {
    setRenamingId(id);
    setRenameValue(title);
  };
  const commitRename = () => {
    if (renamingId) notes.renameTab(renamingId, renameValue);
    setRenamingId(null);
  };

  const askRemove = () => {
    if (tabs.length <= 1) return;
    if (activeTabData.text.trim()) setConfirmRemoveId(activeTabData.id);
    else notes.removeTab(activeTabData.id);
  };

  const onTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let target = -1;
    if (event.key === "ArrowRight") target = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft") target = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") target = 0;
    else if (event.key === "End") target = tabs.length - 1;
    else if (event.key === "F2") startRename(tabs[index].id, tabs[index].title);
    if (target >= 0) {
      event.preventDefault();
      notes.setActiveTab(tabs[target].id);
      tabRefs.current[tabs[target].id]?.focus();
    }
  };

  // Keys typed in the card are the card's: Space / Enter / letters must not reach the room (its shortcuts, the record
  // button). Esc folds the card; Alt+N hides it (the room's own Alt+N listener on window cannot hear it from here).
  const onCardKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey && event.code === "KeyN") {
      event.preventDefault();
      event.stopPropagation();
      notes.toggleOpen();
      return;
    }
    event.stopPropagation();
    if (event.key === "Escape" && !renamingId) {
      event.preventDefault();
      notes.setCollapsed(true);
    }
  };

  const style: React.CSSProperties = isNarrow
    ? { left: 0, right: 0, bottom: 0, height: collapsed ? TITLE_BAR_H : "50vh" }
    : { left: rect.x, top: rect.y, width: rect.w, height: collapsed ? TITLE_BAR_H : rect.h };

  const iconBtn =
    "p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0B5ED7]/40";

  return (
    <div
      role="dialog"
      aria-label="Ghi chú"
      aria-modal="false"
      data-testid="debate-notes-panel"
      data-collapsed={collapsed ? "true" : "false"}
      style={style}
      onKeyDown={onCardKeyDown}
      // Pointer / click events inside the card do not reach the room either (nothing there should stop a recording)
      onClick={(e) => e.stopPropagation()}
      className={`fixed z-40 flex flex-col overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F1726] text-slate-800 dark:text-slate-100 shadow-2xl ${
        isNarrow ? "rounded-t-2xl" : "rounded-2xl"
      } ${isDragging ? "select-none" : ""}`}
    >
      {/* Title bar: drag here */}
      <div
        data-testid="debate-notes-titlebar"
        {...dragHandlers}
        className={`shrink-0 flex items-center gap-1 px-2 border-b border-slate-200/80 dark:border-slate-700 bg-slate-50 dark:bg-[#0B1220] touch-none ${
          isNarrow ? "" : "cursor-move"
        }`}
        style={{ height: TITLE_BAR_H }}
      >
        <NotebookPen size={15} className="ml-1 text-[#0B5ED7] dark:text-blue-400" aria-hidden="true" />
        <span className="text-sm font-bold flex-1 truncate">Ghi chú</span>
        {!collapsed && (
          <>
            <button
              type="button"
              aria-label="Giảm cỡ chữ"
              data-testid="notes-font-smaller"
              disabled={fontSize <= 0}
              onClick={() => notes.setFontSize(fontSize - 1)}
              className={`${iconBtn} text-xs font-bold disabled:opacity-40`}
            >
              A−
            </button>
            <button
              type="button"
              aria-label="Tăng cỡ chữ"
              data-testid="notes-font-larger"
              disabled={fontSize >= 2}
              onClick={() => notes.setFontSize(fontSize + 1)}
              className={`${iconBtn} text-xs font-bold disabled:opacity-40`}
            >
              A+
            </button>
            <button
              type="button"
              aria-label="Chế độ đọc"
              aria-pressed={readMode}
              data-testid="notes-read-mode"
              onClick={() => setReadMode((v) => !v)}
              className={`${iconBtn} ${readMode ? "text-[#0B5ED7] bg-blue-50 dark:bg-blue-950/40" : ""}`}
              title="Chế độ đọc: khoá sửa, chữ to hơn"
            >
              <BookOpen size={15} aria-hidden="true" />
            </button>
          </>
        )}
        <button
          type="button"
          aria-label={collapsed ? "Mở rộng thẻ ghi chú" : "Thu gọn thẻ ghi chú"}
          aria-expanded={!collapsed}
          data-testid="notes-collapse"
          onClick={() => notes.setCollapsed(!collapsed)}
          className={iconBtn}
        >
          {collapsed ? <ChevronUp size={15} aria-hidden="true" /> : <ChevronDown size={15} aria-hidden="true" />}
        </button>
        <button type="button" aria-label="Đóng ghi chú" data-testid="notes-close" onClick={() => notes.setOpen(false)} className={iconBtn}>
          <X size={15} aria-hidden="true" />
        </button>
      </div>

      {!collapsed && (
        <>
          {/* Pages */}
          <div className="shrink-0 flex items-center gap-1 px-2 pt-1.5 overflow-x-auto">
            <div role="tablist" aria-label="Trang ghi chú" className="flex items-center gap-1 min-w-0">
              {tabs.map((tab, index) => {
                const selected = tab.id === activeTabData.id;
                return renamingId === tab.id ? (
                  <input
                    key={tab.id}
                    autoFocus
                    data-testid="notes-rename-input"
                    aria-label="Tên trang"
                    maxLength={MAX_TAB_TITLE}
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitRename();
                      else if (e.key === "Escape") {
                        e.stopPropagation();
                        setRenamingId(null);
                      }
                    }}
                    className="w-28 px-2 py-1 rounded-lg border border-[#0B5ED7] bg-white dark:bg-[#0B1220] text-xs focus:outline-none"
                  />
                ) : (
                  <button
                    key={tab.id}
                    ref={(el) => {
                      tabRefs.current[tab.id] = el;
                    }}
                    type="button"
                    role="tab"
                    id={`notes-tab-${tab.id}`}
                    aria-selected={selected}
                    aria-controls="notes-tabpanel"
                    tabIndex={selected ? 0 : -1}
                    title="Nhấp đúp để đổi tên"
                    data-testid="notes-tab"
                    onClick={() => notes.setActiveTab(tab.id)}
                    onDoubleClick={() => startRename(tab.id, tab.title)}
                    onKeyDown={(e) => onTabKeyDown(e, index)}
                    className={`shrink-0 max-w-[9rem] truncate px-2.5 py-1 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0B5ED7]/40 ${
                      selected
                        ? "bg-[#0B5ED7] text-white"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                    }`}
                  >
                    {tab.title}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              aria-label="Thêm trang"
              data-testid="notes-add-tab"
              disabled={tabs.length >= MAX_NOTE_TABS}
              title={tabs.length >= MAX_NOTE_TABS ? `Tối đa ${MAX_NOTE_TABS} trang` : "Thêm trang"}
              onClick={() => notes.addTab()}
              className={`${iconBtn} disabled:opacity-40`}
            >
              <Plus size={15} aria-hidden="true" />
            </button>
          </div>

          {confirmRemoveId && (
            <div
              role="alert"
              data-testid="notes-confirm-remove"
              className="mx-2 mt-1.5 px-3 py-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs flex items-center justify-between gap-2"
            >
              <span>Trang này có nội dung. Xoá luôn?</span>
              <span className="flex gap-1.5 shrink-0">
                <button
                  type="button"
                  data-testid="notes-confirm-remove-yes"
                  onClick={() => {
                    notes.removeTab(confirmRemoveId);
                    setConfirmRemoveId(null);
                  }}
                  className="px-2 py-1 rounded-md bg-rose-600 text-white font-semibold"
                >
                  Xoá
                </button>
                <button
                  type="button"
                  data-testid="notes-confirm-remove-no"
                  onClick={() => setConfirmRemoveId(null)}
                  className="px-2 py-1 rounded-md border border-slate-300 dark:border-slate-600 font-semibold"
                >
                  Giữ lại
                </button>
              </span>
            </div>
          )}

          {/* The page */}
          <div
            role="tabpanel"
            id="notes-tabpanel"
            aria-labelledby={`notes-tab-${activeTabData.id}`}
            className="flex-1 min-h-0 p-2"
          >
            <textarea
              ref={textRef}
              data-testid="notes-textarea"
              aria-label={`Nội dung ${activeTabData.title}`}
              value={text}
              readOnly={readMode}
              maxLength={MAX_NOTE_CHARS}
              placeholder="Ghi ý chính, số liệu, câu hỏi phản biện…"
              onChange={(e) => notes.setText(activeTabData.id, e.target.value)}
              style={{ fontSize: fontPx }}
              className={`w-full h-full resize-none rounded-lg border p-2.5 leading-relaxed font-sans focus:outline-none focus:ring-2 focus:ring-[#0B5ED7]/40 ${
                readMode
                  ? "border-transparent bg-slate-50 dark:bg-[#0B1220] cursor-default"
                  : "border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0B1220]"
              }`}
            />
          </div>

          {/* Footer */}
          <div className="shrink-0 flex items-center gap-2 px-3 pb-2 pr-6 text-[11px] text-slate-500 dark:text-slate-400">
            <span aria-live="polite" data-testid="notes-saved" className="min-w-[3.5rem]">
              {notes.isSaved ? "Đã lưu" : ""}
            </span>
            {text.length > NOTE_CHARS_WARNING && (
              <span
                data-testid="notes-counter"
                className={text.length >= MAX_NOTE_CHARS ? "font-bold text-rose-600" : "font-semibold text-amber-600"}
              >
                {text.length}/{MAX_NOTE_CHARS}
              </span>
            )}
            <span className="flex-1" />
            {roundLabel && (
              <button
                type="button"
                data-testid="notes-add-round-tab"
                disabled={tabs.length >= MAX_NOTE_TABS}
                onClick={() => notes.addTab(roundLabel)}
                className="px-2 py-1 rounded-md border border-slate-300 dark:border-slate-600 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
              >
                Trang cho vòng này
              </button>
            )}
            <button
              type="button"
              aria-label="Đổi tên trang"
              data-testid="notes-rename-btn"
              onClick={() => startRename(activeTabData.id, activeTabData.title)}
              className={iconBtn}
            >
              <Pencil size={13} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Xoá trang hiện tại"
              data-testid="notes-remove-tab"
              disabled={tabs.length <= 1}
              onClick={askRemove}
              className={`${iconBtn} disabled:opacity-40`}
            >
              <Trash2 size={13} aria-hidden="true" />
            </button>
          </div>

          {/* Resize from the bottom-right corner */}
          {!isNarrow && (
            <div
              role="separator"
              aria-label="Đổi kích thước thẻ ghi chú"
              data-testid="notes-resize"
              {...resizeHandlers}
              className="absolute bottom-0 right-0 w-5 h-5 cursor-nwse-resize touch-none"
              style={{
                background:
                  "linear-gradient(135deg, transparent 50%, rgba(100,116,139,0.55) 50%, rgba(100,116,139,0.55) 60%, transparent 60%, transparent 75%, rgba(100,116,139,0.55) 75%, rgba(100,116,139,0.55) 85%, transparent 85%)",
              }}
            />
          )}
        </>
      )}
    </div>
  );
};

export default DebateNotesPanel;
