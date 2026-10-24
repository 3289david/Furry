// Persistent Pet Profile, Emotion Engine, Autonomous State Machine,
// Voice (Gemini STT + TTS + Web Audio Lip-Sync Analyser), and Mini-Games Controller

const STORAGE_KEY = 'mochi_puff_pet_v2';

export const RELATIONSHIP_LEVELS = [
  { level: 1, minXp: 0, titleEn: 'Shy Sprout', titleKo: '수줍은 새싹' },
  { level: 2, minXp: 50, titleEn: 'Curious Buddy', titleKo: '호기심 친구' },
  { level: 3, minXp: 140, titleEn: 'Cozy Companion', titleKo: '포근한 단짝' },
  { level: 4, minXp: 280, titleEn: 'Fluffy Soulmate', titleKo: '복슬복슬 소울메이트' },
  { level: 5, minXp: 480, titleEn: 'Eternal Desk Guardian', titleKo: '영원한 책상 수호천사' },
];

export const EYE_COLOR_PRESETS = [
  { name: 'Amethyst', color: '#3d285c' },
  { name: 'Sapphire', color: '#1d4ed8' },
  { name: 'Emerald', color: '#047857' },
  { name: 'Honey Amber', color: '#b45309' },
  { name: 'Sakura Rose', color: '#be185d' },
  { name: 'Cocoa Warm', color: '#451a03' },
  { name: 'White', color: '#ffffff' },
];

export const ACCESSORY_OPTIONS = [
  { id: 'none', labelEn: 'None', labelKo: '없음' },
  { id: 'crown', labelEn: 'Star Crown', labelKo: '별 왕관' },
  { id: 'bow', labelEn: 'Sakura Bow', labelKo: '벚꽃 리본' },
  { id: 'glasses', labelEn: 'Cozy Glasses', labelKo: '동글 안경' },
  { id: 'sprout', labelEn: 'Leaf Sprout', labelKo: '새싹 핀' },
  { id: 'beret', labelEn: 'Artist Beret', labelKo: '화가 베레모' },
  { id: 'halo', labelEn: 'Starlight Halo', labelKo: '별빛 헤일로' },
];

export const PERSONALITY_OPTIONS = [
  { id: 'playful', labelEn: 'Playful & Bubbly', labelKo: '발랄하고 장난꾸러기' },
  { id: 'curious', labelEn: 'Curious & Wide-Eyed', labelKo: '호기심 가득 탐험가' },
  { id: 'gentle', labelEn: 'Gentle & Comforting', labelKo: '다정하고 포근한 위로' },
  { id: 'sassy', labelEn: 'Sassy & Proud Puff', labelKo: '도도하지만 귀여운 츤데레' },
  { id: 'wise', labelEn: 'Cozy Desk Sage', labelKo: '차분한 책상 위 현자' },
];

export const VOICE_OPTIONS = [
  { id: 'Puck', label: 'Puck (Bright & Playful)' },
  { id: 'Kore', label: 'Kore (Warm & Gentle)' },
  { id: 'Zephyr', label: 'Zephyr (Airy & Sweet)' },
  { id: 'Fenrir', label: 'Fenrir (Cozy & Deep)' },
  { id: 'Charon', label: 'Charon (Calm & Storyteller)' },
];

export function loadSavedPetData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function createPetBrain({ creature, simState, onStateChange, onSubtitleChange }) {
  const saved = loadSavedPetData();
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const state = {
    profile: {
      name: saved?.profile?.name || 'Mochi-Puff',
      personality: saved?.profile?.personality || 'playful',
      voiceName: saved?.profile?.voiceName || 'Puck',
      voiceMuted: saved?.profile?.voiceMuted ?? false,
      language: saved?.profile?.language || 'auto',
      eyeColor: saved?.profile?.eyeColor || '#3d285c',
      accessory: saved?.profile?.accessory || 'none',
      proactiveChatEnabled:
        saved?.profile?.proactiveChatOptIn === true &&
        saved?.profile?.proactiveChatEnabled === true,
      proactiveChatOptIn: saved?.profile?.proactiveChatOptIn === true,
      proactiveIntervalSec: saved?.profile?.proactiveIntervalSec || 60,
      reducedMotion: saved?.profile?.reducedMotion ?? prefersReducedMotion,
      providerConfig: {
        geminiApiKey: saved?.profile?.providerConfig?.geminiApiKey || saved?.geminiApiKey || '',
        chat: {
          provider: saved?.profile?.providerConfig?.chat?.provider || saved?.profile?.providerConfig?.provider || 'gemini',
          baseUrl: saved?.profile?.providerConfig?.chat?.baseUrl || saved?.profile?.providerConfig?.baseUrl || '',
          model: saved?.profile?.providerConfig?.chat?.model || saved?.profile?.providerConfig?.model || 'gemini-3.1-flash-lite',
          apiKey: saved?.profile?.providerConfig?.chat?.apiKey || '',
        },
        stt: {
          provider: saved?.profile?.providerConfig?.stt?.provider || (saved?.profile?.providerConfig?.sttBaseUrl ? 'openai-compatible' : 'gemini'),
          baseUrl: saved?.profile?.providerConfig?.stt?.baseUrl || saved?.profile?.providerConfig?.sttBaseUrl || '',
          model: saved?.profile?.providerConfig?.stt?.model || saved?.profile?.providerConfig?.sttModel || 'gemini-3.5-transcribe',
          apiKey: saved?.profile?.providerConfig?.stt?.apiKey || '',
        },
        tts: {
          provider: saved?.profile?.providerConfig?.tts?.provider || (saved?.profile?.providerConfig?.ttsBaseUrl ? 'openai-compatible' : 'gemini'),
          baseUrl: saved?.profile?.providerConfig?.tts?.baseUrl || saved?.profile?.providerConfig?.ttsBaseUrl || '',
          model: saved?.profile?.providerConfig?.tts?.model || saved?.profile?.providerConfig?.ttsModel || 'gemini-3.8-flash-lite-tts',
          voice: saved?.profile?.providerConfig?.tts?.voice || saved?.profile?.providerConfig?.ttsVoice || 'Puck',
          apiKey: saved?.profile?.providerConfig?.tts?.apiKey || '',
        },
      },
    },
    emotions: {
      happiness: saved?.emotions?.happiness ?? 84,
      curiosity: saved?.emotions?.curiosity ?? 78,
      energy: saved?.emotions?.energy ?? 90,
      affection: saved?.emotions?.affection ?? 62,
      currentMood: saved?.emotions?.currentMood || 'happy',
    },
    relationship: {
      xp: saved?.relationship?.xp ?? 20,
      level: saved?.relationship?.level ?? 1,
      interactionsCount: saved?.relationship?.interactionsCount ?? 0,
      lastPetXpTime: 0,
    },
    memories: Array.isArray(saved?.memories)
      ? saved.memories
      : [
          {
            id: 'mem-init-1',
            text: 'We met on the cozy twilight desk!',
            createdAt: new Date().toISOString(),
          },
        ],
    pendingMemories: Array.isArray(saved?.pendingMemories) ? saved.pendingMemories : [],
    history: Array.isArray(saved?.history)
      ? saved.history.slice(-30)
      : [
          {
            id: 'msg-welcome',
            role: 'pet',
            text: 'Puff~ Hi there! I am Mochi-Puff! Pet my fur, talk to me with your voice, or let us hang out on your cozy desk! (안녕! 난 모찌퍼프야! 날 쓰다듬거나 목소리로 말을 걸어줘!)',
            emotion: 'happy',
            timestamp: Date.now(),
          },
        ],
    // Runtime non-persisted state
    behaviorState: 'idle',
    isChatLoading: false,
    isRecordingMic: false,
    isTranscribing: false,
    isSpeaking: false,
    isTalkMode: false,
    micPermission: 'prompt', // 'prompt' | 'granted' | 'denied' | 'unavailable'
    micInputLevel: 0,
    voiceAmplitude: 0,
    lastError: null,
  };

  // Apply saved visual customization to simState and creature
  if (saved?.appearance) {
    Object.keys(saved.appearance).forEach((k) => {
      if (saved.appearance[k] !== undefined) {
        simState[k] = saved.appearance[k];
      }
    });
  }
  if (saved?.appearance?.accessory) {
    state.profile.accessory = saved.appearance.accessory;
    simState.accessory = saved.appearance.accessory;
  } else if (state.profile.accessory) {
    simState.accessory = state.profile.accessory;
  }

  if (saved?.appearance?.eyeColor) {
    state.profile.eyeColor = saved.appearance.eyeColor;
    simState.eyeColor = saved.appearance.eyeColor;
  } else if (state.profile.eyeColor) {
    simState.eyeColor = state.profile.eyeColor;
  }

  creature.setEyeColor(state.profile.eyeColor);
  creature.setAccessory(state.profile.accessory);
  creature.setEmotion(state.emotions.currentMood);

  function saveToStorage() {
    try {
      const payload = {
        profile: state.profile,
        emotions: state.emotions,
        relationship: {
          xp: state.relationship.xp,
          level: state.relationship.level,
          interactionsCount: state.relationship.interactionsCount,
        },
        memories: state.memories.slice(0, 40),
        pendingMemories: state.pendingMemories.slice(0, 10),
        history: state.history.slice(-30),
        appearance: {
          baseColor: simState.baseColor,
          tipColor: simState.tipColor,
          furLength: simState.furLength,
          furDensity: simState.furDensity,
          roughness: simState.roughness,
          specular: simState.specular,
          clumping: simState.clumping,
          curliness: simState.curliness,
          keyColor: simState.keyColor,
          lightAngle: simState.lightAngle,
          lightIntensity: simState.lightIntensity,
          rimIntensity: simState.rimIntensity,
          windStrength: simState.windStrength,
          environment: simState.environment,
          gpuFurEnabled: simState.gpuFurEnabled,
          accessory: simState.accessory || state.profile.accessory || 'none',
          eyeColor: simState.eyeColor || state.profile.eyeColor || '#3d285c',
        },
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // ignore quota errors
    }
  }

  function getRelationshipInfo() {
    const xp = state.relationship.xp;
    let currentTier = RELATIONSHIP_LEVELS[0];
    let nextTier = RELATIONSHIP_LEVELS[1];
    for (let i = 0; i < RELATIONSHIP_LEVELS.length; i++) {
      if (xp >= RELATIONSHIP_LEVELS[i].minXp) {
        currentTier = RELATIONSHIP_LEVELS[i];
        nextTier = RELATIONSHIP_LEVELS[i + 1] || null;
      }
    }
    state.relationship.level = currentTier.level;
    const progressPct = nextTier
      ? Math.min(
          100,
          Math.round(((xp - currentTier.minXp) / (nextTier.minXp - currentTier.minXp)) * 100)
        )
      : 100;
    const isKo = state.profile.language === 'ko';
    return {
      level: currentTier.level,
      xp,
      nextMinXp: nextTier ? nextTier.minXp : currentTier.minXp,
      progressPct,
      title: isKo ? currentTier.titleKo : currentTier.titleEn,
      titleEn: currentTier.titleEn,
      titleKo: currentTier.titleKo,
    };
  }

  function addRelationshipXp(amount, reason = '') {
    const prevLevel = getRelationshipInfo().level;
    state.relationship.xp = Math.max(0, state.relationship.xp + amount);
    state.relationship.interactionsCount += 1;
    const nextInfo = getRelationshipInfo();
    if (nextInfo.level > prevLevel) {
      creature.triggerAction('bounce');
      creature.setEmotion('excited');
      const msg =
        state.profile.language === 'ko'
          ? `우와! 우리 친밀도가 레벨 ${nextInfo.level} (${nextInfo.titleKo})로 올랐어요!`
          : `Yay! Our bond grew to Level ${nextInfo.level}: ${nextInfo.titleEn}!`;
      showSubtitle(msg, 5500);
    }
    saveToStorage();
    notifyUpdate();
  }

  function adjustEmotions(deltas = {}, moodOverride = null) {
    if (deltas.happiness !== undefined) {
      state.emotions.happiness = Math.max(10, Math.min(100, state.emotions.happiness + deltas.happiness));
    }
    if (deltas.curiosity !== undefined) {
      state.emotions.curiosity = Math.max(10, Math.min(100, state.emotions.curiosity + deltas.curiosity));
    }
    if (deltas.energy !== undefined) {
      state.emotions.energy = Math.max(5, Math.min(100, state.emotions.energy + deltas.energy));
    }
    if (deltas.affection !== undefined) {
      state.emotions.affection = Math.max(10, Math.min(100, state.emotions.affection + deltas.affection));
    }

    if (moodOverride) {
      state.emotions.currentMood = moodOverride;
    } else if (state.emotions.energy < 22) {
      state.emotions.currentMood = 'sleepy';
    } else if (state.emotions.happiness > 85 && state.emotions.affection > 75) {
      state.emotions.currentMood = 'loving';
    } else if (state.emotions.happiness > 70) {
      state.emotions.currentMood = 'happy';
    }
    creature.setEmotion(state.emotions.currentMood);
    saveToStorage();
    notifyUpdate();
  }

  let subtitleTimer = null;
  function showSubtitle(text, durationMs = 6000) {
    if (subtitleTimer) clearTimeout(subtitleTimer);
    if (onSubtitleChange) {
      onSubtitleChange(text, Boolean(text));
    }
    if (text && durationMs > 0) {
      subtitleTimer = setTimeout(() => {
        if (!state.isSpeaking && onSubtitleChange) {
          onSubtitleChange('', false);
        }
      }, durationMs);
    }
  }

  function notifyUpdate() {
    if (onStateChange) {
      onStateChange(state, getRelationshipInfo());
    }
  }

  // =========================================================================
  // REAL-TIME AUDIO ANALYSER FOR VOICE TTS LIP-SYNC & MICROPHONE INPUT
  // =========================================================================
  let audioCtx = null;
  let currentAudioEl = null;
  let ttsAnalyser = null;
  let ttsDataArray = null;
  let synthFallbackInterval = null;

  function ensureAudioContext() {
    if (!audioCtx && typeof window !== 'undefined') {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  }

  let talkModeResumeTimer = null;
  function scheduleTalkResume(delayMs = 450) {
    if (!state.isTalkMode) return;
    if (talkModeResumeTimer) clearTimeout(talkModeResumeTimer);
    talkModeResumeTimer = setTimeout(async () => {
      if (state.isTalkMode && !state.isSpeaking && !state.isRecordingMic && !state.isChatLoading && !state.isTranscribing) {
        await startRecording();
      }
    }, delayMs);
  }

  function stopSpeaking() {
    if (currentAudioEl) {
      try {
        currentAudioEl.pause();
        currentAudioEl.src = '';
      } catch {}
      currentAudioEl = null;
    }
    if (synthFallbackInterval) {
      clearInterval(synthFallbackInterval);
      synthFallbackInterval = null;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
    ttsAnalyser = null;
    state.isSpeaking = false;
    state.voiceAmplitude = 0;
    creature.setSpeaking(false);
    creature.setMouthOpenness(0);
    if (state.behaviorState === 'speaking') {
      setBehavior('idle');
    }
    notifyUpdate();

    // If Talk Mode is active, automatically resume listening like a real conversation
    if (state.isTalkMode) {
      scheduleTalkResume(450);
    }
  }

  async function speakText(text, emotion = 'happy') {
    const cleanText = String(text || '').trim();
    if (!cleanText) return;

    // Always display spoken words as readable subtitles
    showSubtitle(cleanText, Math.max(5500, cleanText.length * 85));

    if (state.profile.voiceMuted) {
      // Even when muted, animate brief mouth movement for 2.2s so creature feels responsive
      stopSpeaking();
      state.isSpeaking = true;
      creature.setSpeaking(true);
      setBehavior('speaking');
      notifyUpdate();
      let elapsed = 0;
      synthFallbackInterval = setInterval(() => {
        elapsed += 0.05;
        const simAmp = 0.25 + 0.45 * Math.abs(Math.sin(elapsed * 14.0)) * Math.cos(elapsed * 5.0);
        state.voiceAmplitude = simAmp;
        creature.setMouthOpenness(simAmp);
        if (elapsed > Math.min(3.5, Math.max(1.5, cleanText.length * 0.045))) {
          stopSpeaking();
        }
      }, 50);
      return;
    }

    stopSpeaking();
    state.isSpeaking = true;
    creature.setSpeaking(true);
    setBehavior('speaking');
    notifyUpdate();

    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: cleanText,
          voiceName: state.profile.voiceName,
          emotion,
          providerConfig: state.profile.providerConfig,
        }),
      });

      if (!res.ok) {
        throw new Error(`TTS HTTP ${res.status}`);
      }

      const data = await res.json();
      if (!data.audioBase64) {
        throw new Error('No audio data returned');
      }

      // If user interrupted while TTS was generating, abort playback
      if (!state.isSpeaking) return;

      const mime = data.mimeType || 'audio/wav';
      const audioSrc = `data:${mime};base64,${data.audioBase64}`;
      const audio = new Audio(audioSrc);
      currentAudioEl = audio;

      const ctx = ensureAudioContext();
      if (ctx) {
        const source = ctx.createMediaElementSource(audio);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.55;
        source.connect(analyser);
        analyser.connect(ctx.destination);
        ttsAnalyser = analyser;
        ttsDataArray = new Uint8Array(analyser.frequencyBinCount);
      }

      audio.onended = () => {
        stopSpeaking();
      };
      audio.onerror = () => {
        stopSpeaking();
      };

      await audio.play();
    } catch (err) {
      // Fallback to browser SpeechSynthesis with procedural syllable lip-sync
      if (!state.isSpeaking) return;
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          const utter = new SpeechSynthesisUtterance(cleanText);
          const hasKorean = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(cleanText);
          utter.lang = hasKorean ? 'ko-KR' : 'en-US';
          utter.pitch = 1.25;
          utter.rate = 1.04;
          let t = 0;
          synthFallbackInterval = setInterval(() => {
            t += 0.05;
            const amp = 0.25 + 0.55 * Math.abs(Math.sin(t * 15.0));
            state.voiceAmplitude = amp;
            creature.setMouthOpenness(amp);
          }, 50);
          utter.onend = () => stopSpeaking();
          utter.onerror = () => stopSpeaking();
          window.speechSynthesis.speak(utter);
          return;
        } catch {}
      }
      stopSpeaking();
    }
  }

  // Sample real-time vocal amplitude every frame for 3D mouth & fur synchronization
  function sampleVoiceAmplitude() {
    if (!state.isSpeaking) {
      state.voiceAmplitude = 0;
      return 0;
    }
    if (ttsAnalyser && ttsDataArray) {
      ttsAnalyser.getByteTimeDomainData(ttsDataArray);
      let sumSq = 0;
      for (let i = 0; i < ttsDataArray.length; i++) {
        const norm = (ttsDataArray[i] - 128) / 128.0;
        sumSq += norm * norm;
      }
      const rms = Math.sqrt(sumSq / ttsDataArray.length);
      const amp = Math.min(1.0, rms * 4.2);
      state.voiceAmplitude = amp;
      creature.setMouthOpenness(amp);
      return amp;
    }
    return state.voiceAmplitude;
  }

  // =========================================================================
  // PUSH-TO-TALK / TAP-TO-TALK MICROPHONE RECORDING & GEMINI STT
  // =========================================================================
  let mediaRecorder = null;
  let micStream = null;
  let micChunks = [];
  let micAnalyser = null;
  let micDataArray = null;
  let micLevelInterval = null;

  async function startRecording() {
    if (state.isRecordingMic || state.isTranscribing) return false;
    stopSpeaking();
    state.lastError = null;

    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== 'function'
    ) {
      state.micPermission = 'unavailable';
      state.lastError =
        state.profile.language === 'ko'
          ? '이 브라우저에서는 마이크 입력을 사용할 수 없어요. 텍스트 채팅을 이용해 주세요!'
          : 'Microphone input is unavailable in this browser. Please use text chat below!';
      notifyUpdate();
      return false;
    }

    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      state.micPermission = 'granted';
      micChunks = [];

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : '';

      mediaRecorder = mimeType
        ? new MediaRecorder(micStream, { mimeType })
        : new MediaRecorder(micStream);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          micChunks.push(e.data);
        }
      };

      const ctx = ensureAudioContext();
      let speechStarted = false;
      let speechStartTime = 0;
      let lastSpeechTime = 0;
      const recordingStartTime = Date.now();

      if (ctx) {
        const source = ctx.createMediaStreamSource(micStream);
        micAnalyser = ctx.createAnalyser();
        micAnalyser.fftSize = 128;
        source.connect(micAnalyser);
        micDataArray = new Uint8Array(micAnalyser.frequencyBinCount);
        micLevelInterval = setInterval(() => {
          if (!micAnalyser || !micDataArray) return;
          micAnalyser.getByteFrequencyData(micDataArray);
          let sum = 0;
          for (let i = 0; i < micDataArray.length; i++) sum += micDataArray[i];
          const inputLevel = Math.min(1.0, sum / (micDataArray.length * 140));
          state.micInputLevel = inputLevel;
          notifyUpdate();

          // Continuous hands-free Voice Activity Detection in Talk Mode
          if (state.isTalkMode && state.isRecordingMic && !state.isTranscribing && !state.isChatLoading && !state.isSpeaking) {
            const now = Date.now();
            if (inputLevel > 0.08) {
              if (!speechStarted) {
                speechStarted = true;
                speechStartTime = now;
              }
              lastSpeechTime = now;
            }

            if (speechStarted) {
              const speechDuration = now - speechStartTime;
              const silenceDuration = now - lastSpeechTime;
              // If user spoke for at least 250ms and has paused for 1.2s:
              if (speechDuration > 250 && silenceDuration > 1200) {
                stopRecordingAndSend();
              } else if (now - recordingStartTime > 14000) {
                // Safety max per turn
                stopRecordingAndSend();
              }
            }
          }
        }, 60);
      }

      mediaRecorder.start();
      state.isRecordingMic = true;
      setBehavior('listening');
      creature.setEmotion('curious');
      creature.triggerAction('tilt_head');
      notifyUpdate();
      return true;
    } catch (err) {
      state.micPermission = 'denied';
      state.isRecordingMic = false;
      state.lastError =
        state.profile.language === 'ko'
          ? '마이크 권한이 거부되었거나 사용할 수 없어요. 브라우저 권한을 확인하거나 텍스트로 대화해 주세요!'
          : 'Microphone access is unavailable or denied. Mochi cannot hear right now — please check mic permissions or type below!';
      if (state.isTalkMode) {
        state.isTalkMode = false;
      }
      notifyUpdate();
      return false;
    }
  }

  function cleanupMicStream() {
    if (micLevelInterval) {
      clearInterval(micLevelInterval);
      micLevelInterval = null;
    }
    micAnalyser = null;
    state.micInputLevel = 0;
    if (micStream) {
      micStream.getTracks().forEach((t) => t.stop());
      micStream = null;
    }
  }

  async function stopRecordingAndSend() {
    if (!state.isRecordingMic || !mediaRecorder) return;

    return new Promise((resolve) => {
      mediaRecorder.onstop = async () => {
        const recordedMime = mediaRecorder?.mimeType || 'audio/webm';
        cleanupMicStream();
        state.isRecordingMic = false;

        if (micChunks.length === 0) {
          setBehavior('idle');
          notifyUpdate();
          if (state.isTalkMode) scheduleTalkResume(600);
          resolve(null);
          return;
        }

        const audioBlob = new Blob(micChunks, { type: recordedMime });
        if (audioBlob.size < 400) {
          setBehavior('idle');
          notifyUpdate();
          if (state.isTalkMode) scheduleTalkResume(600);
          resolve(null);
          return;
        }

        state.isTranscribing = true;
        notifyUpdate();

        try {
          const base64Audio = await blobToBase64(audioBlob);
          const res = await fetch('/api/stt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audioBase64: base64Audio,
              mimeType: recordedMime,
              language: state.profile.language,
              providerConfig: state.profile.providerConfig,
            }),
          });

          const data = await res.json();
          state.isTranscribing = false;

          if (!res.ok) {
            throw new Error(data.error || `STT failed (${res.status})`);
          }

          const transcript = String(data.text || '').trim();
          if (transcript) {
            await sendUserMessage(transcript, { fromVoice: true });
            resolve(transcript);
          } else {
            state.lastError =
              state.profile.language === 'ko'
                ? '목소리가 잘 들리지 않았어요. 조금 더 가까이서 말씀해 주시겠어요?'
                : 'I could not quite catch that! Could you try speaking again or typing below?';
            setBehavior('idle');
            notifyUpdate();
            if (state.isTalkMode) scheduleTalkResume(1000);
            resolve(null);
          }
        } catch (err) {
          state.isTranscribing = false;
          state.lastError = err.message || 'Voice transcription failed.';
          setBehavior('idle');
          notifyUpdate();
          if (state.isTalkMode) scheduleTalkResume(1500);
          resolve(null);
        }
      };

      try {
        mediaRecorder.stop();
      } catch {
        cleanupMicStream();
        state.isRecordingMic = false;
        notifyUpdate();
        if (state.isTalkMode) scheduleTalkResume(600);
        resolve(null);
      }
    });
  }

  async function startTalkMode() {
    state.isTalkMode = true;
    state.lastError = null;
    notifyUpdate();
    const ok = await startRecording();
    if (!ok) {
      state.isTalkMode = false;
      notifyUpdate();
    }
  }

  function stopTalkMode() {
    state.isTalkMode = false;
    if (talkModeResumeTimer) {
      clearTimeout(talkModeResumeTimer);
      talkModeResumeTimer = null;
    }
    if (state.isRecordingMic) {
      cleanupMicStream();
      state.isRecordingMic = false;
    }
    if (state.isSpeaking) {
      stopSpeaking();
    }
    setBehavior('idle');
    notifyUpdate();
  }

  async function toggleTalkMode() {
    if (state.isTalkMode) {
      stopTalkMode();
    } else {
      await startTalkMode();
    }
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = String(reader.result || '');
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // =========================================================================
  // AI CONVERSATION & CONTEXTUAL RESPONSE HANDLER
  // =========================================================================
  let idleSeconds = 0;
  let proactiveTimer = 0;
  let unsolicitedCountSinceUserReply = 0;

  async function sendUserMessage(text, options = {}) {
    const cleanText = String(text || '').trim();
    const { interactionContext = '', silentUserBubble = false } = options;
    if (!cleanText && !interactionContext) return;

    idleSeconds = 0;
    proactiveTimer = 0;
    if (cleanText && !silentUserBubble) {
      unsolicitedCountSinceUserReply = 0;
    }

    stopSpeaking();
    state.lastError = null;

    if (cleanText && !silentUserBubble) {
      state.history.push({
        id: `user-${Date.now()}`,
        role: 'user',
        text: cleanText,
        timestamp: Date.now(),
      });
    }

    state.isChatLoading = true;
    setBehavior('reacting');
    creature.setEmotion('curious');
    notifyUpdate();

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: cleanText,
          interactionContext,
          history: state.history.slice(-14),
          profile: state.profile,
          emotions: state.emotions,
          memories: state.memories,
          relationship: getRelationshipInfo(),
          providerConfig: state.profile.providerConfig,
        }),
      });

      const data = await res.json();
      state.isChatLoading = false;

      if (!res.ok) {
        throw new Error(data.error || `Chat API error (${res.status})`);
      }

      const replyText = data.reply || 'Puff~';
      const emotion = data.emotion || 'happy';
      const action = data.action || 'bounce';
      const proposedMemory = String(data.proposedMemory || '').trim();
      const affectionDelta = Number(data.affectionDelta) || 2;

      state.history.push({
        id: `pet-${Date.now()}`,
        role: 'pet',
        text: replyText,
        emotion,
        timestamp: Date.now(),
      });

      // Synchronize emotion, 3D body action, and relationship XP
      adjustEmotions(
        {
          happiness: emotion === 'sad' ? -3 : 6,
          curiosity: emotion === 'curious' ? 8 : 3,
          energy: emotion === 'sleepy' ? -4 : 4,
          affection: affectionDelta,
        },
        emotion
      );

      if (!state.profile.reducedMotion && action && action !== 'none') {
        creature.triggerAction(action);
      }

      if (!silentUserBubble) {
        addRelationshipXp(affectionDelta * 4, 'conversation');
      }

      // Queue proposed memory for user inspection/approval if novel
      if (
        proposedMemory &&
        proposedMemory.length > 4 &&
        !state.memories.some((m) => m.text.toLowerCase() === proposedMemory.toLowerCase()) &&
        !state.pendingMemories.some((m) => m.text.toLowerCase() === proposedMemory.toLowerCase())
      ) {
        state.pendingMemories.unshift({
          id: `pmem-${Date.now()}`,
          text: proposedMemory,
          createdAt: new Date().toISOString(),
        });
      }

      saveToStorage();
      notifyUpdate();

      // Speak response aloud & synchronize 3D mouth + fur
      await speakText(replyText, emotion);
    } catch (err) {
      state.isChatLoading = false;
      state.lastError = err.message || 'Unable to reach AI companion right now.';
      setBehavior('idle');
      notifyUpdate();
    }
  }

  // =========================================================================
  // AUTONOMOUS BEHAVIOR & IDLE STATE MACHINE
  // =========================================================================
  let nextAutonomousActionIn = 6.5;

  function setBehavior(nextState) {
    state.behaviorState = nextState;
    creature.setBehaviorState(nextState);
    if (nextState !== 'looking') {
      creature.setAutonomousGaze(0, 0, false);
    }
  }

  function notifyDirectTouch(type = 'pet') {
    idleSeconds = 0;
    proactiveTimer = 0;

    // Wake up if sleeping
    if (state.behaviorState === 'sleeping' || state.emotions.currentMood === 'sleepy') {
      setBehavior('reacting');
      adjustEmotions({ energy: 25, happiness: 8 }, 'happy');
      creature.triggerAction('bounce');
      const wakeMsg =
        state.profile.language === 'ko'
          ? '음냐~ 깨워줘서 고마워요! 기분 좋은 쓰다듬기네요!'
          : 'Yawn~ Prrr! That woke me right up! Your touch feels so warm!';
      showSubtitle(wakeMsg, 4500);
      return;
    }

    if (type === 'boop') {
      adjustEmotions({ happiness: 4, curiosity: 5 }, 'surprised');
      setTimeout(() => {
        if (state.emotions.currentMood === 'surprised') {
          adjustEmotions({}, 'happy');
        }
      }, 1400);
    } else if (type === 'pet') {
      creature.setPettingIntensity(0.85);
      const now = Date.now();
      if (now - state.relationship.lastPetXpTime > 8000) {
        state.relationship.lastPetXpTime = now;
        adjustEmotions({ happiness: 5, affection: 4 }, 'loving');
        addRelationshipXp(5, 'petting');
      }
    }
  }

  function update(dt) {
    // 1. Update real-time voice lip-sync amplitude
    const voiceAmp = sampleVoiceAmplitude();

    // 2. Skip autonomous idle transitions while busy
    if (
      state.isRecordingMic ||
      state.isTranscribing ||
      state.isChatLoading ||
      state.isSpeaking ||
      state.behaviorState === 'playing'
    ) {
      return { voiceAmplitude: voiceAmp };
    }

    idleSeconds += dt;
    proactiveTimer += dt;
    nextAutonomousActionIn -= dt;

    // Gradually relax energy slightly over long idle periods
    if (idleSeconds > 48 && state.behaviorState !== 'sleeping') {
      setBehavior('sleeping');
      adjustEmotions({ energy: -8 }, 'sleepy');
      if (!state.profile.reducedMotion) {
        creature.triggerAction('yawn');
      }
      const sleepyText =
        state.profile.language === 'ko'
          ? '꾸벅꾸벅... 책상이 너무 따뜻해서 졸음이 솔솔 와요... zZz'
          : 'Yawn... the warm desk candlelight is making me so cozy and sleepy... zZz';
      showSubtitle(sleepyText, 5000);
    } else if (state.behaviorState !== 'sleeping' && nextAutonomousActionIn <= 0) {
      nextAutonomousActionIn = 6.0 + Math.random() * 7.0;
      const roll = Math.random();

      if (roll < 0.38) {
        // Look curiously at a spot in the room (mug, candle, window, or viewer)
        setBehavior('looking');
        const spots = [
          [-0.45, -0.15], // Coffee mug on left
          [0.42, -0.18],  // Candle cluster on right
          [0.0, 0.35],    // Sunset window above
          [0.0, 0.0],     // Straight at viewer
        ];
        const chosen = spots[Math.floor(Math.random() * spots.length)];
        creature.setAutonomousGaze(chosen[0], chosen[1], true);
      } else if (roll < 0.68 && !state.profile.reducedMotion) {
        // Gentle desk wander / hop
        setBehavior('wandering');
        const wx = (Math.random() - 0.5) * 0.32;
        const wz = (Math.random() - 0.5) * 0.18;
        creature.setWanderTarget(wx, wz);
        creature.setAutonomousGaze(wx * 0.8, 0, true);
      } else if (!state.profile.reducedMotion) {
        // Occasional idle stretch or wiggle
        setBehavior('idle');
        creature.setWanderTarget(0, 0);
        const idleActions = ['stretch', 'wiggle', 'tilt_head'];
        const act = idleActions[Math.floor(Math.random() * idleActions.length)];
        creature.triggerAction(act);
      }
    }

    // 3. Occasional Proactive Contextual Conversation (bounded & toggleable)
    const intervalSec = Math.max(35, Number(state.profile.proactiveIntervalSec) || 60);
    if (
      state.profile.proactiveChatEnabled &&
      proactiveTimer >= intervalSec &&
      unsolicitedCountSinceUserReply < 2
    ) {
      proactiveTimer = 0;
      unsolicitedCountSinceUserReply += 1;
      const contexts = [
        'You have been hanging out quietly on the user’s cozy desk. Initiate a short, warm, contextual remark (1 sentence) checking in on them, commenting on the cozy room, or referencing one of your saved memories.',
        'Playfully wiggle your fur and ask your human friend a sweet question about how their day or project is going.',
      ];
      const ctx = contexts[unsolicitedCountSinceUserReply % contexts.length];
      sendUserMessage('', { interactionContext: ctx, silentUserBubble: true });
    }

    return { voiceAmplitude: voiceAmp };
  }

  // =========================================================================
  // MEMORY MANAGEMENT & CUSTOMIZATION HELPERS
  // =========================================================================
  function approvePendingMemory(id) {
    const idx = state.pendingMemories.findIndex((m) => m.id === id);
    if (idx === -1) return;
    const [mem] = state.pendingMemories.splice(idx, 1);
    state.memories.unshift(mem);
    addRelationshipXp(15, 'memory_approved');
    saveToStorage();
    notifyUpdate();
  }

  function dismissPendingMemory(id) {
    state.pendingMemories = state.pendingMemories.filter((m) => m.id !== id);
    saveToStorage();
    notifyUpdate();
  }

  function addCustomMemory(text) {
    const clean = String(text || '').trim().slice(0, 160);
    if (!clean) return;
    state.memories.unshift({
      id: `mem-${Date.now()}`,
      text: clean,
      createdAt: new Date().toISOString(),
    });
    addRelationshipXp(10, 'custom_memory');
    saveToStorage();
    notifyUpdate();
  }

  function deleteMemory(id) {
    state.memories = state.memories.filter((m) => m.id !== id);
    saveToStorage();
    notifyUpdate();
  }

  function clearHistory() {
    state.history = [
      {
        id: `msg-reset-${Date.now()}`,
        role: 'pet',
        text:
          state.profile.language === 'ko'
            ? '대화 기록을 깔끔하게 정리했어요! 우리 다시 이야기해요!'
            : 'Fresh chat slate! What should we talk about next?',
        emotion: 'happy',
        timestamp: Date.now(),
      },
    ];
    saveToStorage();
    notifyUpdate();
  }

  function updateProfile(partial) {
    Object.assign(state.profile, partial);
    if (partial.proactiveChatEnabled !== undefined) {
      state.profile.proactiveChatOptIn = true;
    }
    if (partial.eyeColor) {
      creature.setEyeColor(partial.eyeColor);
    }
    if (partial.accessory !== undefined) {
      creature.setAccessory(partial.accessory);
    }
    saveToStorage();
    notifyUpdate();
  }

  function updateProviderConfig(partial) {
    if (partial.geminiApiKey !== undefined) {
      state.profile.providerConfig.geminiApiKey = String(partial.geminiApiKey || '').trim();
    }
    if (partial.chat) Object.assign(state.profile.providerConfig.chat, partial.chat);
    if (partial.stt) Object.assign(state.profile.providerConfig.stt, partial.stt);
    if (partial.tts) Object.assign(state.profile.providerConfig.tts, partial.tts);
    Object.assign(state.profile.providerConfig, partial);
    saveToStorage();
    notifyUpdate();
  }

  return {
    state,
    getRelationshipInfo,
    saveToStorage,
    sendUserMessage,
    startRecording,
    stopRecordingAndSend,
    startTalkMode,
    stopTalkMode,
    toggleTalkMode,
    stopSpeaking,
    speakText,
    notifyDirectTouch,
    approvePendingMemory,
    dismissPendingMemory,
    addCustomMemory,
    deleteMemory,
    clearHistory,
    updateProfile,
    updateProviderConfig,
    update,
  };
}
