const EMOTION_VI_LABELS: Record<string, string> = {
  neutral: "Bình tĩnh",
  happy: "Vui vẻ",
  sad: "Buồn",
  angry: "Căng thẳng",
  fear: "Lo lắng",
  surprise: "Ngạc nhiên",
  disgust: "Khó chịu",
  none: "Không xác định",
};

/** Maps DeepFace English emotion codes to Vietnamese labels for display. */
export function emotionLabelVi(emotion: string | null | undefined): string {
  const key = emotion?.trim().toLowerCase();
  if (!key) return EMOTION_VI_LABELS.neutral;
  return EMOTION_VI_LABELS[key] ?? emotion!.trim();
}

