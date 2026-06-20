// Gemini API helper - centralized client for all Gemini calls
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Generate text with Gemini 3.1 Flash Lite (default for game dialogue)
 * @param {Object} opts
 * @param {string} opts.systemInstruction
 * @param {Array} opts.contents - [{role, parts:[{text}]}]
 * @param {Object} opts.generationConfig
 * @param {string} opts.model - default 'gemini-3.1-flash-lite'
 * @param {Object} opts.responseSchema - for structured output
 */
async function generateText(opts) {
  const model = opts.model || 'gemini-3.1-flash-lite';
  const url = `${BASE}/${model}:generateContent?key=${GEMINI_KEY}`;

  const body = {
    contents: opts.contents,
    generationConfig: {
      maxOutputTokens: 200,
      temperature: 1.0,
      ...opts.generationConfig,
    },
  };
  if (opts.systemInstruction) {
    body.systemInstruction = { parts: [{ text: opts.systemInstruction }] };
  }
  if (opts.responseSchema) {
    body.generationConfig.responseMimeType = 'application/json';
    body.generationConfig.responseSchema = opts.responseSchema;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini ${res.status}: ${errText.slice(0, 200)}`);
  }
  const data = await res.json();
  const parts = data.candidates?.[0]?.content?.parts || [];
  const text = parts.map(p => p.text || '').join('').trim();
  return { text, raw: data };
}

/**
 * Generate text and parse JSON response
 */
async function generateJSON(opts) {
  const { text } = await generateText(opts);
  try {
    return JSON.parse(text);
  } catch (e) {
    // Attempt to extract JSON from text
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error(`Could not parse Gemini JSON: ${text.slice(0, 200)}`);
  }
}

/**
 * Generate an image with Gemini 3 Pro Image (Nano Banana Pro)
 * @returns {Buffer} PNG image bytes
 */
async function generateImage(opts) {
  const model = opts.model || 'gemini-3-pro-image';
  const url = `${BASE}/${model}:generateContent?key=${GEMINI_KEY}`;

  const parts = [];
  if (opts.prompt) parts.push({ text: opts.prompt });
  if (opts.referenceImages) {
    for (const ref of opts.referenceImages) {
      parts.push({
        inlineData: {
          mimeType: ref.mimeType || 'image/png',
          data: ref.data, // base64
        },
      });
    }
  }

  const body = {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      responseModalities: ['IMAGE'],
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Image gen ${res.status}: ${errText.slice(0, 300)}`);
  }
  const data = await res.json();
  const imgPart = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
  if (!imgPart) throw new Error('No image in response');
  return Buffer.from(imgPart.inlineData.data, 'base64');
}

module.exports = { generateText, generateJSON, generateImage };
