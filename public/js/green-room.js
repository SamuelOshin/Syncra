// ==========================================
// SYNCRA PRE-FLIGHT GREEN ROOM MODULE
// ==========================================

import { ui } from './ui.js';

export const greenRoom = {
  modal: null,
  roomId: null,
  userName: null,
  onJoin: null,
  previewStream: null,
  audioContext: null,
  meterRaf: null,

  init(roomId, userName, user, onJoinCallback) {
    this.roomId = roomId;
    this.userName = userName;
    this.onJoin = onJoinCallback;
    this.modal = document.getElementById('green-room-modal');

    // Load saved preferences or database defaults
    const savedSpeak = user.defaultSpeakingLanguage || localStorage.getItem('syncra_default_lang') || 'en';
    const savedTranslate = user.defaultTranslationLanguage || localStorage.getItem('syncra_default_target_lang') || 'fr';

    const speakSelect = document.getElementById('green-room-speak-lang');
    const translateSelect = document.getElementById('green-room-translate-lang');

    if (speakSelect) speakSelect.value = savedSpeak;
    if (translateSelect) translateSelect.value = savedTranslate;

    // Button event listeners (cleanup old listeners via clone)
    const btnJoin = document.getElementById('btn-green-room-join');
    const btnCancel = document.getElementById('btn-green-room-cancel');
    const btnClose = document.getElementById('btn-green-room-close');

    btnJoin?.replaceWith(btnJoin.cloneNode(true));
    btnCancel?.replaceWith(btnCancel.cloneNode(true));
    btnClose?.replaceWith(btnClose.cloneNode(true));

    const newBtnJoin = document.getElementById('btn-green-room-join');
    const newBtnCancel = document.getElementById('btn-green-room-cancel');
    const newBtnClose = document.getElementById('btn-green-room-close');

    newBtnJoin?.addEventListener('click', () => this.handleJoin());
    newBtnCancel?.addEventListener('click', () => this.handleCancel());
    newBtnClose?.addEventListener('click', () => this.handleCancel());

    // Device changes hot-swap
    const cameraSelect = document.getElementById('green-room-camera');
    const micSelect = document.getElementById('green-room-mic');

    cameraSelect?.replaceWith(cameraSelect.cloneNode(true));
    micSelect?.replaceWith(micSelect.cloneNode(true));

    const newCameraSelect = document.getElementById('green-room-camera');
    const newMicSelect = document.getElementById('green-room-mic');

    newCameraSelect?.addEventListener('change', () => this.startPreview());
    newMicSelect?.addEventListener('change', () => this.startPreview());

    // Show modal and start devices
    this.show();
    this.loadDevices();
  },

  show() {
    if (this.modal) {
      this.modal.classList.add('active');
    }
  },

  hide() {
    this.cleanup();
    if (this.modal) {
      this.modal.classList.remove('active');
    }
    const overlay = document.getElementById('green-room-connecting');
    if (overlay) {
      overlay.style.display = 'none';
    }
  },

  async loadDevices() {
    const cameraSelect = document.getElementById('green-room-camera');
    const micSelect = document.getElementById('green-room-mic');
    if (!cameraSelect || !micSelect) return;

    cameraSelect.innerHTML = '<option value="">Detecting cameras...</option>';
    micSelect.innerHTML = '<option value="">Detecting microphones...</option>';

    try {
      const preferredCam = localStorage.getItem('syncra_preferred_camera_id');
      const preferredMic = localStorage.getItem('syncra_preferred_mic_id');

      // Start the preview first (which requests permissions and activates camera/mic)
      try {
        await this.startPreview(preferredCam, preferredMic);
      } catch (previewErr) {
        console.warn('Green Room preview failed to start, attempting to enumerate devices anyway:', previewErr);
      }

      // Now that permissions are granted, enumerate the devices to get real labels
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter(d => d.kind === 'videoinput');
      const microphones = devices.filter(d => d.kind === 'audioinput');

      // Populate camera select
      cameraSelect.innerHTML = cameras.map((c, i) => 
        `<option value="${c.deviceId}">${ui.escapeHtml(c.label || `Camera ${i + 1}`)}</option>`
      ).join('') || '<option value="">No camera detected</option>';

      // Populate mic select
      micSelect.innerHTML = microphones.map((m, i) => 
        `<option value="${m.deviceId}">${ui.escapeHtml(m.label || `Microphone ${i + 1}`)}</option>`
      ).join('') || '<option value="">No microphone detected</option>';

      // Determine active device IDs from the stream
      let activeCamId = preferredCam;
      let activeMicId = preferredMic;

      if (this.previewStream) {
        const videoTrack = this.previewStream.getVideoTracks()[0];
        const audioTrack = this.previewStream.getAudioTracks()[0];
        if (videoTrack) {
          activeCamId = videoTrack.getSettings().deviceId || preferredCam;
        }
        if (audioTrack) {
          activeMicId = audioTrack.getSettings().deviceId || preferredMic;
        }
      }

      // Pre-select active options
      if (activeCamId && cameras.some(c => c.deviceId === activeCamId)) {
        cameraSelect.value = activeCamId;
      } else if (cameras.length > 0) {
        cameraSelect.value = cameras[0].deviceId;
      }

      if (activeMicId && microphones.some(m => m.deviceId === activeMicId)) {
        micSelect.value = activeMicId;
      } else if (microphones.length > 0) {
        micSelect.value = microphones[0].deviceId;
      }
    } catch (err) {
      console.error('Error listing devices in Green Room precheck:', err);
      const msg = (!navigator.mediaDevices) ? 'HTTPS Required' : 'Permission denied';
      cameraSelect.innerHTML = `<option value="">${msg}</option>`;
      micSelect.innerHTML = `<option value="">${msg}</option>`;
    }
  },

  async startPreview(preferredCamId, preferredMicId) {
    this.cleanupStream();

    const videoPreview = document.getElementById('green-room-video-preview');
    const placeholder = document.getElementById('green-room-video-placeholder');
    const container = videoPreview?.closest('.green-room-preview-container');
    const cameraSelect = document.getElementById('green-room-camera');
    const micSelect = document.getElementById('green-room-mic');

    if (!videoPreview) return;

    const cameraId = preferredCamId !== undefined ? preferredCamId : cameraSelect?.value;
    const micId = preferredMicId !== undefined ? preferredMicId : micSelect?.value;

    const hasCameraOptions = cameraSelect && cameraSelect.options.length > 1;
    const hasMicOptions = micSelect && micSelect.options.length > 1;

    if (hasCameraOptions && hasMicOptions && !cameraId && !micId) return;

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('MediaDevicesNotSupported: Secure context (HTTPS) is required.');
      }
      const constraints = {
        video: cameraId ? { deviceId: { ideal: cameraId } } : (hasCameraOptions && !cameraId ? false : true),
        audio: micId ? { deviceId: { ideal: micId } } : (hasMicOptions && !micId ? false : true)
      };

      if (!constraints.video && !constraints.audio) return;

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.previewStream = stream;

      // 1. Setup Video Rendering
      if (stream.getVideoTracks().length > 0) {
        videoPreview.srcObject = stream;
        videoPreview.style.display = 'block';
        if (placeholder) placeholder.style.display = 'none';
        if (container) container.classList.add('active-preview');
      } else {
        videoPreview.srcObject = null;
        videoPreview.style.display = 'none';
        if (placeholder) placeholder.style.display = 'flex';
        if (container) container.classList.remove('active-preview');
      }

      // 2. Setup Real-time Audio Level Visualizer
      if (stream.getAudioTracks().length > 0) {
        this.setupAudioMeter(stream);
      } else {
        const levelEl = document.getElementById('green-room-mic-level');
        if (levelEl) levelEl.style.width = '0%';
      }

    } catch (err) {
      console.warn('Failed to start green room preview streams:', err);
      videoPreview.style.display = 'none';
      if (placeholder) {
        placeholder.style.display = 'flex';
        const span = placeholder.querySelector('span');
        if (span) span.textContent = 'Hardware is blocked or in use';
      }
      if (container) container.classList.remove('active-preview');
      const levelEl = document.getElementById('green-room-mic-level');
      if (levelEl) levelEl.style.width = '0%';
      throw err;
    }
  },

  setupAudioMeter(stream) {
    try {
      window.AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!window.AudioContext) return;

      this.audioContext = new AudioContext();
      const analyser = this.audioContext.createAnalyser();
      const source = this.audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      analyser.fftSize = 64;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const update = () => {
        if (!this.previewStream) return;
        analyser.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;

        // Map sound input average to percentage width
        const pct = Math.min(100, Math.round((avg / 100) * 100));
        const levelEl = document.getElementById('green-room-mic-level');
        if (levelEl) {
          levelEl.style.width = `${pct}%`;
        }

        this.meterRaf = requestAnimationFrame(update);
      };

      update();
    } catch (err) {
      console.warn('Could not initialize audio meter in Green Room precheck:', err);
    }
  },

  handleJoin() {
    const cameraSelect = document.getElementById('green-room-camera');
    const micSelect = document.getElementById('green-room-mic');
    const speakSelect = document.getElementById('green-room-speak-lang');
    const translateSelect = document.getElementById('green-room-translate-lang');

    const selectedSettings = {
      cameraId: cameraSelect?.value || null,
      micId: micSelect?.value || null,
      speakLang: speakSelect?.value || 'en',
      translateLang: translateSelect?.value || 'fr'
    };

    // Save defaults to localStorage for future instant presets
    localStorage.setItem('syncra_default_lang', selectedSettings.speakLang);
    localStorage.setItem('syncra_default_target_lang', selectedSettings.translateLang);
    if (selectedSettings.cameraId) localStorage.setItem('syncra_preferred_camera_id', selectedSettings.cameraId);
    if (selectedSettings.micId) localStorage.setItem('syncra_preferred_mic_id', selectedSettings.micId);

    // Stop local green room preview streams to release device hardware
    this.cleanupStream();

    // Show the connecting overlay inside the modal card
    const overlay = document.getElementById('green-room-connecting');
    if (overlay) {
      overlay.style.display = 'flex';
    }

    if (this.onJoin) {
      this.onJoin(selectedSettings);
    }
  },

  handleCancel() {
    this.hide();
    // Redirect or return user back to the dashboard if canceled
    const dashboardScreen = document.getElementById('dashboard-screen');
    const activeScreen = document.querySelector('.screen.active');
    if (activeScreen && activeScreen.id !== 'dashboard-screen') {
      const screens = document.querySelectorAll('.screen');
      screens.forEach(s => s.classList.remove('active'));
      dashboardScreen?.classList.add('active');
    }
  },

  cleanupStream() {
    if (this.meterRaf) {
      cancelAnimationFrame(this.meterRaf);
      this.meterRaf = null;
    }
    if (this.previewStream) {
      this.previewStream.getTracks().forEach(track => track.stop());
      this.previewStream = null;
    }
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
  },

  cleanup() {
    this.cleanupStream();
    const levelEl = document.getElementById('green-room-mic-level');
    if (levelEl) levelEl.style.width = '0%';
  }
};
export default greenRoom;
