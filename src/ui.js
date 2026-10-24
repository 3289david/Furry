// Ultra-Minimal UI for Mochi-Puff Virtual Pet
// - HOME: Only 3D creature + minimal bottom chat input + discreet top-right gear icon
// - EVERYTHING ELSE is housed neatly inside the Settings Modal:
//   1. AI Models & Custom Endpoints (independent OpenAI-compatible for Chat, STT, and TTS)
//   2. Pet & Voice (Name, Personality, Voice, Language, Autonomous Chat)
//   3. Play & Mini-Games (Rock-Paper-Scissors, Friendship Quiz, 3D Tricks)
//   4. Memories & Emotions (Meters, Relationship, Saved Memories, History)
//   5. Appearance & Fur (Accessories, Eye Color, Fur Presets, Length, Density, Shading)
//   6. Scene & Engine (Cozy Desk default, Studio, Sky, AR Camera, WebGPU Fur)

import { ENVIRONMENT_PRESETS, sanitizeEnvId } from './environments.js';
import {
  EYE_COLOR_PRESETS,
  ACCESSORY_OPTIONS,
  PERSONALITY_OPTIONS,
  VOICE_OPTIONS,
} from './petBrain.js';

const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

export function clampNumber(val, min, max, fallback) {
  const num = Number(val);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, num));
}

export function sanitizeHexColor(val, fallback) {
  if (typeof val === 'string' && HEX_COLOR_REGEX.test(val.trim())) {
    return val.trim();
  }
  return fallback;
}

export const FUR_PRESETS = [
  {
    name: 'Sakura Mochi',
    baseColor: '#5e2bff',
    tipColor: '#ff9ec7',
    furLength: 0.31,
    furDensity: 0.75,
    roughness: 0.77,
    specular: 0.24,
    clumping: 0.35,
    curliness: 0.23,
  },
  {
    name: 'Golden Fluff',
    baseColor: '#7c3f14',
    tipColor: '#fde68a',
    furLength: 0.38,
    furDensity: 0.92,
    roughness: 0.77,
    specular: 0.24,
    clumping: 0.64,
    curliness: 0.58,
  },
  {
    name: 'Midnight Velvet',
    baseColor: '#131638',
    tipColor: '#67e8f9',
    furLength: 0.29,
    furDensity: 0.95,
    roughness: 0.77,
    specular: 0.24,
    clumping: 0.44,
    curliness: 0.15,
  },
  {
    name: 'Matcha Puff',
    baseColor: '#1e4631',
    tipColor: '#bbf7d0',
    furLength: 0.36,
    furDensity: 0.86,
    roughness: 0.77,
    specular: 0.24,
    clumping: 0.62,
    curliness: 0.72,
  },
];

export function createMinimalUI(container, state, onChange) {
  // Ensure legacy top bars remain completely hidden
  const legacyPageNav = document.getElementById('page-nav');
  if (legacyPageNav) legacyPageNav.style.display = 'none';
  const legacySceneNav = document.getElementById('scene-nav');
  if (legacySceneNav) legacySceneNav.style.display = 'none';
  const legacyHudHint = document.getElementById('hud-hint');
  if (legacyHudHint) legacyHudHint.style.display = 'none';

  container.replaceChildren();
  container.className = 'pet-ui-layer ultra-minimal';

  let petBrain = null;
  let isSettingsOpen = false;

  const sliderRefs = {};
  const colorRefs = {};
  const sceneButtons = {};

  // =========================================================================
  // 0. FIRST-TIME ONBOARDING SETUP WIZARD
  // =========================================================================
  const setupBackdrop = document.createElement('div');
  setupBackdrop.className = 'pet-modal-backdrop welcome-setup-backdrop hidden';

  const setupCard = document.createElement('div');
  setupCard.className = 'pet-modal-card welcome-setup-card';
  setupCard.setAttribute('role', 'dialog');
  setupCard.setAttribute('aria-label', 'First-Time Setup');

  const setupHeader = document.createElement('div');
  setupHeader.className = 'welcome-setup-header';
  setupHeader.innerHTML = `
    <div class="welcome-setup-badge">Setup</div>
    <h2 class="welcome-setup-title">Welcome to Mochi-Puff</h2>
    <p class="welcome-setup-subtitle">Configure your 3D interactive AI pet companion before getting started.</p>
  `;
  setupCard.appendChild(setupHeader);

  const setupForm = document.createElement('form');
  setupForm.className = 'welcome-setup-form';

  // Pet Name
  const setupNameRow = document.createElement('div');
  setupNameRow.className = 'form-field-row';
  const setupNameLabel = document.createElement('label');
  setupNameLabel.className = 'control-label';
  setupNameLabel.textContent = 'Creature Name';
  const setupNameInput = document.createElement('input');
  setupNameInput.type = 'text';
  setupNameInput.className = 'settings-text-input';
  setupNameInput.value = state.petName || 'Mochi-Puff';
  setupNameRow.appendChild(setupNameLabel);
  setupNameRow.appendChild(setupNameInput);
  setupForm.appendChild(setupNameRow);

  // Language Preference
  const setupLangRow = document.createElement('div');
  setupLangRow.className = 'form-field-row';
  const setupLangLabel = document.createElement('label');
  setupLangLabel.className = 'control-label';
  setupLangLabel.textContent = 'Conversation Language';
  const setupLangSelect = document.createElement('select');
  setupLangSelect.className = 'settings-select';
  setupLangSelect.innerHTML = `
    <option value="auto">Auto-Detect (English and Korean)</option>
    <option value="en">English</option>
    <option value="ko">Korean (한국어)</option>
  `;
  setupLangRow.appendChild(setupLangLabel);
  setupLangRow.appendChild(setupLangSelect);
  setupForm.appendChild(setupLangRow);

  // Personality
  const setupPersRow = document.createElement('div');
  setupPersRow.className = 'form-field-row';
  const setupPersLabel = document.createElement('label');
  setupPersLabel.className = 'control-label';
  setupPersLabel.textContent = 'Personality Tone';
  const setupPersSelect = document.createElement('select');
  setupPersSelect.className = 'settings-select';
  PERSONALITY_OPTIONS.forEach((p) => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = `${p.labelEn} / ${p.labelKo}`;
    setupPersSelect.appendChild(opt);
  });
  setupPersRow.appendChild(setupPersLabel);
  setupPersRow.appendChild(setupPersSelect);
  setupForm.appendChild(setupPersRow);

  // Google Gemini API Key
  const setupKeyRow = document.createElement('div');
  setupKeyRow.className = 'form-field-row';
  const setupKeyLabel = document.createElement('label');
  setupKeyLabel.className = 'control-label';
  setupKeyLabel.textContent = 'Google Gemini API Key';
  const setupKeyHint = document.createElement('p');
  setupKeyHint.className = 'endpoint-info-box';
  setupKeyHint.textContent = 'Enter your Gemini API key to activate voice chat, transcription, and speech responses. Your key is stored locally in your browser. You can also skip and configure in Settings later.';
  const setupKeyInput = document.createElement('input');
  setupKeyInput.type = 'password';
  setupKeyInput.className = 'settings-text-input';
  setupKeyInput.placeholder = 'AIzaSy... (paste your Gemini API key)';
  setupKeyInput.autocomplete = 'off';
  setupKeyRow.appendChild(setupKeyLabel);
  setupKeyRow.appendChild(setupKeyHint);
  setupKeyRow.appendChild(setupKeyInput);
  setupForm.appendChild(setupKeyRow);

  // Actions
  const setupActionsRow = document.createElement('div');
  setupActionsRow.className = 'welcome-setup-actions';

  const saveStartBtn = document.createElement('button');
  saveStartBtn.type = 'submit';
  saveStartBtn.className = 'welcome-primary-btn';
  saveStartBtn.textContent = 'Save and Start';

  const skipBtn = document.createElement('button');
  skipBtn.type = 'button';
  skipBtn.className = 'welcome-skip-btn';
  skipBtn.textContent = 'Skip for Now';

  function completeSetup(saveData = true) {
    if (saveData && petBrain) {
      const cleanName = setupNameInput.value.trim() || 'Mochi-Puff';
      petBrain.updateProfile({
        name: cleanName,
        language: setupLangSelect.value,
        personality: setupPersSelect.value,
      });
      if (setupKeyInput.value.trim()) {
        petBrain.updateProviderConfig({
          geminiApiKey: setupKeyInput.value.trim(),
        });
      }
    }
    localStorage.setItem('mochi_first_run_completed', 'true');
    setupBackdrop.classList.add('hidden');
  }

  setupForm.addEventListener('submit', (e) => {
    e.preventDefault();
    completeSetup(true);
  });

  skipBtn.addEventListener('click', () => {
    completeSetup(false);
  });

  setupActionsRow.appendChild(skipBtn);
  setupActionsRow.appendChild(saveStartBtn);
  setupForm.appendChild(setupActionsRow);

  setupCard.appendChild(setupForm);
  setupBackdrop.appendChild(setupCard);
  setupBackdrop.addEventListener('click', (e) => {
    if (e.target === setupBackdrop) {
      completeSetup(false);
    }
  });
  container.appendChild(setupBackdrop);

  function openWelcomeSetupModal() {
    if (petBrain) {
      setupNameInput.value = petBrain.state.profile.name || 'Mochi-Puff';
      setupLangSelect.value = petBrain.state.profile.language || 'auto';
      setupPersSelect.value = petBrain.state.profile.personality || 'playful';
      setupKeyInput.value = petBrain.state.profile.providerConfig.geminiApiKey || '';
    }
    setupBackdrop.classList.remove('hidden');
  }

  function checkFirstRunSetup() {
    // Keep home HUD immediately visible without blocking modal overlay
    localStorage.setItem('mochi_first_run_completed', 'true');
  }

  // =========================================================================
  // 1. HOME SCREEN: ONLY SINGLE TOP-RIGHT GEAR ICON BUTTON
  // =========================================================================
  const topBar = document.createElement('div');
  topBar.id = 'pet-top-bar';
  topBar.className = 'home-corner-bar';

  const settingsBtn = document.createElement('button');
  settingsBtn.type = 'button';
  settingsBtn.className = 'home-gear-btn';
  settingsBtn.setAttribute('aria-label', 'Open Settings and Controls');
  settingsBtn.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="3"></circle>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
    </svg>
    <span class="gear-label">Settings</span>
  `;
  settingsBtn.addEventListener('click', () => toggleSettingsModal(true));
  topBar.appendChild(settingsBtn);
  container.appendChild(topBar);

  // =========================================================================
  // 2. HOME SCREEN: LIVE VOICE SUBTITLE BUBBLE (APPEARS ONLY WHEN SPEAKING)
  // =========================================================================
  const subtitleWrap = document.createElement('div');
  subtitleWrap.id = 'voice-subtitle-wrap';
  subtitleWrap.className = 'voice-subtitle-wrap hidden';
  subtitleWrap.setAttribute('aria-live', 'polite');

  const subtitleTextEl = document.createElement('p');
  subtitleTextEl.className = 'voice-subtitle-text';

  const stopSpeakBtn = document.createElement('button');
  stopSpeakBtn.type = 'button';
  stopSpeakBtn.className = 'subtitle-stop-btn';
  stopSpeakBtn.textContent = 'Stop';
  stopSpeakBtn.setAttribute('aria-label', 'Stop speaking');
  stopSpeakBtn.addEventListener('click', () => {
    if (petBrain) petBrain.stopSpeaking();
    subtitleWrap.classList.add('hidden');
  });

  subtitleWrap.appendChild(subtitleTextEl);
  subtitleWrap.appendChild(stopSpeakBtn);
  container.appendChild(subtitleWrap);

  // =========================================================================
  // 3. HOME SCREEN: ULTRA-MINIMAL CHAT INPUT BAR (ENTER TO SEND)
  // =========================================================================
  const chatDock = document.createElement('section');
  chatDock.id = 'chat-dock';
  chatDock.className = 'chat-dock';
  chatDock.setAttribute('aria-label', 'AI Pet Chat Input');

  // Error Banner
  const errorBanner = document.createElement('div');
  errorBanner.className = 'chat-error-banner hidden';
  const errorBannerText = document.createElement('span');
  const errorBannerClose = document.createElement('button');
  errorBannerClose.type = 'button';
  errorBannerClose.className = 'chat-mini-btn';
  errorBannerClose.textContent = 'Dismiss';
  errorBannerClose.addEventListener('click', () => {
    if (petBrain) petBrain.state.lastError = null;
    errorBanner.classList.add('hidden');
  });
  errorBanner.appendChild(errorBannerText);
  errorBanner.appendChild(errorBannerClose);
  chatDock.appendChild(errorBanner);

  // Home Screen Input Row: (Push-to-Talk Mic | Text Input [Press Enter to Send])
  // No Send button, no chat history drawer on home view!
  const chatInputBar = document.createElement('form');
  chatInputBar.className = 'chat-input-bar';
  chatInputBar.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!petBrain || petBrain.state.isChatLoading) return;
    const val = chatInput.value.trim();
    if (!val) return;
    chatInput.value = '';
    petBrain.sendUserMessage(val);
  });

  const micBtn = document.createElement('button');
  micBtn.type = 'button';
  micBtn.className = 'dock-mic-btn';
  micBtn.setAttribute('aria-label', 'Talk with voice');
  micBtn.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
      <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
      <line x1="12" x2="12" y1="19" y2="22"></line>
    </svg>
    <span>Talk</span>
  `;

  micBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    if (!petBrain) return;
    if (petBrain.state.isTalkMode) {
      petBrain.stopTalkMode();
    } else {
      await petBrain.startTalkMode();
    }
  });

  const chatInput = document.createElement('input');
  chatInput.type = 'text';
  chatInput.className = 'chat-text-input';
  chatInput.placeholder = 'Type a message and press Enter...';
  chatInput.setAttribute('aria-label', 'Message to Mochi-Puff (Press Enter to send)');
  chatInput.setAttribute('enterkeyhint', 'send');
  chatInput.autocomplete = 'off';

  // Explicitly trigger submit on Enter
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      chatInputBar.requestSubmit();
    }
  });

  chatInputBar.appendChild(micBtn);
  chatInputBar.appendChild(chatInput);
  chatDock.appendChild(chatInputBar);
  container.appendChild(chatDock);

  // =========================================================================
  // 4. COMPREHENSIVE SETTINGS MODAL (HOUSES ALL CONTROLS & CHAT HISTORY!)
  // =========================================================================
  const modalBackdrop = document.createElement('div');
  modalBackdrop.className = 'pet-modal-backdrop hidden';
  modalBackdrop.addEventListener('click', (e) => {
    if (e.target === modalBackdrop) {
      toggleSettingsModal(false);
    }
  });

  const settingsModal = document.createElement('div');
  settingsModal.className = 'pet-modal-card';
  settingsModal.setAttribute('role', 'dialog');
  settingsModal.setAttribute('aria-label', 'Settings');

  const settingsHeader = document.createElement('div');
  settingsHeader.className = 'pet-modal-header';

  const settingsTitle = document.createElement('div');
  settingsTitle.className = 'pet-modal-title';
  settingsTitle.textContent = 'Settings & Controls';

  const settingsClose = document.createElement('button');
  settingsClose.type = 'button';
  settingsClose.className = 'pet-modal-close';
  settingsClose.textContent = 'Done';
  settingsClose.addEventListener('click', () => toggleSettingsModal(false));

  settingsHeader.appendChild(settingsTitle);
  settingsHeader.appendChild(settingsClose);
  settingsModal.appendChild(settingsHeader);

  // Tab navigation inside Settings Modal
  const tabBar = document.createElement('div');
  tabBar.className = 'settings-tab-bar';
  const tabs = [
    { id: 'history', label: 'Chat History' },
    { id: 'ai', label: 'AI Endpoints' },
    { id: 'pet', label: 'Pet & Voice' },
    { id: 'play', label: 'Pet Tricks' },
    { id: 'memories', label: 'Memories' },
    { id: 'appearance', label: 'Appearance' },
    { id: 'scene', label: 'Scene' },
  ];

  const tabPanes = {};
  const tabBtns = {};
  const settingsBody = document.createElement('div');
  settingsBody.className = 'pet-modal-body';

  tabs.forEach((t, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `settings-tab-btn ${idx === 0 ? 'active' : ''}`;
    btn.textContent = t.label;
    btn.addEventListener('click', () => {
      Object.keys(tabBtns).forEach((k) => {
        tabBtns[k].classList.toggle('active', k === t.id);
        tabPanes[k].classList.toggle('hidden', k !== t.id);
      });
      if (t.id === 'history' && petBrain) {
        renderChatHistoryInTab();
      }
      if (t.id === 'memories' && petBrain) {
        renderMemoriesTab();
      }
    });
    tabBtns[t.id] = btn;
    tabBar.appendChild(btn);

    const pane = document.createElement('div');
    pane.className = `settings-tab-pane ${idx === 0 ? '' : 'hidden'}`;
    tabPanes[t.id] = pane;
    settingsBody.appendChild(pane);
  });

  settingsModal.appendChild(tabBar);
  settingsModal.appendChild(settingsBody);
  modalBackdrop.appendChild(settingsModal);
  container.appendChild(modalBackdrop);

  function toggleSettingsModal(open) {
    isSettingsOpen = Boolean(open);
    modalBackdrop.classList.toggle('hidden', !isSettingsOpen);
    if (isSettingsOpen && petBrain) {
      renderChatHistoryInTab();
      renderMemoriesTab();
    }
  }

  // -------------------------------------------------------------------------
  // TAB 0: CHAT HISTORY (INSIDE SETTINGS MODAL)
  // -------------------------------------------------------------------------
  const historyPane = tabPanes.history;

  const historyHeaderRow = document.createElement('div');
  historyHeaderRow.className = 'chat-history-modal-header';

  const historyTitle = document.createElement('div');
  historyTitle.className = 'ui-section-title';
  historyTitle.style.marginBottom = '0';
  historyTitle.textContent = 'Conversation History';

  const clearChatBtn = document.createElement('button');
  clearChatBtn.type = 'button';
  clearChatBtn.className = 'chat-mini-btn';
  clearChatBtn.textContent = 'Clear All';
  clearChatBtn.addEventListener('click', () => {
    if (petBrain) {
      petBrain.clearHistory();
      renderChatHistoryInTab();
    }
  });

  historyHeaderRow.appendChild(historyTitle);
  historyHeaderRow.appendChild(clearChatBtn);
  historyPane.appendChild(historyHeaderRow);

  const chatMessagesList = document.createElement('div');
  chatMessagesList.className = 'chat-messages-list in-modal';
  historyPane.appendChild(chatMessagesList);

  function renderChatHistoryInTab() {
    if (!petBrain) return;
    const history = petBrain.state.history || [];
    historyTitle.textContent = `Conversation History (${history.length})`;
    chatMessagesList.replaceChildren();

    if (history.length === 0) {
      const emptyHint = document.createElement('div');
      emptyHint.className = 'chat-empty-hint';
      emptyHint.innerHTML = `
        <div class="empty-icon">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
        </div>
        <div class="empty-title">No conversation history yet</div>
        <div class="empty-desc">
          Type a message in the input box on the home screen and press <strong>Enter</strong> to chat.
        </div>
      `;
      chatMessagesList.appendChild(emptyHint);
      return;
    }

    history.forEach((msg) => {
      const bubble = document.createElement('div');
      bubble.className = `chat-bubble ${msg.role === 'user' ? 'user' : 'pet'}`;

      const roleBadge = document.createElement('div');
      roleBadge.className = 'chat-bubble-role';
      roleBadge.textContent = msg.role === 'user' ? 'You' : (petBrain.state.profile.name || 'Mochi-Puff');
      bubble.appendChild(roleBadge);

      const textP = document.createElement('div');
      textP.className = 'chat-bubble-text';
      textP.textContent = msg.text;
      bubble.appendChild(textP);

      chatMessagesList.appendChild(bubble);
    });

    if (petBrain.state.isChatLoading) {
      const loadingBubble = document.createElement('div');
      loadingBubble.className = 'chat-bubble pet loading';
      loadingBubble.textContent = `${petBrain.state.profile.name || 'Mochi-Puff'} is thinking...`;
      chatMessagesList.appendChild(loadingBubble);
    }
    chatMessagesList.scrollTop = chatMessagesList.scrollHeight;
  }

  function addSlider(parent, key, labelText, min, max, step, formatFn) {
    const initialVal = clampNumber(state[key], min, max, min);
    state[key] = initialVal;
    const row = document.createElement('div');
    row.className = 'control-row';
    const labelRow = document.createElement('div');
    labelRow.className = 'control-label-row';
    const lbl = document.createElement('span');
    lbl.className = 'control-label';
    lbl.textContent = labelText;
    const valSpan = document.createElement('span');
    valSpan.className = 'control-val';
    valSpan.textContent = formatFn(initialVal);
    labelRow.appendChild(lbl);
    labelRow.appendChild(valSpan);

    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(initialVal);
    input.setAttribute('aria-label', labelText);
    input.addEventListener('input', () => {
      const sanitized = clampNumber(input.value, min, max, state[key]);
      state[key] = sanitized;
      valSpan.textContent = formatFn(sanitized);
      onChange(key, sanitized);
      if (petBrain) petBrain.saveToStorage();
    });
    row.appendChild(labelRow);
    row.appendChild(input);
    parent.appendChild(row);
    sliderRefs[key] = { input, valSpan, formatFn, min, max };
  }

  function addColorPicker(parentGrid, key, labelText) {
    const cell = document.createElement('label');
    cell.className = 'color-cell';
    const span = document.createElement('span');
    span.textContent = labelText;
    const picker = document.createElement('input');
    picker.type = 'color';
    picker.value = sanitizeHexColor(state[key], '#ff9ec7');
    picker.addEventListener('input', () => {
      const safeColor = sanitizeHexColor(picker.value, state[key]);
      state[key] = safeColor;
      onChange(key, safeColor);
      if (petBrain) petBrain.saveToStorage();
    });
    cell.appendChild(span);
    cell.appendChild(picker);
    parentGrid.appendChild(cell);
    colorRefs[key] = picker;
  }

  // -------------------------------------------------------------------------
  // TAB 1: INDEPENDENT OPENAI-COMPATIBLE CUSTOM ENDPOINTS & GEMINI API KEY
  // -------------------------------------------------------------------------
  const aiPane = tabPanes.ai;

  // Primary Gemini API Key Card (Default Models)
  const geminiMasterBlock = document.createElement('div');
  geminiMasterBlock.className = 'ai-service-block gemini-primary-block';

  const geminiTitle = document.createElement('div');
  geminiTitle.className = 'ui-section-title';
  geminiTitle.textContent = 'Google Gemini API Key (Default Models)';
  geminiMasterBlock.appendChild(geminiTitle);

  const geminiInfo = document.createElement('p');
  geminiInfo.className = 'endpoint-info-box';
  geminiInfo.innerHTML = `
    Type or paste your Google Gemini API key below to power Mochi-Puff's default models:
    <br/>• <strong>Chat LLM:</strong> gemini-3.1-flash-lite / gemini-2.5-flash-lite
    <br/>• <strong>Speech-to-Text:</strong> gemini-3.5-transcribe
    <br/>• <strong>Voice Synthesis:</strong> gemini-3.8-flash-lite-tts
    <br/><span style="color: var(--text-muted); font-size: 11px;">Saved securely in your browser's local storage.</span>
  `;
  geminiMasterBlock.appendChild(geminiInfo);

  const geminiKeyRow = document.createElement('div');
  geminiKeyRow.className = 'form-field-row';
  const geminiKeyLabel = document.createElement('label');
  geminiKeyLabel.className = 'control-label';
  geminiKeyLabel.textContent = 'Gemini API Key';

  const geminiKeyInputWrap = document.createElement('div');
  geminiKeyInputWrap.className = 'inline-input-row';

  const geminiKeyInput = document.createElement('input');
  geminiKeyInput.type = 'password';
  geminiKeyInput.className = 'settings-text-input';
  geminiKeyInput.placeholder = 'AIzaSy... (paste your Gemini API key)';
  geminiKeyInput.autocomplete = 'off';

  const toggleKeyViewBtn = document.createElement('button');
  toggleKeyViewBtn.type = 'button';
  toggleKeyViewBtn.className = 'chat-mini-btn';
  toggleKeyViewBtn.textContent = 'Show';
  toggleKeyViewBtn.addEventListener('click', () => {
    const isPass = geminiKeyInput.type === 'password';
    geminiKeyInput.type = isPass ? 'text' : 'password';
    toggleKeyViewBtn.textContent = isPass ? 'Hide' : 'Show';
  });

  geminiKeyInputWrap.appendChild(geminiKeyInput);
  geminiKeyInputWrap.appendChild(toggleKeyViewBtn);

  geminiKeyRow.appendChild(geminiKeyLabel);
  geminiKeyRow.appendChild(geminiKeyInputWrap);
  geminiMasterBlock.appendChild(geminiKeyRow);

  geminiKeyInput.addEventListener('input', () => {
    if (!petBrain) return;
    petBrain.updateProviderConfig({
      geminiApiKey: geminiKeyInput.value.trim(),
    });
  });

  aiPane.appendChild(geminiMasterBlock);

  function syncGeminiKeyUI() {
    if (!petBrain) return;
    const key = petBrain.state.profile.providerConfig.geminiApiKey || '';
    if (geminiKeyInput.value !== key) {
      geminiKeyInput.value = key;
    }
  }

  function buildAiServiceSection(title, serviceKey, defaultModel, defaultEndpoint) {
    const sec = document.createElement('div');
    sec.className = 'ai-service-block';

    const h = document.createElement('div');
    h.className = 'ui-section-title';
    h.textContent = title;
    sec.appendChild(h);

    const provRow = document.createElement('div');
    provRow.className = 'form-field-row';
    const provSelect = document.createElement('select');
    provSelect.className = 'settings-select';
    provSelect.innerHTML = `
      <option value="gemini">Google Gemini API (${defaultModel})</option>
      <option value="openai-compatible">Custom OpenAI-Compatible Endpoint</option>
    `;
    provRow.appendChild(provSelect);
    sec.appendChild(provRow);

    const customFields = document.createElement('div');
    customFields.className = 'custom-endpoint-fields hidden';

    const urlRow = document.createElement('div');
    urlRow.className = 'form-field-row';
    const urlLabel = document.createElement('label');
    urlLabel.className = 'control-label';
    urlLabel.textContent = 'Base URL / Endpoint';
    const urlInput = document.createElement('input');
    urlInput.type = 'text';
    urlInput.className = 'settings-text-input';
    urlInput.placeholder = defaultEndpoint;
    urlRow.appendChild(urlLabel);
    urlRow.appendChild(urlInput);
    customFields.appendChild(urlRow);

    const modelRow = document.createElement('div');
    modelRow.className = 'form-field-row';
    const modelLabel = document.createElement('label');
    modelLabel.className = 'control-label';
    modelLabel.textContent = 'Model Name';
    const modelInput = document.createElement('input');
    modelInput.type = 'text';
    modelInput.className = 'settings-text-input';
    modelInput.placeholder = 'e.g. gpt-4o-mini, whisper-1, tts-1';
    modelRow.appendChild(modelLabel);
    modelRow.appendChild(modelInput);
    customFields.appendChild(modelRow);

    const keyRow = document.createElement('div');
    keyRow.className = 'form-field-row';
    const keyLabel = document.createElement('label');
    keyLabel.className = 'control-label';
    keyLabel.textContent = 'API Key / Token (Optional for local Ollama/LM Studio)';
    const keyInput = document.createElement('input');
    keyInput.type = 'password';
    keyInput.className = 'settings-text-input';
    keyInput.placeholder = 'sk-... (leave empty if using server .env)';
    keyRow.appendChild(keyLabel);
    keyRow.appendChild(keyInput);
    customFields.appendChild(keyRow);

    sec.appendChild(customFields);

    function syncState() {
      if (!petBrain) return;
      const conf = petBrain.state.profile.providerConfig[serviceKey] || {};
      provSelect.value = conf.provider || 'gemini';
      customFields.classList.toggle('hidden', provSelect.value !== 'openai-compatible');
      urlInput.value = conf.baseUrl || '';
      modelInput.value = conf.model || '';
      keyInput.value = conf.apiKey || '';
    }

    function saveState() {
      if (!petBrain) return;
      petBrain.updateProviderConfig({
        [serviceKey]: {
          provider: provSelect.value,
          baseUrl: urlInput.value.trim(),
          model: modelInput.value.trim(),
          apiKey: keyInput.value.trim(),
        },
      });
    }

    provSelect.addEventListener('change', () => {
      customFields.classList.toggle('hidden', provSelect.value !== 'openai-compatible');
      saveState();
    });
    urlInput.addEventListener('input', saveState);
    modelInput.addEventListener('input', saveState);
    keyInput.addEventListener('input', saveState);

    aiPane.appendChild(sec);
    return syncState;
  }

  const syncChatAi = buildAiServiceSection(
    '1. Text LLM API (Chat & Personality)',
    'chat',
    'gemini-3.1-flash-lite / gemini-2.5-flash-lite',
    'https://api.openai.com/v1 or http://localhost:11434/v1'
  );
  const syncSttAi = buildAiServiceSection(
    '2. STT API (Audio Transcription)',
    'stt',
    'gemini-3.5-transcribe',
    'https://api.openai.com/v1 or http://localhost:11434/v1'
  );
  const syncTtsAi = buildAiServiceSection(
    '3. TTS API (Voice Speech Output)',
    'tts',
    'gemini-3.8-flash-lite-tts',
    'https://api.openai.com/v1 or http://localhost:8000/v1'
  );

  // -------------------------------------------------------------------------
  // TAB 2: PET & VOICE
  // -------------------------------------------------------------------------
  const petPane = tabPanes.pet;

  const nameRow = document.createElement('div');
  nameRow.className = 'form-field-row';
  const nameLabel = document.createElement('label');
  nameLabel.className = 'control-label';
  nameLabel.textContent = 'Pet Name';
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.className = 'settings-text-input';
  nameInput.value = 'Mochi-Puff';
  nameInput.addEventListener('input', () => {
    if (petBrain) petBrain.updateProfile({ name: nameInput.value.trim() || 'Mochi-Puff' });
  });
  nameRow.appendChild(nameLabel);
  nameRow.appendChild(nameInput);
  petPane.appendChild(nameRow);

  const personaRow = document.createElement('div');
  personaRow.className = 'form-field-row';
  const personaLabel = document.createElement('label');
  personaLabel.className = 'control-label';
  personaLabel.textContent = 'Personality';
  const personaSelect = document.createElement('select');
  personaSelect.className = 'settings-select';
  PERSONALITY_OPTIONS.forEach((p) => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = `${p.labelEn} · ${p.labelKo}`;
    personaSelect.appendChild(opt);
  });
  personaSelect.addEventListener('change', () => {
    if (petBrain) petBrain.updateProfile({ personality: personaSelect.value });
  });
  personaRow.appendChild(personaLabel);
  personaRow.appendChild(personaSelect);
  petPane.appendChild(personaRow);

  const langRow = document.createElement('div');
  langRow.className = 'form-field-row';
  const langLabel = document.createElement('label');
  langLabel.className = 'control-label';
  langLabel.textContent = 'Spoken Language';
  const langSelect = document.createElement('select');
  langSelect.className = 'settings-select';
  [
    { id: 'auto', label: 'Auto-Detect (English & 한국어)' },
    { id: 'en', label: 'English' },
    { id: 'ko', label: '한국어 (Korean)' },
  ].forEach((l) => {
    const opt = document.createElement('option');
    opt.value = l.id;
    opt.textContent = l.label;
    langSelect.appendChild(opt);
  });
  langSelect.addEventListener('change', () => {
    if (petBrain) petBrain.updateProfile({ language: langSelect.value });
  });
  langRow.appendChild(langLabel);
  langRow.appendChild(langSelect);
  petPane.appendChild(langRow);

  const voiceRow = document.createElement('div');
  voiceRow.className = 'form-field-row';
  const voiceLabel = document.createElement('label');
  voiceLabel.className = 'control-label';
  voiceLabel.textContent = 'Gemini Voice (gemini-3.8-flash-lite-tts)';
  const voiceSelect = document.createElement('select');
  voiceSelect.className = 'settings-select';
  VOICE_OPTIONS.forEach((v) => {
    const opt = document.createElement('option');
    opt.value = v.id;
    opt.textContent = v.label;
    voiceSelect.appendChild(opt);
  });
  voiceSelect.addEventListener('change', () => {
    if (petBrain) petBrain.updateProfile({ voiceName: voiceSelect.value });
  });
  voiceRow.appendChild(voiceLabel);
  voiceRow.appendChild(voiceSelect);
  petPane.appendChild(voiceRow);

  const voiceToggles = document.createElement('div');
  voiceToggles.className = 'preset-grid';
  voiceToggles.style.marginTop = '10px';

  const muteBtn = document.createElement('button');
  muteBtn.type = 'button';
  muteBtn.className = 'action-btn active';
  muteBtn.textContent = 'Voice Speech: ON';
  muteBtn.addEventListener('click', () => {
    if (!petBrain) return;
    const nextMuted = !petBrain.state.profile.voiceMuted;
    petBrain.updateProfile({ voiceMuted: nextMuted });
    muteBtn.textContent = nextMuted ? 'Voice Speech: MUTED' : 'Voice Speech: ON';
    muteBtn.classList.toggle('active', !nextMuted);
    if (nextMuted) petBrain.stopSpeaking();
  });

  const proactiveBtn = document.createElement('button');
  proactiveBtn.type = 'button';
  proactiveBtn.className = 'action-btn active';
  proactiveBtn.textContent = 'Spontaneous Chat: ON';
  proactiveBtn.addEventListener('click', () => {
    if (!petBrain) return;
    const next = !petBrain.state.profile.proactiveChatEnabled;
    petBrain.updateProfile({ proactiveChatEnabled: next });
    proactiveBtn.textContent = next ? 'Spontaneous Chat: ON' : 'Spontaneous Chat: OFF';
    proactiveBtn.classList.toggle('active', next);
  });

  voiceToggles.appendChild(muteBtn);
  voiceToggles.appendChild(proactiveBtn);
  petPane.appendChild(voiceToggles);

  // First-time setup wizard trigger
  const wizardRow = document.createElement('div');
  wizardRow.style.marginTop = '18px';
  wizardRow.style.paddingTop = '14px';
  wizardRow.style.borderTop = '1px solid var(--glass-border)';
  const rerunWizardBtn = document.createElement('button');
  rerunWizardBtn.type = 'button';
  rerunWizardBtn.className = 'welcome-skip-btn';
  rerunWizardBtn.style.width = '100%';
  rerunWizardBtn.textContent = 'Rerun First-Time Setup Wizard';
  rerunWizardBtn.addEventListener('click', () => {
    toggleSettingsModal(false);
    openWelcomeSetupModal();
  });
  wizardRow.appendChild(rerunWizardBtn);
  petPane.appendChild(wizardRow);

  // -------------------------------------------------------------------------
  // TAB 3: PET TRICKS & 3D ACTIONS
  // -------------------------------------------------------------------------
  const playPane = tabPanes.play;

  const tricksTitle = document.createElement('div');
  tricksTitle.className = 'ui-section-title';
  tricksTitle.textContent = '3D Creature Tricks & Gestures';
  playPane.appendChild(tricksTitle);

  const tricksDesc = document.createElement('p');
  tricksDesc.className = 'endpoint-info-box';
  tricksDesc.textContent = 'Tap any trick to trigger a real-time 3D animation, facial expression, and dynamic fur physics wave!';
  playPane.appendChild(tricksDesc);

  const tricksGrid = document.createElement('div');
  tricksGrid.className = 'preset-grid';
  [
    { label: 'Happy Bounce', action: 'bounce', emotion: 'excited' },
    { label: 'Big Stretch', action: 'stretch', emotion: 'happy' },
    { label: 'Fur Shimmy Wiggle', action: 'wiggle', emotion: 'loving' },
    { label: 'Floof Puff Up', action: 'puff_fur', emotion: 'surprised' },
    { label: 'Curious Head Tilt', action: 'tilt_head', emotion: 'curious' },
    { label: 'Cozy Yawn', action: 'yawn', emotion: 'sleepy' },
  ].forEach((tr) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'preset-btn';
    b.textContent = tr.label;
    b.addEventListener('click', () => {
      onChange('triggerTrick', tr);
      b.classList.add('active');
      setTimeout(() => b.classList.remove('active'), 900);
      subtitleTextEl.textContent = `${state.petName || 'Mochi-Puff'} does ${tr.label}!`;
      subtitleWrap.classList.remove('hidden');
      setTimeout(() => {
        if (!petBrain || !petBrain.state.isSpeaking) {
          subtitleWrap.classList.add('hidden');
        }
      }, 2600);
    });
    tricksGrid.appendChild(b);
  });
  playPane.appendChild(tricksGrid);

  // -------------------------------------------------------------------------
  // TAB 4: MEMORIES & EMOTIONAL METERS
  // -------------------------------------------------------------------------
  const memoriesPane = tabPanes.memories;

  function renderMemoriesTab() {
    if (!petBrain) return;
    memoriesPane.replaceChildren();
    const s = petBrain.state;
    const rel = petBrain.getRelationshipInfo();

    const statsTitle = document.createElement('div');
    statsTitle.className = 'ui-section-title';
    statsTitle.textContent = `Relationship: Level ${rel.level} (${rel.title}) · ${rel.xp} XP`;
    memoriesPane.appendChild(statsTitle);

    const metersGrid = document.createElement('div');
    metersGrid.className = 'emotion-meters-grid';
    [
      { label: 'Happiness', val: s.emotions.happiness, color: '#f472b6' },
      { label: 'Curiosity', val: s.emotions.curiosity, color: '#38bdf8' },
      { label: 'Energy', val: s.emotions.energy, color: '#4ade80' },
      { label: 'Affection', val: s.emotions.affection, color: '#fbbf24' },
    ].forEach((m) => {
      const card = document.createElement('div');
      card.className = 'emotion-meter-card';
      const top = document.createElement('div');
      top.className = 'control-label-row';
      const l = document.createElement('span');
      l.textContent = m.label;
      const v = document.createElement('span');
      v.className = 'control-val';
      v.textContent = `${Math.round(m.val)}%`;
      top.appendChild(l);
      top.appendChild(v);

      const bar = document.createElement('div');
      bar.className = 'pet-xp-track';
      const fill = document.createElement('div');
      fill.className = 'pet-xp-fill';
      fill.style.width = `${Math.round(m.val)}%`;
      fill.style.background = m.color;
      bar.appendChild(fill);

      card.appendChild(top);
      card.appendChild(bar);
      metersGrid.appendChild(card);
    });
    memoriesPane.appendChild(metersGrid);

    // Add Memory Form
    const addMemForm = document.createElement('form');
    addMemForm.className = 'inline-input-row';
    addMemForm.style.marginTop = '14px';
    const addMemInput = document.createElement('input');
    addMemInput.type = 'text';
    addMemInput.className = 'settings-text-input';
    addMemInput.placeholder = 'Add a memory for Mochi to remember...';
    const addMemBtn = document.createElement('button');
    addMemBtn.type = 'submit';
    addMemBtn.className = 'action-btn';
    addMemBtn.style.flex = '0 0 auto';
    addMemBtn.textContent = 'Save';
    addMemForm.appendChild(addMemInput);
    addMemForm.appendChild(addMemBtn);
    addMemForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!addMemInput.value.trim()) return;
      petBrain.addCustomMemory(addMemInput.value.trim());
      addMemInput.value = '';
      renderMemoriesTab();
    });
    memoriesPane.appendChild(addMemForm);

    const memListTitle = document.createElement('div');
    memListTitle.className = 'ui-section-title';
    memListTitle.style.marginTop = '14px';
    memListTitle.textContent = `Saved Memories (${s.memories.length})`;
    memoriesPane.appendChild(memListTitle);

    const memList = document.createElement('div');
    memList.className = 'memories-list';
    s.memories.forEach((m) => {
      const row = document.createElement('div');
      row.className = 'memory-item-row';
      const txt = document.createElement('span');
      txt.className = 'memory-item-text';
      txt.textContent = m.text;
      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'chat-mini-btn';
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', () => {
        petBrain.deleteMemory(m.id);
        renderMemoriesTab();
      });
      row.appendChild(txt);
      row.appendChild(delBtn);
      memList.appendChild(row);
    });
    memoriesPane.appendChild(memList);
  }

  // -------------------------------------------------------------------------
  // TAB 5: APPEARANCE & FUR
  // -------------------------------------------------------------------------
  const appearancePane = tabPanes.appearance;

  const accTitle = document.createElement('div');
  accTitle.className = 'ui-section-title';
  accTitle.textContent = '3D Accessories';
  appearancePane.appendChild(accTitle);

  const accGrid = document.createElement('div');
  accGrid.className = 'preset-grid';
  const accButtons = {};
  ACCESSORY_OPTIONS.forEach((acc) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'preset-btn';
    btn.textContent = `${acc.labelEn} / ${acc.labelKo}`;
    if ((state.accessory || 'none') === acc.id) {
      btn.classList.add('active');
    }
    btn.addEventListener('click', () => {
      state.accessory = acc.id;
      onChange('accessory', acc.id);
      if (petBrain) petBrain.updateProfile({ accessory: acc.id });
      Object.keys(accButtons).forEach((k) => accButtons[k].classList.toggle('active', k === acc.id));
    });
    accButtons[acc.id] = btn;
    accGrid.appendChild(btn);
  });
  appearancePane.appendChild(accGrid);

  const eyeTitle = document.createElement('div');
  eyeTitle.className = 'ui-section-title';
  eyeTitle.style.marginTop = '12px';
  eyeTitle.textContent = 'Eye Iris Color';
  appearancePane.appendChild(eyeTitle);

  const eyeRow = document.createElement('div');
  eyeRow.className = 'eye-swatch-row';
  const eyeButtons = {};
  EYE_COLOR_PRESETS.forEach((ep) => {
    const sw = document.createElement('button');
    sw.type = 'button';
    sw.className = 'eye-swatch-btn';
    sw.title = ep.name;
    sw.style.background = ep.color;
    if ((state.eyeColor || '#3d285c').toLowerCase() === ep.color.toLowerCase()) {
      sw.classList.add('active');
    }
    sw.addEventListener('click', () => {
      state.eyeColor = ep.color;
      onChange('eyeColor', ep.color);
      if (petBrain) petBrain.updateProfile({ eyeColor: ep.color });
      Object.keys(eyeButtons).forEach((k) => eyeButtons[k].classList.toggle('active', k.toLowerCase() === ep.color.toLowerCase()));
    });
    eyeButtons[ep.color] = sw;
    eyeRow.appendChild(sw);
  });
  appearancePane.appendChild(eyeRow);

  const furPresetTitle = document.createElement('div');
  furPresetTitle.className = 'ui-section-title';
  furPresetTitle.style.marginTop = '12px';
  furPresetTitle.textContent = 'Coat Color & Fur Physics';
  appearancePane.appendChild(furPresetTitle);

  const presetGrid = document.createElement('div');
  presetGrid.className = 'preset-grid';
  for (const preset of FUR_PRESETS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'preset-btn';
    btn.textContent = preset.name;
    btn.addEventListener('click', () => {
      Object.keys(preset).forEach((k) => {
        if (k === 'name') return;
        state[k] = preset[k];
        if (sliderRefs[k]) {
          sliderRefs[k].input.value = String(preset[k]);
          sliderRefs[k].valSpan.textContent = sliderRefs[k].formatFn(preset[k]);
        }
        if (colorRefs[k]) {
          colorRefs[k].value = preset[k];
        }
        onChange(k, preset[k]);
      });
      if (petBrain) petBrain.saveToStorage();
    });
    presetGrid.appendChild(btn);
  }
  appearancePane.appendChild(presetGrid);

  const colorGrid = document.createElement('div');
  colorGrid.className = 'color-grid';
  colorGrid.style.marginTop = '8px';
  addColorPicker(colorGrid, 'baseColor', 'Root Color');
  addColorPicker(colorGrid, 'tipColor', 'Tip Color');
  appearancePane.appendChild(colorGrid);

  addSlider(appearancePane, 'furLength', 'Fur Length', 0.06, 0.62, 0.01, (v) => `${(v * 2.0).toFixed(2)}"`);
  addSlider(
    appearancePane,
    'furDensity',
    'Fur Density',
    0.12,
    1.0,
    0.01,
    (v) => (state.gpuFurEnabled ? `${Math.round(v * 100)}% (${Math.round(v * 60)}k)` : `${Math.round(v * 100)}% (WebGL)`)
  );
  addSlider(appearancePane, 'curliness', 'Curliness', 0.0, 1.0, 0.01, (v) => `${Math.round(v * 100)}%`);
  addSlider(appearancePane, 'clumping', 'Clumping', 0.0, 1.0, 0.01, (v) => `${Math.round(v * 100)}%`);

  // -------------------------------------------------------------------------
  // TAB 6: SCENE & ENGINE
  // -------------------------------------------------------------------------
  const scenePane = tabPanes.scene;

  const sceneTitle = document.createElement('div');
  sceneTitle.className = 'ui-section-title';
  sceneTitle.textContent = 'Background Scene (Cozy Desk Default)';
  scenePane.appendChild(sceneTitle);

  const sceneGrid = document.createElement('div');
  sceneGrid.className = 'preset-grid';
  for (const env of ENVIRONMENT_PRESETS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'preset-btn';
    if ((state.environment || 'highrise') === env.id) btn.classList.add('active');
    btn.textContent = `${env.name} · ${env.subtitle}`;
    btn.addEventListener('click', () => {
      const safeEnv = sanitizeEnvId(env.id, 'highrise');
      state.environment = safeEnv;
      updateEnvSelectionUI(safeEnv);
      onChange('environment', safeEnv);
      if (petBrain) petBrain.saveToStorage();
    });
    sceneButtons[env.id] = btn;
    sceneGrid.appendChild(btn);
  }
  scenePane.appendChild(sceneGrid);

  const engineModeRow = document.createElement('div');
  engineModeRow.className = 'dpr-selector-row engine-mode-row';
  engineModeRow.style.marginTop = '12px';
  const gpuFurModeBtn = document.createElement('button');
  gpuFurModeBtn.type = 'button';
  gpuFurModeBtn.className = 'dpr-pill-btn engine-mode-btn';
  gpuFurModeBtn.textContent = 'WebGPU Fur (Default)';
  const webglModeBtn = document.createElement('button');
  webglModeBtn.type = 'button';
  webglModeBtn.className = 'dpr-pill-btn engine-mode-btn';
  webglModeBtn.textContent = 'WebGL Mode';
  engineModeRow.appendChild(gpuFurModeBtn);
  engineModeRow.appendChild(webglModeBtn);
  scenePane.appendChild(engineModeRow);

  addSlider(scenePane, 'lightAngle', 'Key Light Angle', -180, 180, 1, (v) => `${Math.round(v)}°`);
  addSlider(scenePane, 'lightIntensity', 'Key Intensity', 0.2, 2.5, 0.05, (v) => v.toFixed(2));
  addSlider(scenePane, 'windStrength', 'Wind Breeze', 0.0, 2.5, 0.05, (v) => v.toFixed(2));

  function updateGPUFurModeUI(isGpuFur) {
    const enabled = Boolean(isGpuFur);
    state.gpuFurEnabled = enabled;
    webglModeBtn.classList.toggle('active', !enabled);
    gpuFurModeBtn.classList.toggle('active', enabled);
    if (sliderRefs.furDensity) {
      sliderRefs.furDensity.valSpan.textContent = sliderRefs.furDensity.formatFn(state.furDensity);
    }
  }

  webglModeBtn.addEventListener('click', () => {
    if (state.gpuFurEnabled) {
      updateGPUFurModeUI(false);
      onChange('toggleGPUFur', false);
      if (petBrain) petBrain.saveToStorage();
    }
  });

  gpuFurModeBtn.addEventListener('click', () => {
    if (!state.gpuFurEnabled) {
      updateGPUFurModeUI(true);
      onChange('toggleGPUFur', true);
      if (petBrain) petBrain.saveToStorage();
    }
  });

  updateGPUFurModeUI(Boolean(state.gpuFurEnabled));

  function updateEnvSelectionUI(activeId) {
    const safeId = sanitizeEnvId(activeId, 'highrise');
    Object.keys(sceneButtons).forEach((id) => {
      sceneButtons[id].classList.toggle('active', id === safeId);
    });
  }

  function renderChatAndStatus(brainState) {
    // Mic / Talk Mode Button State (Clean No-Emoji)
    if (brainState.isTalkMode) {
      micBtn.classList.add('talk-mode-active');
      if (brainState.isRecordingMic) {
        micBtn.innerHTML = `<span class="mic-rec-indicator"></span> <span>Talk: Listening</span>`;
        micBtn.classList.add('recording');
      } else if (brainState.isTranscribing) {
        micBtn.innerHTML = `<span class="mic-spin-indicator"></span> <span>Transcribing...</span>`;
        micBtn.classList.remove('recording');
      } else if (brainState.isChatLoading) {
        micBtn.innerHTML = `<span class="mic-spin-indicator"></span> <span>Thinking...</span>`;
        micBtn.classList.remove('recording');
      } else if (brainState.isSpeaking) {
        micBtn.innerHTML = `<span class="mic-rec-indicator"></span> <span>Talk: Speaking</span>`;
        micBtn.classList.remove('recording');
      } else {
        micBtn.innerHTML = `<span class="mic-rec-indicator"></span> <span>Talk: Active</span>`;
        micBtn.classList.remove('recording');
      }
    } else {
      micBtn.classList.remove('talk-mode-active');
      if (brainState.isRecordingMic) {
        micBtn.innerHTML = `<span class="mic-rec-indicator"></span> <span>Stop</span>`;
        micBtn.classList.add('recording');
      } else if (brainState.isTranscribing) {
        micBtn.innerHTML = `<span class="mic-spin-indicator"></span> <span>Transcribing...</span>`;
        micBtn.classList.remove('recording');
      } else {
        micBtn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
            <line x1="12" x2="12" y1="19" y2="22"></line>
          </svg>
          <span>Talk</span>
        `;
        micBtn.classList.remove('recording');
      }
    }

    // Input state
    if (brainState.isChatLoading) {
      chatInput.placeholder = `${brainState.profile.name || 'Mochi-Puff'} is thinking...`;
      chatInput.disabled = true;
    } else {
      chatInput.placeholder = 'Type a message and press Enter...';
      chatInput.disabled = false;
    }

    // Error banner
    if (brainState.lastError) {
      errorBannerText.textContent = brainState.lastError;
      errorBanner.classList.remove('hidden');
    } else {
      errorBanner.classList.add('hidden');
    }

    // Render Chat History in Settings Tab
    renderChatHistoryInTab();

    // Sync AI Endpoint inputs
    syncGeminiKeyUI();
    syncChatAi();
    syncSttAi();
    syncTtsAi();
  }

  return {
    bindPetBrain(brainInstance) {
      petBrain = brainInstance;
      renderChatAndStatus(petBrain.state);
      checkFirstRunSetup();
    },
    updatePetState(brainState) {
      renderChatAndStatus(brainState);
    },
    setSubtitle(text, visible) {
      if (visible && text) {
        subtitleTextEl.textContent = text;
        subtitleWrap.classList.remove('hidden');
      } else {
        subtitleWrap.classList.add('hidden');
      }
    },
    syncUI() {
      Object.keys(sliderRefs).forEach((k) => {
        if (state[k] !== undefined) {
          const ref = sliderRefs[k];
          const safeVal = clampNumber(state[k], ref.min, ref.max, ref.min);
          state[k] = safeVal;
          ref.input.value = String(safeVal);
          ref.valSpan.textContent = ref.formatFn(safeVal);
        }
      });
      Object.keys(colorRefs).forEach((k) => {
        if (state[k]) colorRefs[k].value = state[k];
      });
      updateEnvSelectionUI(state.environment || 'highrise');
      updateGPUFurModeUI(Boolean(state.gpuFurEnabled));
      if (accButtons[state.accessory || 'none']) {
        Object.keys(accButtons).forEach((k) => accButtons[k].classList.toggle('active', k === (state.accessory || 'none')));
      }
      if (state.eyeColor) {
        const targetEye = String(state.eyeColor || '').toLowerCase();
        Object.keys(eyeButtons).forEach((k) => eyeButtons[k].classList.toggle('active', k.toLowerCase() === targetEye));
      }
    },
    setGPUFurEnabled(enabled) {
      updateGPUFurModeUI(Boolean(enabled));
    },
    setActiveEnvironment(envId) {
      const safeEnv = sanitizeEnvId(envId, 'highrise');
      state.environment = safeEnv;
      updateEnvSelectionUI(safeEnv);
    },
    setARStatus() {},
    setARPlaneStatus() {},
    setARLightStatus() {},
    setLightEstActive() {},
    setSurfaceTrackedStatus() {},
    setTapPlaceActive() {},
    setMirrorLabel() {},
  };
}
