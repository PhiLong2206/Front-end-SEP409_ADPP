import React, { useCallback, useEffect, useRef, useState } from "react";
import { Volume2 } from "lucide-react";
import { AI_MULTIMODAL_BASE_URL } from "../../api/aiApi";
import {
  fetchServerVoices,
  makeServerAudioFetcher,
  pickServerVoice,
  readStoredReadAloud,
  readStoredVoice,
  storeReadAloud,
  storeVoice,
  type ServerVoiceOption,
  voiceOptionLabel,
} from "../../services/speechOut";

const VOICE_PREVIEW_TEXT = "Xin chào, mình là đối thủ của bạn trong trận tranh biện này.";

export interface AiVoicePickerProps {
  /** "card": DebatePractice setup; "compact": the small column of TopicDetail */
  variant?: "card" | "compact";
}

/**
 * Picks how the AI opponent reads its turns, before the room opens: the voice (from the multimodal service's
 * GET /tts/config) and read-aloud on / off. Both are remembered in the browser; the room reads them when it opens.
 * Without a server voice (no Azure key) only the read-aloud switch shows: the room then uses the browser voice.
 */
const AiVoicePicker: React.FC<AiVoicePickerProps> = ({ variant = "card" }) => {
  const [voices, setVoices] = useState<ServerVoiceOption[]>([]);
  const [voice, setVoice] = useState<string | null>(null);
  const [readAloud, setReadAloud] = useState<boolean>(() => readStoredReadAloud());
  const [isPreviewing, setIsPreviewing] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const stopPreview = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    audioRef.current?.pause();
    audioRef.current = null;
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current); // pause() fires no onended
      urlRef.current = null;
    }
  }, []);

  useEffect(() => {
    let alive = true;
    void fetchServerVoices(AI_MULTIMODAL_BASE_URL).then((offered) => {
      if (!alive || !offered) return;
      setVoices(offered.voices);
      setVoice(pickServerVoice(readStoredVoice(), offered));
    });
    return () => {
      alive = false;
      stopPreview();
    };
  }, [stopPreview]);

  const choose = (id: string) => {
    setVoice(id);
    storeVoice(id);
  };

  const toggleReadAloud = () => {
    const next = !readAloud;
    setReadAloud(next);
    storeReadAloud(next);
  };

  const preview = async () => {
    if (voice === null) return;
    stopPreview();
    const controller = new AbortController();
    abortRef.current = controller;
    const timer = window.setTimeout(() => controller.abort(), 10000);
    setIsPreviewing(true);
    try {
      const chosen = voice;
      const fetchAudio = makeServerAudioFetcher(AI_MULTIMODAL_BASE_URL, fetch, () => chosen);
      const blob = await fetchAudio(VOICE_PREVIEW_TEXT, controller.signal);
      if (abortRef.current !== controller) return; // replaced or left meanwhile
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        if (urlRef.current === url) stopPreview();
      };
      await audio.play();
    } catch (err) {
      if (abortRef.current === controller) stopPreview();
      console.warn("Không nghe thử được giọng:", err);
    } finally {
      window.clearTimeout(timer);
      if (abortRef.current === controller || abortRef.current === null) setIsPreviewing(false);
    }
  };

  const compact = variant === "compact";
  const hasServerVoice = voices.length > 0;

  return (
    <div data-testid="ai-voice-picker" className={compact ? "space-y-2" : "space-y-2.5"}>
      <span
        className={
          compact
            ? "text-xs font-bold text-slate-800 dark:text-slate-100 block"
            : "text-[15px] font-bold text-slate-900 dark:text-[#F8FAFC] block"
        }
      >
        Giọng đọc của đối thủ AI
      </span>

      <label className="flex items-center gap-2 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
        <input
          type="checkbox"
          checked={readAloud}
          onChange={toggleReadAloud}
          data-testid="ai-voice-read-aloud"
          className="accent-[#008A64]"
        />
        <Volume2 size={14} aria-hidden="true" />
        <span>AI đọc to bài nói</span>
      </label>

      {hasServerVoice && (
        <div className={`flex ${compact ? "flex-col" : "flex-col sm:flex-row sm:items-center"} gap-2`}>
          <label htmlFor="ai-voice-picker-select" className="sr-only">
            Giọng đối thủ AI
          </label>
          <select
            id="ai-voice-picker-select"
            data-testid="ai-voice-select"
            value={voice ?? ""}
            onChange={(e) => choose(e.target.value)}
            disabled={!readAloud}
            className="flex-1 text-sm rounded-xl border border-slate-200 dark:border-[rgba(148,163,184,0.20)] bg-white dark:bg-[#091713] text-slate-700 dark:text-[#CBD5E1] px-3 py-2 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[#008A64]/30"
          >
            {voices.map((v) => (
              <option key={v.id} value={v.id}>
                {voiceOptionLabel(v)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void preview()}
            disabled={isPreviewing || !readAloud}
            aria-busy={isPreviewing}
            data-testid="ai-voice-preview"
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-[rgba(148,163,184,0.20)] text-sm font-semibold text-slate-700 dark:text-[#CBD5E1] hover:bg-slate-100 dark:hover:bg-[#10231C] disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[#008A64]/30"
          >
            {isPreviewing ? "Đang tải..." : "Nghe thử"}
          </button>
        </div>
      )}
    </div>
  );
};

export default AiVoicePicker;
