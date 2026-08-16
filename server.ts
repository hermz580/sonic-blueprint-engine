import 'dotenv/config';
import express, { Request, Response } from "express";
import multer from "multer";
import ffmpeg from "fluent-ffmpeg";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { fileURLToPath } from 'url';
import {
  generateText,
  loadConfig,
  supportsAudio,
  describeConfig,
  type LlmConfig,
} from "./src/lib/llm";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const upload = multer({ dest: "uploads/" });

// Middleware to parse JSON bodies
app.use(express.json());

// ---------------------------------------------------------------------------
// HarpStar branding integrity check (startup / backend layer)
// The app refuses to run when the HarpStar brand anchor in index.html has been
// removed or altered. The client also re-verifies the anchor before rendering.
// ---------------------------------------------------------------------------
const BRAND_MARKER = "<!-- HARPSTAR-BRAND-v1 -->";
const BRAND_ANCHOR = 'id="harpstar-brand"';
const BRAND_DATA = 'data-harpstar="v1"';

function verifyHarpStarBranding(): boolean {
  const htmlPath =
    process.env.NODE_ENV === "production"
      ? path.join(process.cwd(), "dist", "index.html")
      : path.join(process.cwd(), "index.html");
  try {
    const html = fs.readFileSync(htmlPath, "utf8");
    return html.includes(BRAND_MARKER) && html.includes(BRAND_ANCHOR) && html.includes(BRAND_DATA);
  } catch {
    return false;
  }
}

if (!verifyHarpStarBranding()) {
  console.error("======================================================");
  console.error("  This app requires HarpStar branding.");
  console.error("  Visit https://harpstarunlimited.com");
  console.error("  The HarpStar brand anchor was removed or altered.");
  console.error("======================================================");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// LLM configuration — works with any provider the user chooses
// ---------------------------------------------------------------------------
const llm: LlmConfig = loadConfig();
console.log(`[llm] provider: ${describeConfig(llm)}`);

// Helper to convert audio (e.g. MP4 -> MP3)
function convertAudio(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(inputPath)) {
      return reject(new Error(`Input file not found: ${inputPath}`));
    }
    ffmpeg(inputPath)
      .toFormat('mp3')
      .on('end', () => {
        if (fs.existsSync(outputPath)) {
          resolve();
        } else {
          reject(new Error("FFmpeg conversion finished but output file not found."));
        }
      })
      .on('error', (err) => {
        reject(new Error(`FFmpeg error: ${err.message}`));
      })
      .save(outputPath);
  });
}

function cleanupUploads(...paths: Array<string | undefined>) {
  for (const p of paths) {
    if (p && fs.existsSync(p)) {
      try {
        fs.unlinkSync(p);
      } catch {
        /* best effort */
      }
    }
  }
}

// Routes
app.post("/api/analyze-audio", upload.single("file"), async (req: Request, res: Response) => {
  try {
    const file = (req as any).file;
    if (!file) throw new Error("No file uploaded");

    if (!supportsAudio(llm.provider)) {
      res.status(400).json({
        error: `Audio analysis requires the gemini provider. Set LLM_PROVIDER=gemini (current provider: ${llm.provider}).`,
      });
      return;
    }

    let audioPath = file.path;

    // If MP4, convert to MP3 first
    if (file.mimetype === "video/mp4") {
      const outputPath = `${file.path}.mp3`;
      await convertAudio(file.path, outputPath);
      audioPath = outputPath;
    }

    const result = await generateText(
      {
        system: "You are a master Foley artist and sound designer. You analyze audio and produce detailed, layered soundscape blueprints and Suno-ready music prompts.",
        prompt: `Analyze this audio file in depth. Identify:
1. Music style and genre.
2. Overall mood and emotional tone.
3. Detailed background sound elements (e.g., specific textures, noises, instruments).

Based on this analysis, generate three distinct, highly detailed music prompts tailored for Suno AI that would elegantly complement or layer over this original audio.`,
        audio: { data: fs.readFileSync(audioPath), mimeType: "audio/mpeg" },
      },
      llm,
    );

    cleanupUploads(file.path, audioPath !== file.path ? audioPath : undefined);
    res.json({ result });
  } catch (error: any) {
    console.error(error);
    cleanupUploads((req as any).file?.path);
    res.status(500).json({ error: error?.message || "Failed to analyze audio" });
  }
});

app.post("/api/analyze-image", upload.single("file"), async (req: Request, res: Response) => {
  try {
    const file = (req as any).file;
    if (!file) throw new Error("No file uploaded");

    const isAudio = file.mimetype.startsWith("audio/");
    if (isAudio && !supportsAudio(llm.provider)) {
      res.status(400).json({
        error: `Audio analysis requires the gemini provider. Set LLM_PROVIDER=gemini (current provider: ${llm.provider}).`,
      });
      return;
    }

    const result = await generateText(
      {
        system: "You are a Digital Foley Artist. Analyze media and return a structured sound-design blueprint.",
        prompt: isAudio
          ? "Analyze this audio as a Digital Foley Artist. Identify the core soundscape, and generate a structured JSON object containing: mood and environment, audio categories, Engine Logic, AND a list of specific 'background sound suggestions' that would complement, layer, or frame the original audio."
          : "Analyze this image as a Digital Foley Artist. Return a structured JSON object including: mood and environment, audio categories (Ambient Layers, Interaction Sounds, Material Audio, Cinematic Transitions), and Engine Logic (musicDirection, audioEngineLogic).",
        image: isAudio ? undefined : { data: fs.readFileSync(file.path), mimeType: file.mimetype },
        audio: isAudio ? { data: fs.readFileSync(file.path), mimeType: file.mimetype } : undefined,
      },
      llm,
    );

    cleanupUploads(file.path);

    const text = result || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      res.status(500).json({ error: "Failed to parse API response as JSON.", rawResponse: text });
      return;
    }
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      res.json({ result: parsed });
    } catch (e) {
      res.status(500).json({ error: "API returned malformed JSON.", rawResponse: jsonMatch[0] });
    }
  } catch (error: any) {
    console.error(error);
    cleanupUploads((req as any).file?.path);
    res.status(500).json({ error: error?.message || "Failed to analyze file" });
  }
});

app.post("/api/generate-sound", async (req: Request, res: Response) => {
  try {
    const { prompt } = req.body;
    if (!prompt) throw new Error("No prompt provided");

    // Demo soundscape generator — returns a sample track so the flow can be
    // previewed without an audio-synthesis backend. Swap for any TTS/audio
    // generation service (or your own API) to produce real output.
    const EXAMPLE_SOUNDS = [
      "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
      "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
      "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
    ];
    const randomSound = EXAMPLE_SOUNDS[Math.floor(Math.random() * EXAMPLE_SOUNDS.length)];

    console.log(`Generating sound for prompt: ${prompt}`);
    res.json({
      result: `Soundscape generated for: ${prompt}`,
      audioUrl: randomSound,
    });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error?.message || "Failed to generate sound" });
  }
});

// Vite middleware / static serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // Express 5 SPA fallback: any unmatched path serves the app shell.
    app.use((req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Sonic Blueprint Engine running on http://localhost:${PORT}`);
  });
}

startServer();
