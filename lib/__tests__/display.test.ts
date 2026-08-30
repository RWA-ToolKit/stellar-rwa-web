import { sanitizeDisplayText, getDisplayText } from "@/lib/display";

// ---------------------------------------------------------------------------
// sanitizeDisplayText — truncation, sanitization, and edge cases
// ---------------------------------------------------------------------------
describe("sanitizeDisplayText", () => {
  // --- character and tag removal -------------------------------------------

  it("removes control characters (0x00-0x1F, 0x7F)", () => {
    const input = "Hello\x00World\x1FTest";
    expect(sanitizeDisplayText(input)).toBe("HelloWorldTest");
  });

  it("removes HTML tags", () => {
    expect(sanitizeDisplayText("<p>Hello</p> <b>World</b>")).toBe("Hello World");
  });

  it("removes script tags and their content interpretation", () => {
    const input = "Safe<script>alert('xss')</script>Text";
    expect(sanitizeDisplayText(input)).toBe("SafeText");
  });

  it("normalizes multiple spaces to single space", () => {
    expect(sanitizeDisplayText("Hello    World   Test")).toBe("Hello World Test");
  });

  // --- truncation by length ------------------------------------------------

  it("truncates text longer than maxLength to specified length", () => {
    const longText = "a".repeat(250);
    const result = sanitizeDisplayText(longText, { maxLength: 220 });
    expect(result.length).toBe(221); // 220 chars + "…" ellipsis
    expect(result.endsWith("…")).toBe(true);
  });

  it("uses default maxLength of 220 when not specified", () => {
    const longText = "x".repeat(250);
    const result = sanitizeDisplayText(longText);
    expect(result.length).toBe(221); // 220 + "…"
  });

  it("does not add ellipsis if text is shorter than maxLength", () => {
    const text = "Short text";
    expect(sanitizeDisplayText(text, { maxLength: 220 })).toBe("Short text");
    expect(sanitizeDisplayText(text)).toBe("Short text");
  });

  it("trims trailing whitespace before adding ellipsis", () => {
    const text = "a".repeat(220) + "   ";
    const result = sanitizeDisplayText(text, { maxLength: 220 });
    expect(result).toBe("a".repeat(220) + "…");
    expect(result).not.toMatch(/\s…$/);
  });

  // --- truncation by line count --------------------------------------------

  it("collapses lines to maxLines (default 8)", () => {
    const nineLines = "line1\nline2\nline3\nline4\nline5\nline6\nline7\nline8\nline9";
    const result = sanitizeDisplayText(nineLines);
    const lineCount = result.split("\n").length;
    expect(lineCount).toBe(8);
  });

  it("preserves lines up to maxLines", () => {
    const threeLines = "line1\nline2\nline3";
    expect(sanitizeDisplayText(threeLines, { maxLines: 3 })).toBe("line1\nline2\nline3");
  });

  it("trims each line individually", () => {
    const input = "  line1  \n  line2  \n  line3  ";
    const result = sanitizeDisplayText(input, { maxLines: 3 });
    const lines = result.split("\n");
    expect(lines[0]).toBe("line1");
    expect(lines[1]).toBe("line2");
    expect(lines[2]).toBe("line3");
  });

  it("filters out empty lines", () => {
    const input = "line1\n\n\nline2\n";
    const result = sanitizeDisplayText(input, { maxLines: 10 });
    expect(result).toBe("line1\nline2");
  });

  // --- empty and short input -----------------------------------------------

  it("returns empty string for null input", () => {
    expect(sanitizeDisplayText(null)).toBe("");
  });

  it("returns empty string for undefined input", () => {
    expect(sanitizeDisplayText(undefined)).toBe("");
  });

  it("returns empty string for whitespace-only input", () => {
    expect(sanitizeDisplayText("   \n\n  ")).toBe("");
  });

  it("handles single character input", () => {
    expect(sanitizeDisplayText("a")).toBe("a");
  });

  it("handles single-character input at truncation boundary", () => {
    // Single char should not be truncated
    const result = sanitizeDisplayText("x", { maxLength: 5 });
    expect(result).toBe("x");
  });

  // --- combined scenarios --------------------------------------------------

  it("truncates by length and line count together", () => {
    const input = "a".repeat(300) + "\nline2\nline3\nline4\nline5\nline6\nline7\nline8\nline9";
    const result = sanitizeDisplayText(input, { maxLength: 220, maxLines: 5 });
    expect(result.split("\n").length).toBe(5);
    expect(result).toContain("…");
  });

  it("handles text with tags, control chars, and truncation", () => {
    const input = "<p>Hello\x00World</p>" + "x".repeat(250);
    const result = sanitizeDisplayText(input, { maxLength: 50 });
    expect(result).toMatch(/^Hello World/);
    expect(result.length).toBe(51); // 50 + "…"
    expect(result).toContain("…");
  });

  it("normalizes whitespace after removing tags", () => {
    const input = "Hello<br/>  \n\n  World";
    expect(sanitizeDisplayText(input)).toBe("Hello World");
  });
});

// ---------------------------------------------------------------------------
// getDisplayText — wrapper with fallback
// ---------------------------------------------------------------------------
describe("getDisplayText", () => {
  it("returns sanitized text when text is non-empty", () => {
    expect(getDisplayText("Hello World")).toBe("Hello World");
  });

  it("returns fallback when text is null", () => {
    expect(getDisplayText(null)).toBe("Untitled");
  });

  it("returns fallback when text is undefined", () => {
    expect(getDisplayText(undefined)).toBe("Untitled");
  });

  it("returns fallback when text is empty string", () => {
    expect(getDisplayText("")).toBe("Untitled");
  });

  it("returns fallback when text is whitespace-only", () => {
    expect(getDisplayText("   \n  ")).toBe("Untitled");
  });

  it("uses custom fallback when provided", () => {
    expect(getDisplayText(null, "No Title")).toBe("No Title");
    expect(getDisplayText("", "Custom Default")).toBe("Custom Default");
  });

  it("applies sanitization and uses fallback independently", () => {
    expect(getDisplayText("<p></p>", "Empty")).toBe("Empty");
    expect(getDisplayText("<p>Content</p>")).toBe("Content");
  });

  it("sanitizes text before checking for fallback", () => {
    const allTags = "<p></p><div></div>";
    expect(getDisplayText(allTags)).toBe("Untitled");
  });

  it("preserves structure after sanitization", () => {
    const result = getDisplayText("Line1\nLine2\nLine3");
    expect(result).toBe("Line1\nLine2\nLine3");
  });
});
