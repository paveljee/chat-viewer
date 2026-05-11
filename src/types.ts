export type Provider = "claude" | "chatgpt";

export interface RenderOptions {
  timeZone?: string;
}

export interface ConvertResult {
  inputPath: string;
  outputPath: string;
  provider: Provider;
}
