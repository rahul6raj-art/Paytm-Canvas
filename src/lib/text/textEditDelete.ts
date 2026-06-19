/** Delete one character or the active range while editing canvas text. */
export function applyTextEditDelete(
  content: string,
  anchor: number,
  focus: number,
  direction: "backspace" | "delete",
): { content: string; anchor: number; focus: number } | null {
  const start = Math.min(anchor, focus);
  const end = Math.max(anchor, focus);

  if (direction === "backspace") {
    if (start !== end) {
      return {
        content: content.slice(0, start) + content.slice(end),
        anchor: start,
        focus: start,
      };
    }
    if (start <= 0) return null;
    return {
      content: content.slice(0, start - 1) + content.slice(start),
      anchor: start - 1,
      focus: start - 1,
    };
  }

  if (start !== end) {
    return {
      content: content.slice(0, start) + content.slice(end),
      anchor: start,
      focus: start,
    };
  }
  if (start >= content.length) return null;
  return {
    content: content.slice(0, start) + content.slice(start + 1),
    anchor: start,
    focus: start,
  };
}
