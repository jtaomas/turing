import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "20mb" }));
  app.use(express.urlencoded({ limit: "20mb", extended: true }));

  app.post("/api/transcribe-and-mark", async (req, res) => {
    try {
      const { problemDescription, imageBase64, textAnswer } = req.body;
      if (!problemDescription) {
        return res.status(400).json({ error: "Missing problemDescription." });
      }

      if (!imageBase64 && !textAnswer) {
        return res.status(400).json({ error: "Missing either imageBase64 or textAnswer." });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ 
          error: "GEMINI_API_KEY is not defined. Please add your key in Settings > Secrets." 
        });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      let contents: any;

      if (imageBase64) {
        contents = {
          parts: [
            { text: `Transcribe this student's handwritten working out for the Sydney/NSW Advanced/Extension mathematics problem: "${problemDescription}".
                     Then, mark it out of 5 based on mathematical correctness, rigor, and step validity.
                     Return the transcribed text, the score (out of 5), and specific constructive feedback.
                     Provide any mathematical symbols in standard LaTeX formatting (using $ for inline and $$ for block equations) so it can be rendered beautifully.` },
            {
              inlineData: {
                mimeType: 'image/png',
                data: imageBase64.split(',')[1] || imageBase64
              }
            }
          ]
        };
      } else {
        contents = {
          parts: [
            { text: `Review this student's typed mathematical solution for the Sydney/NSW Advanced/Extension mathematics problem: "${problemDescription}".
                     The student's submitted solution is: "${textAnswer}".
                     Mark it out of 5 based on mathematical correctness, rigor, and step validity.
                     Return the user's input as the transcription, a score (out of 5), and specific constructive feedback.
                     In your feedback and solution steps, use standard LaTeX formatting (using $ for inline and $$ for block equations) so mathematical symbols render beautifully.
                     Be rigorous and constructive.` }
          ]
        };
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents,
        config: {
          temperature: 0.1,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              transcription: { type: Type.STRING },
              score: { type: Type.NUMBER },
              totalMarks: { type: Type.NUMBER },
              feedback: { type: Type.STRING },
              steps: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ['transcription', 'score', 'totalMarks', 'feedback']
          }
        }
      });

      const result = JSON.parse(response.text || '{}');
      res.json(result);
    } catch (err: any) {
      console.error("Gemini server marking error:", err);
      res.status(500).json({ error: err?.message || "Internal server error" });
    }
  });

  app.post("/api/generate-hint", async (req, res) => {
    try {
      const { problemDescription } = req.body;
      if (!problemDescription) {
        return res.status(400).json({ error: "Missing problemDescription." });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.json({ hint: "Focus on applying the fundamental formulas of this topic and simplifying terms." });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: { 'User-Agent': 'aistudio-build' }
        }
      });

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: `You are an expert high-school mathematics tutor. Provide a single, clear, constructive mathematical hint for this Sydney/NSW curriculum maths problem: "${problemDescription}". Use standard LaTeX notation (enclosed in $) for mathematical symbols so that they render beautifully on screen. Keep it short (maximum 2 sentences).`,
      });

      res.json({ hint: response.text?.trim() || "Analyze the components of the question and simplify algebraically." });
    } catch (err) {
      console.error("Error generating hint:", err);
      res.json({ hint: "Focus on decomposing the expression and checking key derivatives." });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http:
  });
}

startServer();
