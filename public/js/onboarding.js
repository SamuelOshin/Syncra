// ==========================================
// SYNCRA ONBOARDING WIZARD MODULE
// ==========================================

import { api } from './api.js';
import { ui } from './ui.js';

export const onboarding = {
  modal: null,
  currentStep: 1,
  user: null,
  onComplete: null,
  previewStream: null,
  
  init(user, onCompleteCallback) {
    this.user = user;
    this.onComplete = onCompleteCallback;
    this.modal = document.getElementById('onboarding-modal');
    this.currentStep = 1;

    // Elements
    const nameInput = document.getElementById('onboarding-name');
    const prefLangSelect = document.getElementById('onboarding-pref-lang');
    const btnNext = document.getElementById('btn-onboarding-next');
    const btnPrev = document.getElementById('btn-onboarding-prev');

    if (nameInput && user) {
      nameInput.value = user.name || '';
    }
    if (prefLangSelect && user) {
      prefLangSelect.value = user.preferredLanguage || 'en';
    }

    // Button event listeners
    btnNext?.replaceWith(btnNext.cloneNode(true));
    btnPrev?.replaceWith(btnPrev.cloneNode(true));
    
    const btnSkip = document.getElementById('btn-onboarding-skip');
    btnSkip?.replaceWith(btnSkip.cloneNode(true));

    const newBtnNext = document.getElementById('btn-onboarding-next');
    const newBtnPrev = document.getElementById('btn-onboarding-prev');
    const newBtnSkip = document.getElementById('btn-onboarding-skip');

    newBtnNext?.addEventListener('click', () => this.handleNext());
    newBtnPrev?.addEventListener('click', () => this.handlePrev());
    newBtnSkip?.addEventListener('click', () => this.skipOnboarding());

    // Device changes listeners
    const cameraSelect = document.getElementById('onboarding-camera');
    cameraSelect?.addEventListener('change', () => this.startCameraPreview());

    // Keyboard accessibility: Allow Enter key to submit or go to next step
    const onboardingCard = this.modal?.querySelector('.onboarding-card');
    onboardingCard?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
        this.handleNext();
      }
    });
  },

  show() {
    if (this.modal) {
      this.modal.classList.add('active');
      this.setStep(1);
    }
  },

  hide() {
    this.stopCameraPreview();
    if (this.modal) {
      this.modal.classList.remove('active');
    }
  },

  setStep(step) {
    this.currentStep = step;
    
    // Toggle active step class and display style
    for (let s = 1; s <= 4; s++) {
      const stepEl = document.getElementById(`onboarding-step-${s}`);
      const dotEl = this.modal?.querySelector(`.step-dot[data-step="${s}"]`);
      
      if (stepEl) {
        if (s === step) {
          stepEl.style.display = 'block';
          stepEl.classList.add('active');
        } else {
          stepEl.style.display = 'none';
          stepEl.classList.remove('active');
        }
      }

      if (dotEl) {
        if (s === step) {
          dotEl.className = 'step-dot active';
        } else if (s < step) {
          dotEl.className = 'step-dot completed';
        } else {
          dotEl.className = 'step-dot';
        }
      }
    }

    // Handle button labels and states
    const btnPrev = document.getElementById('btn-onboarding-prev');
    const btnNext = document.getElementById('btn-onboarding-next');

    if (btnPrev) {
      btnPrev.disabled = step === 1;
    }

    if (btnNext) {
      const span = btnNext.querySelector('span');
      const icon = btnNext.querySelector('i');
      if (span) {
        span.textContent = step === 4 ? 'Finish Setup' : 'Next';
      }
      if (icon) {
        icon.setAttribute('data-lucide', step === 4 ? 'check' : 'arrow-right');
        if (window.lucide) window.lucide.createIcons();
      }
    }

    // Tab entry behaviors
    if (step === 3) {
      this.loadDevicesAndPreview();
    } else {
      this.stopCameraPreview();
    }
  },

  validateStep(step) {
    if (step === 1) {
      const nameInput = document.getElementById('onboarding-name');
      const nameVal = nameInput ? nameInput.value.trim() : '';
      if (nameVal.length < 3) {
        if (nameInput) {
          ui.showInputError(nameInput, 'Name must be at least 3 characters.');
          nameInput.focus();
        }
        return false;
      }
      if (nameInput) ui.clearFormErrors(nameInput.closest('form') || nameInput.closest('.onboarding-step'));
    }
    if (step === 4) {
      const projectInput = document.getElementById('onboarding-project-name');
      const projectVal = projectInput ? projectInput.value.trim() : '';
      if (projectVal.length < 3) {
        if (projectInput) {
          ui.showInputError(projectInput, 'Project name must be at least 3 characters.');
          projectInput.focus();
        }
        return false;
      }
      if (projectInput) ui.clearFormErrors(projectInput.closest('form') || projectInput.closest('.onboarding-step'));
    }
    return true;
  },

  handleNext() {
    if (!this.validateStep(this.currentStep)) return;

    if (this.currentStep < 4) {
      this.setStep(this.currentStep + 1);
    } else {
      this.submitOnboarding();
    }
  },

  handlePrev() {
    if (this.currentStep > 1) {
      this.setStep(this.currentStep - 1);
    }
  },

  async loadDevicesAndPreview() {
    const cameraSelect = document.getElementById('onboarding-camera');
    const micSelect = document.getElementById('onboarding-mic');
    if (!cameraSelect || !micSelect) return;

    cameraSelect.innerHTML = '<option value="">Loading cameras...</option>';
    micSelect.innerHTML = '<option value="">Loading microphones...</option>';

    try {
      // Prompt for temporary permissions to enumerate
      const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true }).catch(() => null);
      if (tempStream) {
        tempStream.getTracks().forEach(track => track.stop());
      }
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter(d => d.kind === 'videoinput');
      const microphones = devices.filter(d => d.kind === 'audioinput');

      cameraSelect.innerHTML = cameras.map((c, i) => 
        `<option value="${c.deviceId}">${ui.escapeHtml(c.label || `Camera ${i + 1}`)}</option>`
      ).join('') || '<option value="">No cameras found</option>';

      micSelect.innerHTML = microphones.map((m, i) => 
        `<option value="${m.deviceId}">${ui.escapeHtml(m.label || `Microphone ${i + 1}`)}</option>`
      ).join('') || '<option value="">No microphones found</option>';

      this.startCameraPreview();
    } catch (err) {
      console.error('Error loading devices in onboarding:', err);
      cameraSelect.innerHTML = '<option value="">Permission denied</option>';
      micSelect.innerHTML = '<option value="">Permission denied</option>';
    }
  },

  async startCameraPreview() {
    this.stopCameraPreview();

    const videoPreview = document.getElementById('onboarding-video-preview');
    const placeholder = document.getElementById('onboarding-video-placeholder');
    const cameraSelect = document.getElementById('onboarding-camera');
    const container = videoPreview?.closest('.onboarding-preview-container');

    if (!videoPreview) return;

    const cameraId = cameraSelect?.value;
    if (!cameraId) return;

    try {
      const constraints = {
        video: { deviceId: { exact: cameraId } },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.previewStream = stream;
      videoPreview.srcObject = stream;
      videoPreview.style.display = 'block';
      if (placeholder) placeholder.style.display = 'none';
      if (container) container.classList.add('active-preview');
    } catch (err) {
      console.warn('Failed to display onboarding webcam preview:', err);
      if (videoPreview) videoPreview.style.display = 'none';
      if (placeholder) {
        placeholder.style.display = 'flex';
        const span = placeholder.querySelector('span');
        if (span) span.textContent = 'Camera is blocked or unavailable';
      }
      if (container) container.classList.remove('active-preview');
    }
  },

  stopCameraPreview() {
    const videoPreview = document.getElementById('onboarding-video-preview');
    const placeholder = document.getElementById('onboarding-video-placeholder');
    const container = videoPreview?.closest('.onboarding-preview-container');

    if (this.previewStream) {
      this.previewStream.getTracks().forEach(track => track.stop());
      this.previewStream = null;
    }

    if (videoPreview) {
      videoPreview.srcObject = null;
      videoPreview.style.display = 'none';
    }
    if (placeholder) {
      placeholder.style.display = 'flex';
      const span = placeholder.querySelector('span');
      if (span) span.textContent = 'Camera preview inactive';
    }
    if (container) container.classList.remove('active-preview');
  },

  async submitOnboarding() {
    const btnNext = document.getElementById('btn-onboarding-next');
    ui.setButtonLoading(btnNext, true, 'Saving...');

    const name = document.getElementById('onboarding-name').value.trim();
    const preferredLanguage = document.getElementById('onboarding-pref-lang').value;
    const defaultLang = document.getElementById('onboarding-default-lang').value;
    const defaultTargetLang = document.getElementById('onboarding-target-lang').value;
    const cameraId = document.getElementById('onboarding-camera').value;
    const micId = document.getElementById('onboarding-mic').value;
    const projectName = document.getElementById('onboarding-project-name').value.trim();
    const projectDesc = document.getElementById('onboarding-project-desc').value.trim();

    try {
      // 1. Save preferences to local storage
      localStorage.setItem('syncra_default_lang', defaultLang);
      localStorage.setItem('syncra_default_target_lang', defaultTargetLang);
      if (cameraId) localStorage.setItem('syncra_preferred_camera_id', cameraId);
      if (micId) localStorage.setItem('syncra_preferred_mic_id', micId);

      // 2. Submit onboarding identity details to backend
      const res = await api.completeOnboarding(name, preferredLanguage, defaultLang, defaultTargetLang, projectName, projectDesc);
      
      ui.setButtonLoading(btnNext, false);
      ui.showToast('Workspace configured successfully!', 'success');
      
      this.hide();
      
      if (this.onComplete) {
        this.onComplete(res.data.user);
      }
    } catch (err) {
      ui.setButtonLoading(btnNext, false);
      ui.showToast(err.message, 'error');
    }
  },

  async skipOnboarding() {
    const btnSkip = document.getElementById('btn-onboarding-skip');
    ui.setButtonLoading(btnSkip, true, 'Skipping...');

    // Use sensible defaults
    const name = this.user.name || 'User';
    const preferredLanguage = this.user.preferredLanguage || 'en';
    const defaultLang = 'en';
    const defaultTargetLang = 'fr';

    try {
      // 1. Save defaults to local storage
      localStorage.setItem('syncra_default_lang', defaultLang);
      localStorage.setItem('syncra_default_target_lang', defaultTargetLang);

      // 2. Submit onboarding identity details with defaults
      const res = await api.completeOnboarding(name, preferredLanguage, defaultLang, defaultTargetLang);
      
      ui.setButtonLoading(btnSkip, false);
      ui.showToast('Workspace set up with defaults', 'info');
      
      this.hide();
      
      if (this.onComplete) {
        this.onComplete(res.data.user);
      }
    } catch (err) {
      ui.setButtonLoading(btnSkip, false);
      ui.showToast(err.message, 'error');
    }
  }
};
export default onboarding;
