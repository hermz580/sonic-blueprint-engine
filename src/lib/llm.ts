/**
 * Provider-agnostic LLM layer for Sonic Blueprint Engine.
 *
 * Works with ANY model provider without code changes. Configure via env vars:
 *
 *   LLM_PROVIDER   gemini (default) | openai | anthropic | openai-compatible
 *   LLM_MODEL      model name for the chosen provider
 *   LLM_API_KEY    API key (the gemini provider also accepts GEMINI_API_KEY)
 *   LLM_BASE_URL   base URL for openai-compatible providers (Ollama, vLLM, Groq, ...)
 *
 * Audio input is currently only supported by Gemini (inline audio parts); the
 * other providers degrade gracefully with a clear error message.
 */

import { GoogleGenAI } from "@google/genai";

export type LlmProvider = "gemini" | "openai" | "anthropic" | "openai-compatible";

export interface MediaInput {
  data: Buffer;
  mimeType: string;
}

export interface GenerateOptions {
  system?: string;
  prompt: string;
  image?: MediaInput;
  audio?: MediaInput;
}

export interface LlmConfig {
  provider: LlmProvider;
  model: string;
  apiKey?: string;
  baseUrl?: string;
}

interface ProviderDefaults {
  model: string;
  baseUrl: string;
  needsKey: boolean;
}

const DEFAULTS: Record<LlmProvider, ProviderDefaults> = {
  gemini: { model: "gemini-2.5-flash", baseUrl: "", needsKey: true },
  openai: { model: "gpt-4o", baseUrl: "https://api.openai.com/v1", needsKey: true },
  anthropic: { model: "claude-sonnet-4-5", baseUrl: "https://api.anthropic.com", needsKey: true },
  "openai-compatible": { model: "", baseUrl: "http://localhost:11434/v1", needsKey: false },
};

const PLACEHOLDER_KEYS = new Set(["MY_GEMINI_API_KEY", "MY_API_KEY", "YOUR_API_KEY", ""]);

export function loadConfig(env: NodeJS.ProcessEnv = process.env): LlmConfig {
  const provider = (env.LLM_PROVIDER || "gemini").toLowerCase() as LlmProvider;
  if (!DEFAULTS[provider]) {
    throw new Error(
      `Unknown LLM_PROVIDER "${provider}". Use one of: ${Object.keys(DEFAULTS).join(", ")}.`,
    );
  }

  const defaults = DEFAULTS[provider];
  const apiKey = env.LLM_API_KEY || (provider === "gemini" ? env.GEMINI_API_KEY : undefined);

  if (defaults.needsKey && (!apiKey || PLACEHOLDER_KEYS.has(apiKey.trim()))) {
    throw new Error(
      `Missing API key for provider "${provider}". Set LLM_API_KEY` +
        (provider === "gemini" ? " (or GEMINI_API_KEY)" : "") +
        " in your .env file.",
    );
  }

  const model = env.LLM_MODEL || defaults.model;
  if (!model) {
    throw new Error(
      'LLM_MODEL is required for provider "' + provider + '". Set it in your .env file.',
    );
  }

  return {
    provider,
    model,
    apiKey,
    baseUrl: env.LLM_BASE_URL || defaults.baseUrl,
  };
}

/** Audio input is only supported by Gemini today. */
export function supportsAudio(provider: LlmProvider): boolean {
  return provider === "gemini";
}

export function describeConfig(cfg: LlmConfig): string {
  return `${cfg.provider} / ${cfg.model}`;
}

export async function generateText(opts: GenerateOptions, cfg: LlmConfig): Promise<string> {
  switch (cfg.provider) {
    case "gemini":
      return generateGemini(opts, cfg);
    case "openai":
    case "openai-compatible":
      return generateOpenAICompatible(opts, cfg);
    case "anthropic":
      return generateAnthropic(opts, cfg);
  }
}

// ---------------------------------------------------------------------------
// Gemini (@google/genai)
// ---------------------------------------------------------------------------

async function generateGemini(opts: GenerateOptions, cfg: LlmConfig): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: cfg.apiKey });

  const parts: Array<{
    text?: string;
    inlineData?: { data: string; mimeType: string };
  }> = [];

  if (opts.image) {
    parts.push({
      inlineData: { data: opts.image.data.toString("base64"), mimeType: opts.image.mimeType },
    });
  }
  if (opts.audio) {
    parts.push({
      inlineData: { data: opts.audio.data.toString("base64"), mimeType: opts.audio.mimeType },
    });
  }
  parts.push({ text: opts.prompt });

  const response = await ai.models.generateContent({
    model: cfg.model,
    contents: [{ role: "user", parts }],
    config: opts.system ? { systemInstruction: { parts: [{ text: opts.system }] } } : undefined,
  });

  const text = response.text;
  if (!text) throw new Error(`Gemini returned an empty response (model: ${cfg.model}).`);
  return text;
}

// ---------------------------------------------------------------------------
// OpenAI / any OpenAI-compatible endpoint (OpenAI, Ollama, vLLM, LM Studio, Groq, ...)
// ---------------------------------------------------------------------------

async function generateOpenAICompatible(opts: GenerateOptions, cfg: LlmConfig): Promise<string> {
  if (opts.audio) {
    throw new Error(
      "Audio input is only supported by the gemini provider. Set LLM_PROVIDER=gemini or use an audio-capable OpenAI-compatible endpoint.",
    );
  }

  const baseUrl = (cfg.baseUrl || "").replace(/\/+$/, "");
  const content: Array<Record<string, unknown>> = [];
  if (opts.image) {
    content.push({
      type: "image_url",
      image_url: {
        url: `data:${opts.image.mimeType};base64,${opts.image.data.toString("base64")}`,
      },
    });
  }
  content.push({ type: "text", text: opts.prompt });

  const messages: Array<Record<string, unknown>> = [];
  if (opts.system) messages.push({ role: "system", content: opts.system });
  messages.push({ role: "user", content });

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`;

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({ model: cfg.model, messages, max_tokens: 4096 }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`OpenAI-compatible request failed (${res.status}): ${detail.slice(0, 300)}`);
  }

  const data = (await res.json()) as { choices?: Array<{ message?: { content?: unknown } }> };
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error(`OpenAI-compatible endpoint returned no content (model: ${cfg.model}).`);
  return typeof text === "string" ? text : JSON.stringify(text);
}

// ---------------------------------------------------------------------------
// Anthropic (Claude)
// ---------------------------------------------------------------------------

async function generateAnthropic(opts: GenerateOptions, cfg: LlmConfig): Promise<string> {
  if (opts.audio) {
    throw new Error(
      "Audio input is only supported by the gemini provider. Set LLM_PROVIDER=gemini.",
    );
  }

  const baseUrl = (cfg.baseUrl || "").replace(/\/+$/, "");
  const content: Array<Record<string, unknown>> = [];
  if (opts.image) {
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: opts.image.mimeType,
        data: opts.image.data.toString("base64"),
      },
    });
  }
  content.push({ type: "text", text: opts.prompt });

  const res = await fetch(`${baseUrl}/v1/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": cfg.apiKey || "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: 4096,
      system: opts.system,
      messages: [{ role: "user", content }],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Anthropic request failed (${res.status}): ${detail.slice(0, 300)}`);
  }

  const data = (await res.json()) as { content?: Array<{ text?: string }> };
  const text =
    data.content
      ?.map((block) => block.text)
      .filter(Boolean)
      .join("") || "";
  if (!text) throw new Error(`Anthropic returned no content (model: ${cfg.model}).`);
  return text;
}
