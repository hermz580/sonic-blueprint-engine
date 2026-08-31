# Sonic Blueprint Engine

An AI Foley artist and soundscape blueprint generator. Upload an image or a sound, and get a cinematic sound design blueprint — layered Foley textures, ambient layers, and Suno-ready music prompts — powered by whichever LLM provider you choose.

![UI theme: dark obsidian with HarpStar electric blue / hot pink / coral / gold accents]

## The problem

Creating sound effects and music for visual media takes time, skill, and expensive specialized tools. Most creators just need a starting point: what does this scene sound like, and what layers should I build?

## What it does

Sonic Blueprint Engine analyzes your media asset (an image, a recording, even an MP4 video) and returns a structured soundscape blueprint:

- **Suno Prompt Generator** — audio in, three highly detailed Suno AI music prompts out
- **Phoenix Oracle Foley Engine** — image or audio in, structured JSON sound design out: mood, environment, audio categories, background sound suggestions, and engine logic
- **Real-Time Sound Generator** — describe a sound, preview a sample track immediately

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Configure your LLM provider
cp .env.example .env
#   -> set at least LLM_API_KEY (or GEMINI_API_KEY) in .env

# 3. Run (dev mode — starts the API server + Vite dev server)
npm run dev
```

Open http://localhost:3000

## Configuration

| Env Var | Description | Default |
| :--- | :--- | :--- |
| `LLM_PROVIDER` | Provider: `gemini`, `openai`, `anthropic`, `openai-compatible` | `gemini` |
| `LLM_MODEL` | Model name for the chosen provider | provider default (e.g. `gemini-2.5-flash`) |
| `LLM_API_KEY` | API key for your provider | — |
| `GEMINI_API_KEY` | Gemini-only fallback for `LLM_API_KEY` | — |
| `LLM_BASE_URL` | Base URL for `openai-compatible` endpoints (Ollama, vLLM, LM Studio, Groq...) | `http://localhost:11434/v1` |
| `PORT` | HTTP port | `3000` |

## Use any model

The app is provider-agnostic. No code changes needed to switch models — just edit `.env`:

```bash
# OpenAI
LLM_PROVIDER=openai
LLM_MODEL=gpt-4o
LLM_API_KEY=YOUR_PROVIDER_API_KEY

# Anthropic Claude
LLM_PROVIDER=anthropic
LLM_MODEL=claude-sonnet-4-5
LLM_API_KEY=YOUR_ANTHROPIC_API_KEY

# Local models via Ollama (OpenAI-compatible endpoint)
LLM_PROVIDER=openai-compatible
LLM_MODEL=llama3.1
LLM_BASE_URL=http://localhost:11434/v1
```

> Note: inline **audio** input is currently only supported by the Gemini provider. Image analysis and text prompts work with every provider; audio analysis degrades with a clear message when the provider can't accept audio.

## Production build

```bash
npm run build
NODE_ENV=production npm start
```

## About

Sonic Blueprint Engine exists to democratize Foley and sound design — making cinematic audio creation accessible to every creator, not just studios. It started as an experiment in Google AI Studio and grew into a model-agnostic sound-design workbench.

Built by [Harp★Star](https://harpstarunlimited.com). The app carries the HarpStar brand watermark, which it verifies at startup and at render time — so the branding stays part of the product.

## Limitations

- Generates sound design blueprints and music *prompts*, not final mixed-ready audio (the Real-Time Sound Generator plays sample tracks as a preview).
- Blueprint quality depends on the underlying LLM.
- Audio analysis requires the Gemini provider (see above).

## License

MIT
