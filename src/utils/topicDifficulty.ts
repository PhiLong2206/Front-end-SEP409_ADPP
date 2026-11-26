/** Difficulty as a coloured dot and a word: the colour means something, nothing is boxed. */
export function difficultyOf(value?: string | null): { label: string; dot: string } {
  switch (value) {
    case "Easy":
    case "Dễ":
      return { label: "Dễ", dot: "bg-ap-success" };
    case "Hard":
    case "Khó":
      return { label: "Khó", dot: "bg-ap-danger" };
    default:
      return { label: value && value !== "Medium" ? value : "Trung bình", dot: "bg-ap-warning" };
  }
}
