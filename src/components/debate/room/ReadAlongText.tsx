import React from "react";

interface ReadAlongTextProps {
  text: string;
  /** Characters of `text` the voice has read: they get the main colour, the rest stays grey. */
  spokenChars: number;
}

// Only the colour changes (no weight, no size): the layout cannot jump. No transition for reduced motion.
const SPOKEN = "text-slate-900 dark:text-white transition-colors duration-150 motion-reduce:transition-none";
const UNSPOKEN = "text-slate-500 dark:text-slate-400 transition-colors duration-150 motion-reduce:transition-none";

/**
 * An AI speech while it is read aloud: grey, turning to the main colour as the voice gets there. The two parts are
 * plain text nodes inside the same paragraph, so line breaks and wrapping stay as they were.
 */
const ReadAlongText: React.FC<ReadAlongTextProps> = ({ text, spokenChars }) => {
  const at = Math.max(0, Math.min(text.length, Math.floor(spokenChars)));
  return (
    <>
      <span data-testid="read-spoken" className={SPOKEN}>
        {text.slice(0, at)}
      </span>
      <span data-testid="read-unspoken" className={UNSPOKEN}>
        {text.slice(at)}
      </span>
    </>
  );
};

export default ReadAlongText;
