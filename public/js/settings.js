// ==========================================
// SYNCRA SETTINGS CONTROLLER MODULE
// ==========================================

import { api } from './api.js';
import { ui } from './ui.js';
import { webrtc } from './webrtc.js';

export const settings = {
  previewStream: null,
  swRegistration: null,

  init() {
    // Register Service Worker
    this.registerServiceWorker();

    // Push Notification Toggle Handler
    const pushToggle = document.getElementById('settings-push-enabled');
    if (pushToggle) {
      pushToggle.addEventListener('change', async () => {
        await this.handlePushToggle(pushToggle.checked);
      });
    }

    // Send Test Push Button Handler
    const btnTestPush = document.getElementById('btn-test-push');
    if (btnTestPush) {
      btnTestPush.addEventListener('click', async () => {
        try {
          btnTestPush.disabled = true;
          await api.testPushNotification();
          ui.showToast('Test push notification sent!', 'success');
        } catch (err) {
          console.error('[WebPush] Error sending test push:', err);
          ui.showToast('Failed to send test push notification', 'error');
        } finally {
          btnTestPush.disabled = false;
        }
      });
    }

    // 1. Tab Navigation Logic
    const tabButtons = document.querySelectorAll('.settings-tab-btn');
    const panes = document.querySelectorAll('.settings-pane');

    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-target');
        
        // Stop camera preview if leaving the Devices tab
        if (targetId !== 'settings-pane-devices') {
          this.stopCameraPreview();
        }

        // Toggle active tab button
        tabButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Toggle active pane
        panes.forEach(pane => {
          if (pane.id === targetId) {
            pane.classList.add('active');
          } else {
            pane.classList.remove('active');
          }
        });

        // Start camera preview if entering the Devices tab
        if (targetId === 'settings-pane-devices') {
          this.loadDevices().then(() => {
            this.startCameraPreview();
          });
        }
      });
    });

    // 2. Profile Update Form
    const profileForm = document.getElementById('profile-update-form');
    if (profileForm) {
      profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.updateProfile();
      });
    }

    // 3. Preferences Update Form
    const preferencesForm = document.getElementById('preferences-update-form');
    if (preferencesForm) {
      preferencesForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.savePreferences();
      });
    }

    // 4. Devices Update Form
    const devicesForm = document.getElementById('devices-update-form');
    if (devicesForm) {
      devicesForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveDeviceSelection();
      });
    }

    // 5. Security (Password) Update Form
    const securityForm = document.getElementById('security-update-form');
    if (securityForm) {
      securityForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.updatePassword();
      });

      // Password Visibility Toggles in settings
      securityForm.querySelectorAll('.btn-toggle-password').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const input = btn.previousElementSibling;
          if (!input) return;
          
          const isPassword = input.type === 'password';
          input.type = isPassword ? 'text' : 'password';
          
          const icon = btn.querySelector('i');
          if (icon) {
            icon.setAttribute('data-lucide', isPassword ? 'eye-off' : 'eye');
            if (window.lucide) {
              window.lucide.createIcons();
            }
          }
        });
      });
    }

    // 6. Revoke All Sessions Button
    const btnRevokeAll = document.getElementById('btn-security-revoke-all');
    if (btnRevokeAll) {
      btnRevokeAll.addEventListener('click', async () => {
        if (confirm('Are you sure you want to revoke all active sessions? You will be logged out of all devices, including this one.')) {
          try {
            await api.signOut();
            ui.showToast('All sessions revoked. Logging out...', 'success');
            setTimeout(() => {
              window.location.reload();
            }, 1500);
          } catch (err) {
            console.error('Revocation error:', err);
            ui.showToast('Failed to revoke sessions. Please try again.', 'error');
          }
        }
      });
    }

    // Expose stop camera preview globally so app.js can call it on navigation
    window.syncraStopCameraPreview = () => this.stopCameraPreview();
  },

  async show() {
    // 1. Populate Profile details
    try {
      const payload = await api.getMe();
      const user = payload.data.user;

      const nameInput = document.getElementById('profile-name-input');
      const emailInput = document.getElementById('profile-email-input');
      const langSelect = document.getElementById('profile-lang-input');
      const avatarPreview = document.getElementById('settings-avatar-preview');
      const securityTab = document.getElementById('settings-tab-security');

      if (nameInput) nameInput.value = user.name;
      if (emailInput) emailInput.value = user.email;
      if (langSelect) langSelect.value = user.preferredLanguage || 'en';
      if (avatarPreview) avatarPreview.textContent = user.name.charAt(0).toUpperCase();

      // Check if OAuth user (e.g. sandbox or oauth without local password management)
      const isOAuth = user.email.endsWith('-sandbox.com');
      if (isOAuth) {
        if (emailInput) emailInput.readOnly = true;
        // Hide security tab since they don't have a local password
        if (securityTab) securityTab.style.display = 'none';
      } else {
        if (emailInput) emailInput.readOnly = false;
        if (securityTab) securityTab.style.display = 'flex';
      }

      // 2. Load saved preferences
      this.loadSavedPreferences();
      this.checkPushSubscription();

      // Ensure Profile tab is active when entering settings
      const firstTab = document.querySelector('.settings-tab-btn[data-target="settings-pane-profile"]');
      if (firstTab) firstTab.click();

    } catch (err) {
      console.error('Error loading settings view:', err);
      ui.showToast('Failed to load profile details', 'error');
    }
  },

  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const btnToggle = document.getElementById('btn-theme-toggle');
    if (btnToggle) {
      const sunIcon = btnToggle.querySelector('.theme-icon-light');
      const moonIcon = btnToggle.querySelector('.theme-icon-dark');
      if (theme === 'dark') {
        if (sunIcon) sunIcon.style.display = 'block';
        if (moonIcon) moonIcon.style.display = 'none';
        btnToggle.setAttribute('data-tooltip', 'Switch to Light Mode');
      } else {
        if (sunIcon) sunIcon.style.display = 'none';
        if (moonIcon) moonIcon.style.display = 'block';
        btnToggle.setAttribute('data-tooltip', 'Switch to Dark Mode');
      }
    }
  },

  loadSavedPreferences() {
    const defaultLang = localStorage.getItem('syncra_default_lang') || 'en';
    const defaultTargetLang = localStorage.getItem('syncra_default_target_lang') || 'fr';
    const notifyMeetings = localStorage.getItem('syncra_notify_meetings') !== 'false';
    const notifyGlossary = localStorage.getItem('syncra_notify_glossary') !== 'false';
    const theme = localStorage.getItem('syncra_theme') || 'light';

    const defaultLangSelect = document.getElementById('settings-default-lang');
    const defaultTargetLangSelect = document.getElementById('settings-default-target-lang');
    const notifyMeetingsCheck = document.getElementById('settings-notify-meetings');
    const notifyGlossaryCheck = document.getElementById('settings-notify-glossary');
    const themeSelect = document.getElementById('settings-theme');

    if (defaultLangSelect) defaultLangSelect.value = defaultLang;
    if (defaultTargetLangSelect) defaultTargetLangSelect.value = defaultTargetLang;
    if (notifyMeetingsCheck) notifyMeetingsCheck.checked = notifyMeetings;
    if (notifyGlossaryCheck) notifyGlossaryCheck.checked = notifyGlossary;
    if (themeSelect) themeSelect.value = theme;

    this.applyTheme(theme);
  },

  async loadDevices() {
    const cameraSelect = document.getElementById('settings-camera');
    const micSelect = document.getElementById('settings-mic');
    if (!cameraSelect || !micSelect) return;

    cameraSelect.innerHTML = '<option value="">Loading cameras...</option>';
    micSelect.innerHTML = '<option value="">Loading microphones...</option>';

    try {
      // Prompt for temporary permission to enumerate devices
      const tempStream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: true, 
          noiseSuppression: true, 
          autoGainControl: true 
        }, 
        video: true 
      }).catch(() => null);

      if (tempStream) {
        tempStream.getTracks().forEach(track => track.stop());
      }
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      
      const cameras = devices.filter(d => d.kind === 'videoinput');
      const microphones = devices.filter(d => d.kind === 'audioinput');

      cameraSelect.innerHTML = cameras.map(c => 
        `<option value="${c.deviceId}">${ui.escapeHtml(c.label || `Camera ${cameraSelect.options.length}`)}</option>`
      ).join('') || '<option value="">No cameras found</option>';

      micSelect.innerHTML = microphones.map(m => 
        `<option value="${m.deviceId}">${ui.escapeHtml(m.label || `Microphone ${micSelect.options.length}`)}</option>`
      ).join('') || '<option value="">No microphones found</option>';

      // Re-select saved devices
      const savedCamera = localStorage.getItem('syncra_preferred_camera_id');
      const savedMic = localStorage.getItem('syncra_preferred_mic_id');

      if (savedCamera && [...cameraSelect.options].some(opt => opt.value === savedCamera)) {
        cameraSelect.value = savedCamera;
      }
      if (savedMic && [...micSelect.options].some(opt => opt.value === savedMic)) {
        micSelect.value = savedMic;
      }
    } catch (err) {
      console.error('Error enumerating devices:', err);
      cameraSelect.innerHTML = '<option value="">Permission denied / Error</option>';
      micSelect.innerHTML = '<option value="">Permission denied / Error</option>';
    }
  },

  async updateProfile() {
    const nameInput = document.getElementById('profile-name-input');
    const emailInput = document.getElementById('profile-email-input');
    const langSelect = document.getElementById('profile-lang-input');
    if (!nameInput || !emailInput) return;

    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const preferredLanguage = langSelect ? langSelect.value : 'en';

    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, preferredLanguage }),
      });

      const payload = await res.json();
      if (!res.ok) throw new Error(payload.message || 'Failed to update profile');

      ui.showToast('Profile updated successfully!', 'success');
      
      // Dispatch custom event to notify other SPA modules of profile changes
      document.dispatchEvent(new CustomEvent('syncra-profile-updated', { detail: payload.data.user }));
      
      // Update Header UI
      const profileName = document.getElementById('profile-name');
      const profileEmail = document.getElementById('profile-email');
      const welcomeName = document.getElementById('welcome-name');
      const userAvatar = document.getElementById('user-avatar');
      const dropdownUserAvatar = document.getElementById('dropdown-user-avatar');
      const avatarPreview = document.getElementById('settings-avatar-preview');

      if (profileName) profileName.textContent = name;
      if (profileEmail) profileEmail.textContent = email;
      if (welcomeName) welcomeName.textContent = name;
      if (userAvatar) userAvatar.textContent = name.charAt(0).toUpperCase();
      if (dropdownUserAvatar) dropdownUserAvatar.textContent = name.charAt(0).toUpperCase();
      if (avatarPreview) avatarPreview.textContent = name.charAt(0).toUpperCase();

    } catch (err) {
      console.error('Profile update error:', err);
      ui.showToast(err.message, 'error');
    }
  },

  async savePreferences() {
    const defaultLangSelect = document.getElementById('settings-default-lang');
    const defaultTargetLangSelect = document.getElementById('settings-default-target-lang');
    const notifyMeetingsCheck = document.getElementById('settings-notify-meetings');
    const notifyGlossaryCheck = document.getElementById('settings-notify-glossary');
    const themeSelect = document.getElementById('settings-theme');

    if (!defaultLangSelect || !defaultTargetLangSelect) return;

    const defaultLang = defaultLangSelect.value;
    const defaultTargetLang = defaultTargetLangSelect.value;
    const theme = themeSelect ? themeSelect.value : 'light';

    localStorage.setItem('syncra_default_lang', defaultLang);
    localStorage.setItem('syncra_default_target_lang', defaultTargetLang);
    localStorage.setItem('syncra_notify_meetings', notifyMeetingsCheck ? String(notifyMeetingsCheck.checked) : 'true');
    localStorage.setItem('syncra_notify_glossary', notifyGlossaryCheck ? String(notifyGlossaryCheck.checked) : 'true');
    localStorage.setItem('syncra_theme', theme);

    this.applyTheme(theme);

    // Sync to database profile
    const nameInput = document.getElementById('profile-name-input');
    const emailInput = document.getElementById('profile-email-input');

    if (nameInput && emailInput) {
      try {
        const res = await fetch('/api/auth/profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: nameInput.value.trim(),
            email: emailInput.value.trim(),
            preferredLanguage: defaultTargetLang
          }),
        });

        const payload = await res.json();
        if (!res.ok) throw new Error(payload.message || 'Failed to update database profile');

        // Update the profile lang input value in the Profile tab UI to match
        const profileLangInput = document.getElementById('profile-lang-input');
        if (profileLangInput) profileLangInput.value = defaultTargetLang;

        // Dispatch profile updated event so other modules (like chat) sync their currentUser
        document.dispatchEvent(new CustomEvent('syncra-profile-updated', { detail: payload.data.user }));
        
        ui.showToast('Preferences saved and profile synced successfully!', 'success');
      } catch (err) {
        console.error('Failed to sync settings to profile database:', err);
        ui.showToast('Preferences saved locally, but database sync failed: ' + err.message, 'warning');
      }
    } else {
      ui.showToast('Preferences saved successfully!', 'success');
    }
  },

  async saveDeviceSelection() {
    const cameraSelect = document.getElementById('settings-camera');
    const micSelect = document.getElementById('settings-mic');
    if (!cameraSelect || !micSelect) return;

    const newCameraId = cameraSelect.value;
    const newMicId = micSelect.value;

    const oldCameraId = localStorage.getItem('syncra_preferred_camera_id');
    const oldMicId = localStorage.getItem('syncra_preferred_mic_id');

    localStorage.setItem('syncra_preferred_camera_id', newCameraId);
    localStorage.setItem('syncra_preferred_mic_id', newMicId);

    ui.showToast('Device preferences saved!', 'success');

    // Hot-swap WebRTC devices if in an active call
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

    // Refresh preview with new camera selection
    this.startCameraPreview();
  },

  async updatePassword() {
    const securityForm = document.getElementById('security-update-form');
    const currentPasswordInput = document.getElementById('security-current-password');
    const newPasswordInput = document.getElementById('security-new-password');
    const confirmPasswordInput = document.getElementById('security-confirm-password');
    if (!currentPasswordInput || !newPasswordInput || !confirmPasswordInput || !securityForm) return;

    ui.clearFormErrors(securityForm);

    const currentPassword = currentPasswordInput.value;
    const newPassword = newPasswordInput.value;
    const confirmNewPassword = confirmPasswordInput.value;

    // Client-side confirm check
    if (newPassword !== confirmNewPassword) {
      ui.showInputError(confirmPasswordInput, 'New passwords do not match');
      confirmPasswordInput.focus();
      return;
    }

    try {
      const res = await fetch('/api/auth/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword, confirmNewPassword }),
      });

      const payload = await res.json();
      if (!res.ok) {
        const err = new Error(payload.message || 'Failed to update password');
        err.payload = payload;
        throw err;
      }

      ui.showToast('Password updated successfully! Other sessions revoked.', 'success');
      currentPasswordInput.value = '';
      newPasswordInput.value = '';
      confirmPasswordInput.value = '';
    } catch (err) {
      console.error('Password update error:', err);
      
      if (err.payload && err.payload.error_code === 'VALIDATION_ERROR' && err.payload.errors) {
        const errors = err.payload.errors;
        let firstInput = null;
        
        for (const fieldPath in errors) {
          // Map backend field names newPassword -> security-new-password
          let fieldId = `security-${fieldPath}`;
          if (fieldPath === 'confirmNewPassword') {
            fieldId = 'security-confirm-password';
          }
          const inputEl = document.getElementById(fieldId) || securityForm.querySelector(`[id$="${fieldPath}"]`);
          
          if (inputEl) {
            ui.showInputError(inputEl, errors[fieldPath][0]);
            if (!firstInput) firstInput = inputEl;
          }
        }
        
        if (firstInput) {
          firstInput.focus();
        } else {
          ui.showToast(err.message, 'error');
        }
      } else {
        ui.showToast(err.message, 'error');
      }
    }
  },

  async startCameraPreview() {
    this.stopCameraPreview();

    const videoPreview = document.getElementById('settings-video-preview');
    const placeholder = document.getElementById('settings-video-placeholder');
    const cameraSelect = document.getElementById('settings-camera');

    if (!videoPreview) return;

    const cameraId = cameraSelect?.value || localStorage.getItem('syncra_preferred_camera_id');

    try {
      const constraints = {
        video: cameraId ? { deviceId: { exact: cameraId } } : true,
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.previewStream = stream;
      videoPreview.srcObject = stream;
      videoPreview.style.display = 'block';
      if (placeholder) placeholder.style.display = 'none';
    } catch (err) {
      console.warn('Could not start webcam preview:', err);
      if (videoPreview) videoPreview.style.display = 'none';
      if (placeholder) {
        placeholder.style.display = 'flex';
        const span = placeholder.querySelector('span');
        if (span) span.textContent = 'Camera is blocked or unavailable';
      }
    }
  },

  stopCameraPreview() {
    const videoPreview = document.getElementById('settings-video-preview');
    const placeholder = document.getElementById('settings-video-placeholder');

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
      if (span) span.textContent = 'Webcam preview is currently inactive';
    }
  },

  async registerServiceWorker() {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        this.swRegistration = registration;
        console.log('[ServiceWorker] Registered successfully with scope:', registration.scope);
        
        // Re-check subscription UI now that it's registered
        this.checkPushSubscription();
      } catch (err) {
        console.error('[ServiceWorker] Registration failed:', err);
      }
    } else {
      console.warn('[WebPush] Service Workers or Push notifications are not supported in this browser.');
    }
  },

  async checkPushSubscription() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      this.updatePushUI('unsupported');
      return null;
    }

    // If registration is not cached yet, try to wait for active/ready service worker
    if (!this.swRegistration) {
      try {
        const readyRegistration = await navigator.serviceWorker.ready;
        if (readyRegistration) {
          this.swRegistration = readyRegistration;
        } else {
          const reg = await navigator.serviceWorker.getRegistration('/');
          if (reg) this.swRegistration = reg;
        }
      } catch (e) {
        console.warn('[WebPush] Failed to resolve ready service worker:', e);
      }
    }

    if (!this.swRegistration) {
      this.updatePushUI('unsupported');
      return null;
    }

    try {
      const subscription = await this.swRegistration.pushManager.getSubscription();
      if (subscription) {
        this.updatePushUI('subscribed');
        return subscription;
      } else {
        this.updatePushUI('unsubscribed');
        return null;
      }
    } catch (err) {
      console.error('[WebPush] Error checking subscription:', err);
      this.updatePushUI('error');
      return null;
    }
  },

  updatePushUI(state) {
    const badge = document.getElementById('push-status-badge');
    const checkbox = document.getElementById('settings-push-enabled');
    const details = document.getElementById('push-details-group');

    if (!badge || !checkbox) return;

    checkbox.disabled = false;

    if (state === 'subscribed') {
      badge.textContent = 'Subscribed';
      badge.className = 'push-status-badge success';
      checkbox.checked = true;
      if (details) details.style.display = 'block';
    } else if (state === 'unsubscribed') {
      badge.textContent = 'Not Active';
      badge.className = 'push-status-badge muted';
      checkbox.checked = false;
      if (details) details.style.display = 'none';
    } else if (state === 'subscribing...') {
      badge.textContent = 'Subscribing...';
      badge.className = 'push-status-badge warning';
      checkbox.disabled = true;
    } else if (state === 'unsubscribing...') {
      badge.textContent = 'Unsubscribing...';
      badge.className = 'push-status-badge warning';
      checkbox.disabled = true;
    } else if (state === 'unsupported') {
      badge.textContent = 'Unsupported';
      badge.className = 'push-status-badge danger';
      checkbox.checked = false;
      checkbox.disabled = true;
      if (details) details.style.display = 'none';
    } else if (state === 'error') {
      badge.textContent = 'Blocked/Error';
      badge.className = 'push-status-badge danger';
      checkbox.checked = false;
      if (details) details.style.display = 'none';
    }
  },

  async handlePushToggle(enabled) {
    if (!this.swRegistration) return;

    this.updatePushUI(enabled ? 'subscribing...' : 'unsubscribing...');

    try {
      if (enabled) {
        // 1. Fetch VAPID public key
        const res = await api.getVapidKey();
        const publicKey = res.data.publicKey;
        if (!publicKey) {
          throw new Error('VAPID public key not found on server');
        }
        
        // 2. Request permission and subscribe
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          throw new Error('Notification permission denied');
        }

        const convertedVapidKey = this.urlBase64ToUint8Array(publicKey);

        const subscription = await this.swRegistration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey
        });

        // 3. Post to backend
        const subJSON = subscription.toJSON();
        await api.subscribePush(subJSON);

        ui.showToast('Push notifications enabled successfully!', 'success');
        this.updatePushUI('subscribed');
      } else {
        const subscription = await this.swRegistration.pushManager.getSubscription();
        if (subscription) {
          await api.unsubscribePush(subscription.endpoint);
          await subscription.unsubscribe();
        }

        ui.showToast('Push notifications disabled.', 'success');
        this.updatePushUI('unsubscribed');
      }
    } catch (err) {
      console.error('[WebPush] Toggle push failed:', err);
      ui.showToast(err.message || 'Failed to update push subscription settings', 'error');
      await this.checkPushSubscription();
    }
  },

  urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }
};
export default settings;
