// ==========================================
// SYNCRA SETTINGS CONTROLLER MODULE
// ==========================================

import { ui } from './ui.js';
import { webrtc } from './webrtc.js';

const settingsModal = document.getElementById('settings-modal');
const btnSidebarSettings = document.getElementById('btn-sidebar-settings');
const btnCloseSettings = document.getElementById('btn-close-settings');
const btnCancelSettings = document.getElementById('btn-cancel-settings');
const settingsForm = document.getElementById('settings-form');

const cameraSelect = document.getElementById('settings-camera');
const micSelect = document.getElementById('settings-mic');
const defaultLangSelect = document.getElementById('settings-default-lang');
const defaultTargetLangSelect = document.getElementById('settings-default-target-lang');

export const settings = {
  init() {
    if (btnSidebarSettings) {
      btnSidebarSettings.addEventListener('click', (e) => {
        e.preventDefault();
        ui.toggleModal(settingsModal, true);
        this.loadDevices();
        this.loadSavedPreferences();
      });
    }

    const closeActions = [btnCloseSettings, btnCancelSettings];
    closeActions.forEach(btn => {
      if (btn) {
        btn.addEventListener('click', () => {
          ui.toggleModal(settingsModal, false);
        });
      }
    });

    if (settingsForm) {
      settingsForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.savePreferences();
      });
    }

    // Apply default languages to Guest Entry screen on load
    this.applyLanguageDefaultsToEntryScreen();
  },

  async loadDevices() {
    if (!cameraSelect || !micSelect) return;

    cameraSelect.innerHTML = '<option value="">Loading cameras...</option>';
    micSelect.innerHTML = '<option value="">Loading microphones...</option>';

    try {
      // Prompt for temporary permission to enumerate devices (best practice)
      await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      
      const cameras = devices.filter(d => d.kind === 'videoinput');
      const microphones = devices.filter(d => d.kind === 'audioinput');

      cameraSelect.innerHTML = cameras.map(c => 
        `<option value="${c.deviceId}">${ui.escapeHtml(c.label || `Camera ${cameraSelect.options.length}`)}</option>`
      ).join('') || '<option value="">No cameras found</option>';

      micSelect.innerHTML = microphones.map(m => 
        `<option value="${m.deviceId}">${ui.escapeHtml(m.label || `Microphone ${micSelect.options.length}`)}</option>`
      ).join('') || '<option value="">No microphones found</option>';

      // Re-select saved devices after populating options
      const savedCamera = localStorage.getItem('syncra_preferred_camera_id');
      const savedMic = localStorage.getItem('syncra_preferred_mic_id');

      if (savedCamera && [...cameraSelect.options].some(opt => opt.value === savedCamera)) {
        cameraSelect.value = savedCamera;
      }
      if (savedMic && [...micSelect.options].some(opt => opt.value === savedMic)) {
        micSelect.value = savedMic;
      }
    } catch (err) {
      console.error('Error enumerating media devices:', err);
      cameraSelect.innerHTML = '<option value="">Permission denied / Error</option>';
      micSelect.innerHTML = '<option value="">Permission denied / Error</option>';
    }
  },

  loadSavedPreferences() {
    const defaultLang = localStorage.getItem('syncra_default_lang') || 'en';
    const defaultTargetLang = localStorage.getItem('syncra_default_target_lang') || 'fr';

    if (defaultLangSelect) defaultLangSelect.value = defaultLang;
    if (defaultTargetLangSelect) defaultTargetLangSelect.value = defaultTargetLang;
  },

  async savePreferences() {
    if (!cameraSelect || !micSelect || !defaultLangSelect || !defaultTargetLangSelect) return;

    const newCameraId = cameraSelect.value;
    const newMicId = micSelect.value;
    const defaultLang = defaultLangSelect.value;
    const defaultTargetLang = defaultTargetLangSelect.value;

    const oldCameraId = localStorage.getItem('syncra_preferred_camera_id');
    const oldMicId = localStorage.getItem('syncra_preferred_mic_id');

    // Store in localStorage
    localStorage.setItem('syncra_preferred_camera_id', newCameraId);
    localStorage.setItem('syncra_preferred_mic_id', newMicId);
    localStorage.setItem('syncra_default_lang', defaultLang);
    localStorage.setItem('syncra_default_target_lang', defaultTargetLang);

    ui.toggleModal(settingsModal, false);
    ui.showToast('Settings saved successfully!', 'success');

    // Apply language defaults to entry screen immediately
    this.applyLanguageDefaultsToEntryScreen();

    // Hot-swap WebRTC devices if in an active call!
    if (webrtc.localStream) {
      try {
        if (newCameraId && newCameraId !== oldCameraId) {
          await webrtc.switchDevice('video', newCameraId);
        }
        if (newMicId && newMicId !== oldMicId) {
          await webrtc.switchDevice('audio', newMicId);
        }
      } catch (err) {
        console.error('Error hot-swapping WebRTC devices:', err);
        ui.showToast('Failed to hot-swap active call devices', 'error');
      }
    }
  },

  applyLanguageDefaultsToEntryScreen() {
    const defaultLang = localStorage.getItem('syncra_default_lang');
    const langInput = document.getElementById('lang-input');
    if (langInput && defaultLang) {
      langInput.value = defaultLang;
    }
  }
};
export default settings;
