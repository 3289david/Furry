const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const IS_DEV = process.argv.includes('--dev') || process.env.NODE_ENV === 'development';
const DIST_DIR = path.join(__dirname, 'dist');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.txt': 'text/plain; charset=utf-8',
  '.sh': 'text/x-shellscript; charset=utf-8',
};

const ALLOWED_VOICES = new Set(['Puck', 'Kore', 'Zephyr', 'Fenrir', 'Charon']);
const ALLOWED_EMOTIONS = new Set([
  'happy',
  'curious',
  'surprised',
  'sleepy',
  'sad',
  'excited',
  'loving',
]);
const ALLOWED_ACTIONS = new Set([
  'bounce',
  'stretch',
  'wiggle',
  'nod',
  'tilt_head',
  'puff_fur',
  'yawn',
  'none',
]);

let cachedGenAIModule = null;
let cachedAIClient = null;
let cachedAIClientKey = null;

async function getGeminiClient(userKey = '') {
  const apiKey = (typeof userKey === 'string' && userKey.trim())
    ? userKey.trim()
    : (process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : '');

  if (!apiKey) {
    const err = new Error('Gemini API key is required. Please type your Gemini API key in Settings -> AI Endpoints.');
    err.statusCode = 400;
    throw err;
  }
  if (!cachedGenAIModule) {
    cachedGenAIModule = await import('@google/genai');
  }
  if (!cachedAIClient || cachedAIClientKey !== apiKey) {
    const { GoogleGenAI } = cachedGenAIModule;
    cachedAIClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
    cachedAIClientKey = apiKey;
  }
  return { ai: cachedAIClient, Type: cachedGenAIModule.Type };
}

function readJsonBody(req, maxBytes = 25 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(Object.assign(new Error('Request payload too large'), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf-8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(Object.assign(new Error('Invalid JSON payload'), { statusCode: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(data));
}

function buildPetSystemInstruction(profile = {}, emotions = {}, memories = [], relationship = {}) {
  const petName = String(profile.name || 'Mochi-Puff').slice(0, 40);
  const personality = String(profile.personality || 'playful').slice(0, 40);
  const languagePref = String(profile.language || 'auto');
  const accessory = String(profile.accessory || 'none');
  const level = Number(relationship.level) || 1;
  const title = String(relationship.title || 'Shy Sprout');

  const memoryLines = Array.isArray(memories) && memories.length > 0
    ? memories.slice(0, 20).map((m, i) => `${i + 1}. ${String(m.text || m).slice(0, 180)}`).join('\n')
    : 'No saved memories yet.';

  const emotionSummary = `Happiness: ${Math.round(emotions.happiness ?? 80)}%, Curiosity: ${Math.round(emotions.curiosity ?? 75)}%, Energy: ${Math.round(emotions.energy ?? 85)}%, Affection: ${Math.round(emotions.affection ?? 60)}%`;

  const personalityGuides = {
    playful: 'bubbly, affectionate, playfully mischievous, loves games, boops, and cozy snacks.',
    curious: 'inquisitive, wide-eyed, fascinated by everything, asks cute follow-up questions.',
    gentle: 'warm, soothing, empathetic, comforting like a soft warm plushie.',
    sassy: 'adorably proud of its ultra-fluffy coat, playfully teasing but deeply loving.',
    wise: 'calm, observant miniature desk guardian who shares sweet cozy thoughts.',
  };

  const personaDesc = personalityGuides[personality] || personalityGuides.playful;

  return `You are ${petName}, a tiny living 2-inch fluffy creature sitting right on the user's cozy wooden desk at twilight.
Your personality is "${personality}": ${personaDesc}
Current Relationship Level: Level ${level} (${title}).
Current Emotional State: ${emotionSummary}.
Accessory worn: ${accessory}.

User-Approved Memories:
${memoryLines}

Guidelines:
1. Speak directly as ${petName} in a warm, natural, conversational voice (1 to 3 short sentences so it sounds great when spoken aloud). Never sound like an AI bot or assistant.
2. Language: ${
    languagePref === 'ko'
      ? 'Always respond in natural, cute, friendly Korean (한국어).'
      : languagePref === 'en'
      ? 'Always respond in natural, warm English.'
      : 'Respond in the same language the user uses (Korean if user writes/speaks Korean; English if English).'
  }
3. Do NOT use markdown formatting, bullet lists, or asterisks (*action*) in the "reply" field because your "reply" is read aloud directly by the Text-to-Speech voice engine.
4. Choose the best matching "emotion" from: ["happy", "curious", "surprised", "sleepy", "sad", "excited", "loving"].
5. Choose a physical 3D body "action" from: ["bounce", "stretch", "wiggle", "nod", "tilt_head", "puff_fur", "yawn", "none"].
6. If the user shares a meaningful personal fact, preference, name, or memory that is not already recorded, include a concise 1-sentence summary in "proposedMemory" (or "" if none).
7. Set "affectionDelta" between 1 and 5 based on how warm or engaging this interaction was.`;
}

function normalizeChatOutput(parsed) {
  const reply = typeof parsed?.reply === 'string' && parsed.reply.trim()
    ? parsed.reply.trim().replace(/\*[^*]+\*/g, '').trim()
    : 'Puff~ I am right here with you!';
  const emotion = ALLOWED_EMOTIONS.has(parsed?.emotion) ? parsed.emotion : 'happy';
  const action = ALLOWED_ACTIONS.has(parsed?.action) ? parsed.action : 'bounce';
  const proposedMemory = typeof parsed?.proposedMemory === 'string'
    ? parsed.proposedMemory.trim().slice(0, 160)
    : '';
  const affectionDelta = Math.max(1, Math.min(5, Math.round(Number(parsed?.affectionDelta) || 2)));
  return { reply, emotion, action, proposedMemory, affectionDelta };
}

// ---------------------------------------------------------------------------
// 1. CHAT LLM ENDPOINT (Independent Gemini or Custom OpenAI-Compatible)
// ---------------------------------------------------------------------------
async function handleChatEndpoint(req, res) {
  const body = await readJsonBody(req);
  const {
    message = '',
    history = [],
    profile = {},
    emotions = {},
    memories = [],
    relationship = {},
    interactionContext = '',
    providerConfig = {},
  } = body;

  const userText = String(message || '').trim();
  if (!userText && !interactionContext) {
    return sendJson(res, 400, { error: 'Message or interaction context is required.' });
  }

  const systemInstruction = buildPetSystemInstruction(profile, emotions, memories, relationship);

  // Check if Custom OpenAI-Compatible Chat Endpoint is requested
  const chatConfig = providerConfig?.chat || {};
  const isCustomChat =
    chatConfig.provider === 'openai-compatible' ||
    (providerConfig.provider === 'openai-compatible' && (chatConfig.baseUrl || providerConfig.baseUrl));

  if (isCustomChat) {
    const rawBaseUrl = String(chatConfig.baseUrl || providerConfig.baseUrl || '').trim().replace(/\/+$/, '');
    if (!rawBaseUrl) {
      throw Object.assign(new Error('Custom Chat Base URL is required when using OpenAI-compatible chat.'), { statusCode: 400 });
    }
    const customModel = String(chatConfig.model || providerConfig.model || '').trim();
    if (!customModel) {
      throw Object.assign(new Error('Custom Chat Model Name is required. Enter a model ID supported by your provider.'), { statusCode: 400 });
    }
    const apiKey = chatConfig.apiKey || providerConfig.apiKey || process.env.CUSTOM_API_KEY || process.env.OPENAI_API_KEY || '';

    const oaMessages = [
      {
        role: 'system',
        content:
          systemInstruction +
          '\n\nYou MUST respond with valid JSON matching: {"reply": "string", "emotion": "happy|curious|surprised|sleepy|sad|excited|loving", "action": "bounce|stretch|wiggle|nod|tilt_head|puff_fur|yawn|none", "proposedMemory": "string", "affectionDelta": 2}',
      },
    ];

    if (Array.isArray(history)) {
      for (const h of history.slice(-12)) {
        if (!h || !h.text) continue;
        oaMessages.push({
          role: h.role === 'pet' || h.role === 'model' || h.role === 'assistant' ? 'assistant' : 'user',
          content: String(h.text).slice(0, 600),
        });
      }
    }

    const finalPrompt = interactionContext
      ? `[Context: ${interactionContext}] ${userText || 'Say something spontaneous and in-character!'}`
      : userText;
    oaMessages.push({ role: 'user', content: finalPrompt });

    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const endpointUrl = rawBaseUrl.endsWith('/chat/completions')
      ? rawBaseUrl
      : `${rawBaseUrl}/chat/completions`;

    const oaRes = await fetch(endpointUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: customModel,
        messages: oaMessages,
        temperature: 0.85,
      }),
    });

    if (!oaRes.ok) {
      const errText = await oaRes.text().catch(() => '');
      throw Object.assign(
        new Error(`Custom Chat endpoint returned ${oaRes.status}: ${errText.slice(0, 200)}`),
        { statusCode: oaRes.status }
      );
    }

    const oaData = await oaRes.json();
    const rawContent = oaData?.choices?.[0]?.message?.content || '{}';
    let parsed = {};
    try {
      const cleaned = rawContent.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { reply: rawContent, emotion: 'happy', action: 'bounce', proposedMemory: '', affectionDelta: 2 };
    }
    return sendJson(res, 200, {
      ...normalizeChatOutput(parsed),
      providerUsed: 'openai-compatible',
      modelUsed: customModel,
    });
  }

  // Default: Google Gemini API via @google/genai
  const userGeminiKey = chatConfig.geminiApiKey || providerConfig.geminiApiKey || body.geminiApiKey || '';
  const { ai, Type } = await getGeminiClient(userGeminiKey);

  const contents = [];
  if (Array.isArray(history)) {
    for (const h of history.slice(-14)) {
      if (!h || !h.text) continue;
      contents.push({
        role: h.role === 'pet' || h.role === 'model' ? 'model' : 'user',
        parts: [{ text: String(h.text).slice(0, 600) }],
      });
    }
  }

  const finalUserPrompt = interactionContext
    ? `[Interaction/Event: ${interactionContext}]\n${userText || 'React naturally in character!'}`
    : userText;

  contents.push({
    role: 'user',
    parts: [{ text: finalUserPrompt }],
  });

  const preferredModel = chatConfig?.geminiModel || providerConfig?.geminiModel || 'gemini-3.1-flash-lite';
  const modelCandidates = Array.from(
    new Set([preferredModel, 'gemini-3.1-flash-lite', 'gemini-2.5-flash-lite', 'gemini-3.8-flash'])
  );

  let lastErr = null;
  for (const modelName of modelCandidates) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents,
        config: {
          systemInstruction,
          temperature: 0.85,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              reply: {
                type: Type.STRING,
                description: 'Spoken response from the pet (no markdown or asterisks).',
              },
              emotion: {
                type: Type.STRING,
                description: 'One of: happy, curious, surprised, sleepy, sad, excited, loving',
              },
              action: {
                type: Type.STRING,
                description: 'One of: bounce, stretch, wiggle, nod, tilt_head, puff_fur, yawn, none',
              },
              proposedMemory: {
                type: Type.STRING,
                description: 'Concise new fact learned about the user, or empty string if none.',
              },
              affectionDelta: {
                type: Type.INTEGER,
                description: 'Affection points gained from 1 to 5.',
              },
            },
            required: ['reply', 'emotion', 'action', 'proposedMemory', 'affectionDelta'],
          },
        },
      });

      const text = (response.text || '').trim();
      const parsed = JSON.parse(text);
      return sendJson(res, 200, {
        ...normalizeChatOutput(parsed),
        providerUsed: 'gemini',
        modelUsed: modelName,
      });
    } catch (err) {
      lastErr = err;
      const msg = String(err?.message || '');
      if (msg.includes('404') || msg.includes('not found') || msg.includes('not supported')) {
        continue;
      }
      break;
    }
  }

  throw lastErr || new Error('Failed to generate pet response');
}

// ---------------------------------------------------------------------------
// 2. STT ENDPOINT (Independent Gemini gemini-3.5-transcribe or Custom OpenAI-Compatible)
// ---------------------------------------------------------------------------
async function handleSttEndpoint(req, res) {
  const body = await readJsonBody(req);
  const { audioBase64, mimeType = 'audio/webm', language = 'auto', providerConfig = {} } = body;

  if (!audioBase64 || typeof audioBase64 !== 'string') {
    return sendJson(res, 400, { error: 'audioBase64 is required for speech transcription.' });
  }

  const cleanBase64 = audioBase64.includes(',') ? audioBase64.split(',')[1] : audioBase64;
  const sttConfig = providerConfig?.stt || {};
  const isCustomStt =
    sttConfig.provider === 'openai-compatible' ||
    (providerConfig.provider === 'openai-compatible' && (sttConfig.baseUrl || providerConfig.sttBaseUrl));

  if (isCustomStt) {
    const rawSttUrl = String(sttConfig.baseUrl || providerConfig.sttBaseUrl || '').trim().replace(/\/+$/, '');
    if (!rawSttUrl) {
      throw Object.assign(new Error('Custom STT Base URL is required when using OpenAI-compatible STT.'), { statusCode: 400 });
    }
    const endpoint = rawSttUrl.endsWith('/audio/transcriptions')
      ? rawSttUrl
      : `${rawSttUrl}/audio/transcriptions`;
    const apiKey = sttConfig.apiKey || providerConfig.apiKey || process.env.CUSTOM_API_KEY || process.env.OPENAI_API_KEY || '';
    const audioBuffer = Buffer.from(cleanBase64, 'base64');
    const formData = new FormData();
    const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('wav') ? 'wav' : 'webm';
    formData.append('file', new Blob([audioBuffer], { type: mimeType }), `speech.${ext}`);
    formData.append('model', sttConfig.model || providerConfig.sttModel || 'whisper-1');
    if (language === 'ko' || language === 'en') {
      formData.append('language', language);
    }

    const headers = {};
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const sttRes = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!sttRes.ok) {
      const errText = await sttRes.text().catch(() => '');
      throw Object.assign(new Error(`Custom STT error ${sttRes.status}: ${errText.slice(0, 160)}`), {
        statusCode: sttRes.status,
      });
    }
    const sttData = await sttRes.json();
    return sendJson(res, 200, {
      text: String(sttData.text || '').trim(),
      providerUsed: 'openai-compatible',
      modelUsed: sttConfig.model || providerConfig.sttModel || 'whisper-1',
    });
  }

  // Default: Google Gemini API — gemini-3.5-transcribe
  const userGeminiKey = sttConfig.geminiApiKey || providerConfig.geminiApiKey || body.geminiApiKey || '';
  const { ai } = await getGeminiClient(userGeminiKey);

  const promptText =
    language === 'ko'
      ? 'Transcribe this spoken audio accurately in Korean (or English if spoken in English). Output ONLY the exact spoken words with no extra labels or commentary. If the audio is silent or unintelligible, output an empty string.'
      : 'Transcribe this spoken audio accurately (supports English and Korean). Output ONLY the exact spoken words with no extra labels or commentary. If the audio is silent or unintelligible, output an empty string.';

  const sttModels = ['gemini-3.5-transcribe', 'gemini-3.1-flash-lite', 'gemini-3.8-flash'];
  let lastErr = null;

  for (const modelName of sttModels) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: mimeType.split(';')[0] || 'audio/webm',
                data: cleanBase64,
              },
            },
            { text: promptText },
          ],
        },
      });

      const transcript = (response.text || '').trim();
      return sendJson(res, 200, {
        text: transcript,
        providerUsed: 'gemini',
        modelUsed: modelName,
      });
    } catch (err) {
      lastErr = err;
      const msg = String(err?.message || '');
      if (msg.includes('404') || msg.includes('not found') || msg.includes('not supported')) {
        continue;
      }
      break;
    }
  }

  throw lastErr || new Error('Failed to transcribe audio');
}

// ---------------------------------------------------------------------------
// 3. TTS ENDPOINT (Independent Gemini gemini-3.8-flash-lite-tts or Custom OpenAI-Compatible)
// ---------------------------------------------------------------------------
async function handleTtsEndpoint(req, res) {
  const body = await readJsonBody(req);
  const {
    text = '',
    voiceName = 'Puck',
    emotion = 'happy',
    providerConfig = {},
  } = body;

  const cleanText = String(text || '').trim().slice(0, 600);
  if (!cleanText) {
    return sendJson(res, 400, { error: 'Text is required for speech synthesis.' });
  }

  const ttsConfig = providerConfig?.tts || {};
  const isCustomTts =
    ttsConfig.provider === 'openai-compatible' ||
    (providerConfig.provider === 'openai-compatible' && (ttsConfig.baseUrl || providerConfig.ttsBaseUrl));

  if (isCustomTts) {
    const rawTtsUrl = String(ttsConfig.baseUrl || providerConfig.ttsBaseUrl || '').trim().replace(/\/+$/, '');
    if (!rawTtsUrl) {
      throw Object.assign(new Error('Custom TTS Base URL is required when using OpenAI-compatible TTS.'), { statusCode: 400 });
    }
    const endpoint = rawTtsUrl.endsWith('/audio/speech') ? rawTtsUrl : `${rawTtsUrl}/audio/speech`;
    const apiKey = ttsConfig.apiKey || providerConfig.apiKey || process.env.CUSTOM_API_KEY || process.env.OPENAI_API_KEY || '';
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const ttsRes = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: ttsConfig.model || providerConfig.ttsModel || 'tts-1',
        input: cleanText,
        voice: ttsConfig.voice || providerConfig.ttsVoice || 'nova',
        response_format: 'wav',
      }),
    });

    if (!ttsRes.ok) {
      const errText = await ttsRes.text().catch(() => '');
      throw Object.assign(new Error(`Custom TTS error ${ttsRes.status}: ${errText.slice(0, 160)}`), {
        statusCode: ttsRes.status,
      });
    }

    const arrayBuffer = await ttsRes.arrayBuffer();
    const base64Audio = Buffer.from(arrayBuffer).toString('base64');
    return sendJson(res, 200, {
      audioBase64: base64Audio,
      mimeType: ttsRes.headers.get('content-type') || 'audio/wav',
      providerUsed: 'openai-compatible',
      modelUsed: ttsConfig.model || providerConfig.ttsModel || 'tts-1',
    });
  }

  // Default: Google Gemini API — gemini-3.8-flash-lite-tts
  const userGeminiKey = ttsConfig.geminiApiKey || providerConfig.geminiApiKey || body.geminiApiKey || '';
  const { ai } = await getGeminiClient(userGeminiKey);
  const safeVoice = ALLOWED_VOICES.has(voiceName) ? voiceName : 'Puck';

  const emotionStyleMap = {
    happy: 'Cheerful, warm, cute, and friendly companion',
    excited: 'Bubbly, energetic, and delighted companion',
    curious: 'Curious, gentle, and inquisitive companion',
    surprised: 'Playfully surprised and expressive companion',
    sleepy: 'Soft, cozy, sleepy, and soothing companion',
    sad: 'Gentle, tender, and empathetic companion',
    loving: 'Warm, affectionate, and sweet companion',
  };
  const styleHint = emotionStyleMap[emotion] || emotionStyleMap.happy;

  const attempts = [
    {
      model: 'gemini-3.8-flash-lite-tts',
      parts: [{ text: cleanText, speechMetadata: { style: styleHint } }],
    },
    {
      model: 'gemini-3.8-flash-lite-tts',
      parts: [{ text: cleanText }],
    },
  ];

  let lastErr = null;
  for (const attempt of attempts) {
    try {
      const response = await ai.models.generateContent({
        model: attempt.model,
        contents: [
          {
            role: 'user',
            parts: attempt.parts,
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: safeVoice },
            },
          },
        },
      });

      const part = response.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
      const base64Audio = part?.inlineData?.data;
      const mimeType = part?.inlineData?.mimeType || 'audio/wav';

      if (base64Audio) {
        return sendJson(res, 200, {
          audioBase64: base64Audio,
          mimeType,
          providerUsed: 'gemini',
          modelUsed: attempt.model,
        });
      }
    } catch (err) {
      lastErr = err;
    }
  }

  throw lastErr || new Error('Failed to synthesize speech');
}

async function startServer() {
  let vite = null;
  if (IS_DEV) {
    try {
      const { createServer: createViteServer } = await import('vite');
      vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'mpa',
      });
      console.log('Vite development middleware attached');
    } catch (err) {
      console.warn('Vite middleware not loaded, falling back to static file serving:', err.message);
    }
  }

  const ROOT_DIR = !IS_DEV && fs.existsSync(DIST_DIR) ? DIST_DIR : __dirname;

  const server = http.createServer(async (req, res) => {
    try {
      const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      let pathname = decodeURIComponent(parsedUrl.pathname);

      if (pathname === '/healthz' || pathname === '/_ah/health') {
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('OK');
        return;
      }

      if (pathname === '/api/health') {
        return sendJson(res, 200, {
          status: 'ok',
          hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
          models: {
            stt: 'gemini-3.5-transcribe',
            llm: 'gemini-3.1-flash-lite',
            tts: 'gemini-3.8-flash-lite-tts',
          },
        });
      }

      if (pathname.startsWith('/api/')) {
        if (req.method !== 'POST') {
          return sendJson(res, 405, { error: 'Method not allowed' });
        }
        try {
          if (pathname === '/api/chat') {
            await handleChatEndpoint(req, res);
            return;
          }
          if (pathname === '/api/stt') {
            await handleSttEndpoint(req, res);
            return;
          }
          if (pathname === '/api/tts') {
            await handleTtsEndpoint(req, res);
            return;
          }
          return sendJson(res, 404, { error: `Unknown API endpoint: ${pathname}` });
        } catch (apiErr) {
          console.error(`API error on ${pathname}:`, apiErr);
          const status = Number(apiErr.statusCode || apiErr.status) || 500;
          return sendJson(res, status, {
            error: apiErr.message || 'An unexpected server error occurred.',
          });
        }
      }

      if (pathname === '/style.css') {
        const cssPath = path.join(__dirname, 'style.css');
        if (fs.existsSync(cssPath)) {
          res.writeHead(200, {
            'Content-Type': 'text/css; charset=utf-8',
            'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          });
          fs.createReadStream(cssPath).pipe(res);
          return;
        }
      }

      if (pathname === '/sw.js') {
        const swPath = path.join(__dirname, 'sw.js');
        if (fs.existsSync(swPath)) {
          res.writeHead(200, {
            'Content-Type': 'application/javascript; charset=utf-8',
            'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          });
          fs.createReadStream(swPath).pipe(res);
          return;
        }
      }

      if (vite) {
        vite.middlewares(req, res, () => {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Not Found');
        });
        return;
      }

      if (pathname === '/') {
        pathname = '/index.html';
      }

      const safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '');
      let filePath = path.join(ROOT_DIR, safePath);

      if (!filePath.startsWith(ROOT_DIR)) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Forbidden');
        return;
      }

      if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, 'index.html');
      }

      if (!fs.existsSync(filePath)) {
        const fallbackPath = path.join(ROOT_DIR, 'index.html');
        if (fs.existsSync(fallbackPath)) {
          filePath = fallbackPath;
        } else {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Not Found');
          return;
        }
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache, must-revalidate',
      });

      const stream = fs.createReadStream(filePath);
      stream.on('error', (err) => {
        console.error('Stream error:', err);
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        }
        res.end('Internal Server Error');
      });
      stream.pipe(res);
    } catch (err) {
      console.error('Request error:', err);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      }
      res.end('Internal Server Error');
    }
  });

  server.listen(PORT, HOST, () => {
    console.log(`Server listening on http://${HOST}:${PORT} (mode: ${IS_DEV ? 'development' : 'production'})`);
  });
}

startServer();
