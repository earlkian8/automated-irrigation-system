// services/gemini.js — plant identification via Gemini Vision
import { GoogleGenAI } from '@google/genai';

const MODEL = 'gemini-2.5-flash';

function getClient() {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) throw new Error('EXPO_PUBLIC_GEMINI_API_KEY is not set in your .env file.');
  return new GoogleGenAI({ apiKey });
}

const PLANT_TYPES = [
  'Fern', 'Peace Lily', 'Pothos', 'Monstera', 'Spider Plant',
  'Orchid', 'Snake Plant', 'Aloe Vera', 'Succulent', 'Cactus',
];

const PROMPT = `You are a plant identification expert for an indoor plant irrigation system.

Analyze the plant in this image and return ONLY a raw JSON object — no markdown, no code fences, no explanation.

Use this exact shape:
{
  "plantName": "A descriptive name for this specific plant",
  "plantType": "One of: ${PLANT_TYPES.join(', ')}",
  "potSize": "Small | Medium | Large",
  "irrigationMode": "Automatic | Manual | Hybrid",
  "scheduleType": "Daily | Every X Days",
  "scheduleDays": 1,
  "scheduleTime": "08:00",
  "confidence": 90,
  "notes": "One sentence of indoor care advice for this plant."
}

Rules:
- plantType MUST be exactly one of the listed values (pick the closest match)
- potSize: Small = < 15cm pot, Medium = 15-25cm, Large = > 25cm (estimate from image)
- irrigationMode: prefer Hybrid for most plants
- scheduleDays: number of days between waterings (1 if Daily)
- confidence: 0-100 integer
- If the image has no plant or is unclear, still return valid JSON with confidence 0`;

export async function identifyPlant(base64Image, mimeType = 'image/jpeg') {
  const ai = getClient();

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [
      {
        role: 'user',
        parts: [
          { inlineData: { mimeType, data: base64Image } },
          { text: PROMPT },
        ],
      },
    ],
  });

  const raw   = response.text ?? '';
  const clean = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

  try {
    return JSON.parse(clean);
  } catch {
    throw new Error('Could not parse Gemini response as JSON');
  }
}
