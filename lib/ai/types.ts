// lib/ai/types.ts
export type ReadMenu = (imageBase64: string, mimeType?: string) => Promise<string[]>;

export class ProviderError extends Error {
  constructor(public provider: string, message: string) {
    super(`[${provider}] ${message}`);
    this.name = "ProviderError";
  }
}
