export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function formatDate(dateInput: string | number | undefined, timeZone = "America/Toronto"): string {
  if (dateInput === undefined) return "Unknown";

  const date = typeof dateInput === "number" ? new Date(dateInput * 1000) : new Date(dateInput);
  if (Number.isNaN(date.getTime())) return "Unknown";

  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  }).format(date);
}

export function formatHeaderLines(lines: string[]): string {
  return lines.map((line, index) => (index < lines.length - 1 ? `${line}  ` : line)).join("\n");
}

export function jsonBlock(value: unknown): string {
  return ["```json", JSON.stringify(value, null, 2) ?? "null", "```"].join("\n");
}

export function outputPathFor(inputPath: string): string {
  const slashIndex = inputPath.lastIndexOf("/");
  const dir = slashIndex === -1 ? "" : inputPath.slice(0, slashIndex + 1);
  const filename = slashIndex === -1 ? inputPath : inputPath.slice(slashIndex + 1);
  const dotIndex = filename.lastIndexOf(".");
  const base = dotIndex === -1 ? filename : filename.slice(0, dotIndex);

  return `${dir}${base}.md`;
}
