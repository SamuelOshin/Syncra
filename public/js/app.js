// ==========================================
// SYNCRA CLIENT ORCHESTRATOR & ENTRY POINT
// ==========================================

import { api } from './api.js';
import { ui } from './ui.js';
import { auth } from './auth.js';
import { onboarding } from './onboarding.js';
import { greenRoom } from './green-room.js';
import { dashboard } from './dashboard.js';
import { webrtc } from './webrtc.js';
import { speech } from './speech.js';
import { glossary } from './glossary.js';
import { settings } from './settings.js';
import { tm } from './tm.js';
import { search } from './search.js';
import { notifications } from './notifications.js';
import { audioStreamer } from './audio-streamer.js';
import { projects } from './projects.js';
import { analytics } from './analytics.js';
import { calendar } from './calendar.js';
import { chat } from './chat.js';

const socket = io();

// UI Screens
const splashScreen = document.getElementById('splash-screen');
const authScreen = document.getElementById('auth-screen');
const entryScreen = document.getElementById('entry-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const callScreen = document.getElementById('call-screen');

// Header Profile Info
const profileName = document.getElementById('profile-name');
const profileEmail = document.getElementById('profile-email');
const welcomeName = document.getElementById('welcome-name');
const userAvatar = document.getElementById('user-avatar');

// Call Controls
const roomTitle = document.getElementById('room-title');
const userLangBadge = document.getElementById('user-lang-badge');
const targetLangBadge = document.getElementById('target-lang-badge');
const captionStream = document.getElementById('caption-stream');
const btnMute = document.getElementById('btn-mute');
const btnCamera = document.getElementById('btn-camera');
const btnLeave = document.getElementById('btn-leave');
const btnExport = document.getElementById('btn-export-transcript');
const btnToggleCaptions = document.getElementById('btn-toggle-captions');
const btnCopyMeetingLink = document.getElementById('btn-copy-meeting-link');
const btnCopyMeetingLinkFooter = document.getElementById('btn-copy-meeting-link-footer');

// State Variables
let currentUser = null;
let activeRoomId = '';
let userName = '';
let userLang = 'en';
let targetLang = 'fr';
let isMuted = false;
let isCameraOff = false;
let liveTranscripts = []; // Cache of the current active call's transcripts for export
let currentMeeting = null; // Store active meeting details (including hostId and status)

// ==========================================
// 1. INITIALIZATION & ROUTING
// ==========================================

window.addEventListener('DOMContentLoaded', async () => {
  // Initialize Lucide Icons for static HTML
  if (window.lucide) {
    window.lucide.createIcons();
  }
  
  // Bind simple buttons and triggers
  initGlobalEvents();
  auth.init();
  glossary.init();
  settings.init();
  tm.init();
  search.init();
  notifications.init();
  projects.init();
  analytics.init();
  calendar.init();
  initSidebarNavigation();

  // Listen for hash changes to trigger SPA routing
  window.addEventListener('hashchange', () => {
    navigateToHash(window.location.hash);
  });

  // Initialize Sidebar Collapse State
  const sidebar = document.querySelector('.sidebar');
  const toggleBtn = document.getElementById('btn-sidebar-toggle');
  const isCollapsed = localStorage.getItem('syncra_sidebar_collapsed') === 'true';
  
  if (isCollapsed && sidebar) {
    sidebar.classList.add('collapsed');
    if (toggleBtn) {
      toggleBtn.setAttribute('title', 'Expand Sidebar');
      toggleBtn.innerHTML = '<i data-lucide="sidebar" style="transform: scaleX(-1);"></i>';
      if (window.lucide) window.lucide.createIcons();
    }
  }

  toggleBtn?.addEventListener('click', () => {
    if (!sidebar) return;
    const collapsed = sidebar.classList.toggle('collapsed');
    localStorage.setItem('syncra_sidebar_collapsed', collapsed);
    
    if (collapsed) {
      toggleBtn.setAttribute('title', 'Expand Sidebar');
      toggleBtn.innerHTML = '<i data-lucide="sidebar" style="transform: scaleX(-1);"></i>';
    } else {
      toggleBtn.setAttribute('title', 'Collapse Sidebar');
      toggleBtn.innerHTML = '<i data-lucide="sidebar"></i>';
    }
    if (window.lucide) window.lucide.createIcons();
  });
  
  // Keep local currentUser in sync across SPA modules
  document.addEventListener('syncra-profile-updated', (e) => {
    currentUser = e.detail;
  });

  window.syncraUpdateParticipants = updateActiveParticipantsUI;
  window.checkSessionAndRoute = checkSessionAndRoute; // Expose for SPA search routing
  await checkSessionAndRoute();
});

function getRoomIdFromUrl() {
  const match = window.location.pathname.match(/\/meet\/([a-zA-Z]{3}-[a-zA-Z]{4}-[a-zA-Z]{3})/);
  return match ? match[1].toLowerCase() : null;
}

function showScreen(screen) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  screen.classList.add('active');
}

async function checkSessionAndRoute() {
  const urlRoomId = getRoomIdFromUrl();
  const startTime = Date.now();
  
  // Reset splash UI to loading state
  const splashStatus = document.getElementById('splash-status');
  const splashLoader = document.getElementById('splash-loader');
  const splashError = document.getElementById('splash-error');
  const logoIcon = document.getElementById('splash-logo-icon');
  
  if (splashStatus) splashStatus.textContent = 'Securing connection & loading workspace...';
  if (splashLoader) splashLoader.classList.remove('hidden');
  if (splashError) splashError.classList.add('hidden');
  if (logoIcon) {
    logoIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-aperture">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="14.31" y1="8" x2="20.05" y2="17.94"></line>
      <line x1="9.69" y1="8" x2="21.17" y2="8"></line>
      <line x1="7.38" y1="12" x2="13.12" y2="2.06"></line>
      <line x1="9.69" y1="16" x2="3.95" y2="6.06"></line>
      <line x1="14.31" y1="16" x2="2.83" y2="16"></line>
      <line x1="16.62" y1="12" x2="10.88" y2="21.94"></line>
    </svg>`;
    logoIcon.className = 'logo-icon animate-pulse';
  }
  if (window.lucide) window.lucide.createIcons();

  try {
    const payload = await api.getMe();
    currentUser = payload.data.user;
    
    // Initialize Chat module
    chat.init(currentUser, socket);
    
    // Start notification polling now that the user is authenticated
    notifications.start();

    // Populate Profile Header UI
    profileName.textContent = currentUser.name;
    profileEmail.textContent = currentUser.email;
    welcomeName.textContent = currentUser.name;
    userAvatar.textContent = currentUser.name.charAt(0).toUpperCase();

    const dropdownUserAvatar = document.getElementById('dropdown-user-avatar');
    if (dropdownUserAvatar) {
      dropdownUserAvatar.textContent = currentUser.name.charAt(0).toUpperCase();
    }

    // Enforce a minimum splash duration (800ms) for a smooth, premium transition
    const elapsed = Date.now() - startTime;
    if (elapsed < 800) {
      await new Promise(resolve => setTimeout(resolve, 800 - elapsed));
    }

    if (!currentUser.onboarded) {
      showScreen(dashboardScreen);
      onboarding.init(currentUser, async (updatedUser) => {
        currentUser = updatedUser;
        document.dispatchEvent(new CustomEvent('syncra-profile-updated', { detail: updatedUser }));
        profileName.textContent = currentUser.name;
        welcomeName.textContent = currentUser.name;
        userAvatar.textContent = currentUser.name.charAt(0).toUpperCase();
        if (dropdownUserAvatar) {
          dropdownUserAvatar.textContent = currentUser.name.charAt(0).toUpperCase();
        }
        
        if (urlRoomId) {
          joinRoom(urlRoomId, currentUser.name, currentUser.preferredLanguage || 'en');
        } else {
          dashboard.init(currentUser, joinRoom);
          window.syncraJoinRoom = (roomId) => joinRoom(roomId, currentUser.name, currentUser.preferredLanguage || 'en');
          await navigateToHash(window.location.hash || '#dashboard');
        }
      });
      onboarding.show();
      return;
    }

    if (urlRoomId) {
      // Authenticated user direct navigation -> bypass join form
      joinRoom(urlRoomId, currentUser.name, currentUser.preferredLanguage || 'en');
    } else {
      showScreen(dashboardScreen);
      dashboard.init(currentUser, joinRoom);
      window.syncraJoinRoom = (roomId) => joinRoom(roomId, currentUser.name, currentUser.preferredLanguage || 'en');
      await navigateToHash(window.location.hash || '#dashboard');
    }
  } catch (err) {
    // Check if this is a network connectivity issue rather than a 401 Unauthenticated
    const isNetworkError = err.message !== 'Unauthenticated';

    if (isNetworkError) {
      console.error('[Auth] Network or server error during session check:', err);

      // Enforce a minimum splash duration (800ms) before showing error
      const elapsed = Date.now() - startTime;
      if (elapsed < 800) {
        await new Promise(resolve => setTimeout(resolve, 800 - elapsed));
      }

      // Update splash UI to show connection error
      if (splashStatus) splashStatus.textContent = 'Unable to connect to server. Please check your network.';
      if (splashLoader) splashLoader.classList.add('hidden');
      if (splashError) splashError.classList.remove('hidden');
      if (logoIcon) {
        logoIcon.innerHTML = '<i data-lucide="wifi-off"></i>';
        logoIcon.className = 'logo-icon error-icon';
      }
      if (window.lucide) window.lucide.createIcons();
      return; // Do not route to auth/dashboard
    }

    // Unauthenticated (session expired or not logged in)
    const elapsed = Date.now() - startTime;
    if (elapsed < 800) {
      await new Promise(resolve => setTimeout(resolve, 800 - elapsed));
    }

    if (urlRoomId) {
      document.getElementById('room-input').value = urlRoomId;
      showScreen(entryScreen);
      if (window.lucide) window.lucide.createIcons();
    } else {
      showScreen(authScreen);
      if (window.lucide) window.lucide.createIcons();
    }
  }
}

function initGlobalEvents() {
  // Guest Join Form
  document.getElementById('join-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const roomId = document.getElementById('room-input').value.trim().toLowerCase();
    const name = document.getElementById('name-input').value.trim();
    const lang = document.getElementById('lang-input').value;
    joinRoom(roomId, name, lang);
  });

  // Instant Meeting Button
  document.getElementById('btn-instant-meet').addEventListener('click', async () => {
    try {
      // Scheduled 1 min in future to pass Zod validation
      const payload = await api.createMeeting('Instant Meeting', new Date(Date.now() + 60000).toISOString());
      joinRoom(payload.data.meeting.id, currentUser.name, 'en');
    } catch (err) {
      ui.showToast(err.message, 'error');
    }
  });

  // Ended Screen Home Button
  document.getElementById('btn-ended-home').addEventListener('click', () => {
    window.history.pushState({}, '', '/');
    checkSessionAndRoute();
  });

  // Mobile Captions Panel Expand/Collapse Toggle
  const panelHeader = document.querySelector('.panel-header');
  const captionsPanel = document.querySelector('.captions-panel');
  if (panelHeader && captionsPanel) {
    panelHeader.addEventListener('click', () => {
      if (window.innerWidth < 768) {
        captionsPanel.classList.toggle('expanded');
        const expandIcon = document.getElementById('panel-expand-icon');
        if (expandIcon) {
          const isExpanded = captionsPanel.classList.contains('expanded');
          expandIcon.setAttribute('data-lucide', isExpanded ? 'chevron-down' : 'chevron-up');
          if (window.lucide) {
            window.lucide.createIcons();
          }
        }
      }
    });
  }

  // Theme Toggle Button
  const btnThemeToggle = document.getElementById('btn-theme-toggle');
  if (btnThemeToggle) {
    btnThemeToggle.addEventListener('click', () => {
      const currentTheme = localStorage.getItem('syncra_theme') === 'dark' ? 'dark' : 'light';
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      localStorage.setItem('syncra_theme', newTheme);
      
      // Apply theme via settings controller
      settings.applyTheme(newTheme);
      
      // Update selection in settings pane if present
      const themeSelect = document.getElementById('settings-theme');
      if (themeSelect) themeSelect.value = newTheme;
      
      ui.showToast(`Switched to ${newTheme === 'dark' ? 'Dark' : 'Light'} Mode`, 'success');
    });
  }

  // Call controls click bindings
  btnMute.addEventListener('click', handleMuteClick);
  btnCamera.addEventListener('click', handleCameraClick);
  btnLeave.addEventListener('click', handleLeaveClick);
  if (btnExport) {
    btnExport.addEventListener('click', handleExportClick);
  }
  if (btnToggleCaptions) {
    btnToggleCaptions.addEventListener('click', handleToggleCaptionsClick);
  }
  if (btnCopyMeetingLink) {
    btnCopyMeetingLink.addEventListener('click', () => {
      if (activeRoomId) ui.copyMeetingLink(activeRoomId);
    });
  }
  if (btnCopyMeetingLinkFooter) {
    btnCopyMeetingLinkFooter.addEventListener('click', () => {
      if (activeRoomId) ui.copyMeetingLink(activeRoomId);
    });
  }

  // Interactive Language Toggle in Header
  document.querySelector('.translation-mode').addEventListener('click', () => {
    // Swap languages
    const temp = userLang;
    userLang = targetLang;
    targetLang = temp;

    // Update UI Badges
    userLangBadge.textContent = userLang.toUpperCase();
    targetLangBadge.textContent = targetLang.toUpperCase();

    // Restart Speech Recognition with new language locale
    speech.stop();
    speech.init(userLang, onFinalTranscript, onInterimTranscript);

    ui.showToast(`Language switched: Speaking ${userLang.toUpperCase()}`, 'info');
  });

  // Profile Dropdown Toggle & Actions
  const profileTrigger = document.getElementById('profile-trigger');
  const profileDropdown = document.getElementById('profile-dropdown');
  const notificationsDropdown = document.getElementById('notifications-dropdown');
  
  if (profileTrigger && profileDropdown) {
    profileTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isActive = profileDropdown.classList.toggle('active');
      profileTrigger.classList.toggle('active', isActive);
      profileTrigger.setAttribute('aria-expanded', isActive ? 'true' : 'false');
      
      // Close notifications dropdown if open
      if (notificationsDropdown) {
        notificationsDropdown.classList.remove('active');
      }
    });
    
    document.addEventListener('click', (e) => {
      if (!profileTrigger.contains(e.target) && !profileDropdown.contains(e.target)) {
        profileDropdown.classList.remove('active');
        profileTrigger.classList.remove('active');
        profileTrigger.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // Profile Dropdown Items Actions
  const btnProfileSettings = document.getElementById('btn-profile-settings');
  if (btnProfileSettings) {
    btnProfileSettings.addEventListener('click', (e) => {
      e.preventDefault();
      profileDropdown?.classList.remove('active');
      profileTrigger?.classList.remove('active');
      profileTrigger?.setAttribute('aria-expanded', 'false');
      document.getElementById('btn-sidebar-settings')?.click();
    });
  }

  const btnProfileSupport = document.getElementById('btn-profile-support');
  if (btnProfileSupport) {
    btnProfileSupport.addEventListener('click', (e) => {
      e.preventDefault();
      profileDropdown?.classList.remove('active');
      profileTrigger?.classList.remove('active');
      profileTrigger?.setAttribute('aria-expanded', 'false');
      ui.showToast('Support is available at support@syncra.io', 'info');
    });
  }

  const btnLogout = document.getElementById('btn-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        await api.signOut();
        ui.showToast('Logged out successfully', 'success');
        window.location.reload();
      } catch (err) {
        console.error('Logout error:', err);
        ui.showToast('Failed to log out. Please try again.', 'error');
      }
    });
  }

  // Splash Retry Button
  const btnSplashRetry = document.getElementById('btn-splash-retry');
  if (btnSplashRetry) {
    btnSplashRetry.addEventListener('click', () => {
      checkSessionAndRoute();
    });
  }
}

// ==========================================
// 2. JOIN ROOM FLOW
// ==========================================

async function joinRoom(roomId, name, lang) {
  if (!roomId) return;
  
  // Warm up and unlock AudioContext synchronously inside user gesture tick
  audioStreamer.prepare();

  roomId = roomId.toLowerCase();

  // 1. Verify meeting status on the backend first (Zero-Trust)
  try {
    const payload = await api.verifyMeeting(roomId);
    currentMeeting = payload.data.meeting;

    if (currentMeeting.status === 'completed') {
      showScreen(document.getElementById('ended-screen'));
      if (window.lucide) window.lucide.createIcons();
      // Reset URL to home
      window.history.pushState({}, '', '/');
      return;
    }
  } catch (err) {
    ui.showToast(err.message || 'Meeting room not found.', 'error');
    window.history.pushState({}, '', '/');
    checkSessionAndRoute();
    return;
  }

  activeRoomId = roomId;
  userName = name;

  // Intercept call entrance with the Pre-Flight Green Room check!
  greenRoom.init(roomId, name, currentUser, async (selectedSettings) => {
    userLang = selectedSettings.speakLang;
    targetLang = selectedSettings.translateLang;
    liveTranscripts = []; // Reset transcript cache for new call

    // Silently update browser URL without reloading
    window.history.pushState({}, '', `/meet/${roomId}`);

    // Update Call Header
    roomTitle.textContent = `#${roomId}`;
    userLangBadge.textContent = userLang.toUpperCase();
    targetLangBadge.textContent = targetLang.toUpperCase();

    // Reset captions panel visibility, position, and button state on join
    const captionsPanel = document.querySelector('.captions-panel');
    if (captionsPanel) {
      captionsPanel.classList.remove('hidden');
      captionsPanel.style.top = '';
      captionsPanel.style.left = '';
      captionsPanel.style.bottom = '';
      captionsPanel.style.right = '';
    }
    if (btnToggleCaptions) {
      btnToggleCaptions.className = 'ctrl-btn active';
    }

    try {
      const mediaEngine = currentMeeting.mediaEngine;

      // 2. Connect to the media engine (handles local stream and room connection)
      await webrtc.connect(roomId, userName, mediaEngine, socket);

      // 2b. Start server-side STT audio streaming (works on all platforms including mobile)
      try {
        const localAudioStream = webrtc.getLocalAudioStream();
        if (localAudioStream) {
          speech.setServerSTTActive(true);
          audioStreamer.init(socket, roomId, userLang, userName, targetLang);
          await audioStreamer.start(localAudioStream);
          console.log('[JoinRoom] Server-side STT audio streaming started.');
        } else {
          console.warn('[JoinRoom] No local audio stream available, falling back to Web Speech API.');
        }
      } catch (sttErr) {
        console.warn('[JoinRoom] Server-side STT failed to start, falling back to Web Speech API:', sttErr);
      }

      // 3. Start speech-to-text translation
      speech.init(userLang, onFinalTranscript, onInterimTranscript);

      // 4. Switch screens
      greenRoom.hide();
      showScreen(callScreen);
      updateActiveParticipantsUI();
      if (window.lucide) {
        window.lucide.createIcons();
      }
    } catch (err) {
      console.error('Error joining meeting:', err);
      greenRoom.hide();
      ui.showToast('Could not access media devices or connect to room.', 'error');
    }
  });
}

// ==========================================
// 3. SPEECH INTERACTION CALLBACKS
// ==========================================

function onFinalTranscript(text) {
  console.log(`Final Text: "${text}"`);
  socket.emit('send-transcript', {
    roomId: activeRoomId,
    text,
    sourceLang: userLang,
    targetLang,
    speakerName: userName
  });
  removeInterimCaption();
}

function onInterimTranscript(text) {
  let interimCard = document.getElementById('interim-caption-card');
  if (!interimCard) {
    interimCard = document.createElement('div');
    interimCard.id = 'interim-caption-card';
    interimCard.className = 'caption-card interim';
    captionStream.appendChild(interimCard);
  }

  interimCard.innerHTML = `
    <div class="caption-meta">
      <span class="speaker-name">${ui.escapeHtml(userName)} (typing...)</span>
    </div>
    <p class="original" style="opacity: 0.7;">${ui.escapeHtml(text)}</p>
  `;
  captionStream.scrollTop = captionStream.scrollHeight;
}

function removeInterimCaption() {
  const interimCard = document.getElementById('interim-caption-card');
  if (interimCard) interimCard.remove();
}

// ==========================================
// 4. SOCKET.IO EVENT HANDLERS
// ==========================================

// Fired when the host ends the call for everyone
socket.on('meeting-ended', () => {
  console.log('Host has ended the meeting. Leaving call.');
  ui.showToast('The host has ended this meeting.', 'info');
  webrtc.cleanup();
  speech.stop();
  audioStreamer.stop();
  socket.disconnect();
  socket.connect(); // Reconnect to refresh socket.id for next session
  
  // Clear call captions
  captionStream.innerHTML = `
    <div class="welcome-caption">
      <p class="translated">Welcome to Syncra. Speak naturally—captions and translations will appear here in real-time.</p>
    </div>
  `;

  // Show dedicated ended screen
  showScreen(document.getElementById('ended-screen'));
  if (window.lucide) window.lucide.createIcons();
});

socket.on('user-left', (peerId) => {
  const callScreen = document.getElementById('call-screen');
  if (callScreen && callScreen.classList.contains('active') && activeRoomId) {
    ui.showToast('Participant left the call.', 'info');
  }
});

  socket.on('interim-caption', ({ text, speakerName: name }) => {
    let interimCard = document.getElementById('interim-caption-card');
    if (!interimCard) {
      interimCard = document.createElement('div');
      interimCard.id = 'interim-caption-card';
      interimCard.className = 'caption-card interim';
      captionStream.appendChild(interimCard);
    }
    interimCard.innerHTML = `
      <div class="caption-meta">
        <div style="display: flex; align-items: center; gap: 8px;">
          <strong class="speaker-name" style="color: var(--primary); text-transform: uppercase;">${name}</strong>
          <span class="interim-badge">speaking...</span>
        </div>
      </div>
      <p class="original">${text}</p>
    `;
    captionStream.scrollTop = captionStream.scrollHeight;
  });

// Receive translated captions from server
socket.on('new-caption', (data) => {
  removeInterimCaption();

  // Cache segment for transcript export
  const timestampStr = new Date().toLocaleTimeString();
  liveTranscripts.push({
    speakerName: data.speakerName,
    originalText: data.originalText,
    translatedText: data.translatedText,
    sourceLang: data.sourceLang,
    targetLang: data.targetLang,
    timestamp: timestampStr
  });

  // Render Caption Card
  const card = document.createElement('div');
  card.className = 'caption-card';
  const isMe = data.speakerId === socket.id;
  card.classList.add(isMe ? 'me' : 'them');

  card.innerHTML = `
    <div class="caption-meta">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span class="speaker-name">${ui.escapeHtml(data.speakerName)}</span>
        <span class="caption-lang-badge">${ui.escapeHtml(data.sourceLang.toUpperCase())}</span>
      </div>
      <span class="latency-badge">⚡ ${data.latency}s</span>
    </div>
    <p class="original">${ui.escapeHtml(data.originalText)}</p>
    <p class="translated shimmer">${ui.escapeHtml(data.translatedText)}</p>
  `;

  captionStream.appendChild(card);
  
  setTimeout(() => {
    const transText = card.querySelector('.translated');
    if (transText) transText.classList.remove('shimmer');
  }, 1500);

  captionStream.scrollTop = captionStream.scrollHeight;

  // Refresh active participants UI to catch detected spoken languages
  updateActiveParticipantsUI();
});

// ==========================================
// 5. CALL CONTROL HANDLERS
// ==========================================

function handleMuteClick() {
  isMuted = !isMuted;
  webrtc.toggleMute(isMuted);
  speech.setMuted(isMuted);

  if (isMuted) {
    audioStreamer.stop();
    btnMute.classList.remove('active');
    btnMute.classList.add('muted');
    btnMute.innerHTML = '<i data-lucide="mic-off"></i>';
    ui.showToast('Microphone muted', 'warning');
  } else {
    btnMute.classList.add('active');
    btnMute.classList.remove('muted');
    btnMute.innerHTML = '<i data-lucide="mic"></i>';
    ui.showToast('Microphone unmuted', 'info');

    // Wait for the new audio track to be published by WebRTC/LiveKit
    setTimeout(async () => {
      try {
        const localAudioStream = webrtc.getLocalAudioStream();
        if (localAudioStream) {
          audioStreamer.init(socket, activeRoomId, userLang, userName, targetLang);
          await audioStreamer.start(localAudioStream);
          console.log('[MuteClick] STT streaming restarted with fresh audio track.');
        } else {
          console.warn('[MuteClick] No active audio track found after unmute.');
        }
      } catch (err) {
        console.error('[MuteClick] Failed to restart STT streaming on unmute:', err);
      }
    }, 450);
  }
  lucide.createIcons();
}

function handleCameraClick() {
  isCameraOff = !isCameraOff;
  webrtc.toggleCamera(isCameraOff);

  if (isCameraOff) {
    btnCamera.classList.remove('active');
    btnCamera.innerHTML = '<i data-lucide="video-off"></i>';
    ui.showToast('Camera turned off', 'warning');
  } else {
    btnCamera.classList.add('active');
    btnCamera.innerHTML = '<i data-lucide="video"></i>';
    ui.showToast('Camera turned on', 'info');
  }
  lucide.createIcons();
}

function handleToggleCaptionsClick() {
  const captionsPanel = document.querySelector('.captions-panel');
  if (captionsPanel) {
    const isHidden = captionsPanel.classList.toggle('hidden');
    if (isHidden) {
      btnToggleCaptions.classList.remove('active');
      ui.showToast('Live translation captions hidden', 'warning');
    } else {
      btnToggleCaptions.classList.add('active');
      ui.showToast('Live translation captions shown', 'info');
    }
  }
}

async function handleLeaveClick() {
  // If current user is the host, ask if they want to end the meeting for everyone
  if (currentUser && currentMeeting && currentMeeting.hostId === currentUser.id) {
    const endAll = await ui.showConfirm('End Meeting', 'Do you want to end this meeting for all participants? (Click Cancel to just leave yourself)');
    if (endAll) {
      try {
        await api.endMeeting(activeRoomId);
        return; // The socket 'meeting-ended' event will handle the cleanup and redirect
      } catch (err) {
        console.error('Failed to end meeting:', err);
        ui.showToast('Failed to end meeting.', 'error');
      }
    }
  }
  
  leaveCallLocally();
}

function leaveCallLocally() {
  webrtc.cleanup();
  speech.stop();
  audioStreamer.stop();

  socket.disconnect();
  socket.connect(); // Reconnect to refresh socket.id for next call

  captionStream.innerHTML = `
    <div class="welcome-caption">
      <p class="translated">Welcome to Syncra. Speak naturally—captions and translations will appear here in real-time.</p>
    </div>
  `;

  // Reset controls state
  isMuted = false;
  isCameraOff = false;
  btnMute.className = 'ctrl-btn active';
  btnCamera.className = 'ctrl-btn active';
  btnMute.innerHTML = '<i data-lucide="mic"></i>';
  btnCamera.innerHTML = '<i data-lucide="video"></i>';

  const captionsPanel = document.querySelector('.captions-panel');
  if (captionsPanel) {
    captionsPanel.classList.remove('hidden');
    captionsPanel.style.top = '';
    captionsPanel.style.left = '';
    captionsPanel.style.bottom = '';
    captionsPanel.style.right = '';
  }
  if (btnToggleCaptions) {
    btnToggleCaptions.className = 'ctrl-btn active';
  }

  // Navigate back home
  window.history.pushState({}, '', '/');
  checkSessionAndRoute();
  lucide.createIcons();
}

function handleExportClick() {
  const title = roomTitle.textContent.replace('#', '');
  ui.exportTranscriptFile(title, liveTranscripts);
}

async function navigateToHash(hash) {
  const menuItems = document.querySelectorAll('.sidebar-menu .menu-item, #btn-sidebar-settings');
  const contentViews = document.querySelectorAll('.content-view');

  // Strip leading '#' and split to get sub-route parts (e.g. 'chat/123' -> ['chat', '123'])
  const hashVal = (hash || '#dashboard').toLowerCase();
  const routeParts = hashVal.replace('#', '').split('/');
  const tabName = routeParts[0] || 'dashboard';
  const subParam = routeParts[1] || null;

  // Close mobile sheet if open
  const mobileSheet = document.getElementById('mobile-nav-sheet');
  if (mobileSheet && mobileSheet.classList.contains('active')) {
    mobileSheet.classList.remove('active');
  }

  // Stop camera preview if navigating AWAY from settings
  if (tabName !== 'settings' && window.syncraStopCameraPreview) {
    window.syncraStopCameraPreview();
  }

  let buttonId = 'btn-sidebar-dashboard';
  let targetViewId = 'view-dashboard';

  if (tabName === 'calendar') { buttonId = 'btn-sidebar-calendar'; targetViewId = 'view-calendar'; }
  else if (tabName === 'projects') { buttonId = 'btn-sidebar-projects'; targetViewId = 'view-projects'; }
  else if (tabName === 'tm') { buttonId = 'btn-sidebar-tm'; targetViewId = 'view-tm'; }
  else if (tabName === 'glossary') { buttonId = 'btn-sidebar-glossary'; targetViewId = 'view-glossary'; }
  else if (tabName === 'analytics') { buttonId = 'btn-sidebar-analytics'; targetViewId = 'view-analytics'; }
  else if (tabName === 'chat') { buttonId = 'btn-sidebar-chat'; targetViewId = 'view-chat'; }
  else if (tabName === 'settings') { buttonId = 'btn-sidebar-settings'; targetViewId = 'view-settings'; }

  // Update active sidebar item
  menuItems.forEach(mi => {
    if (mi.id === buttonId) {
      mi.classList.add('active');
    } else {
      mi.classList.remove('active');
    }
  });

  // Switch active view
  contentViews.forEach(view => {
    if (view.id === targetViewId) {
      view.classList.add('active');
    } else {
      view.classList.remove('active');
    }
  });

  // Fetch fresh data dynamically when switching tabs
  try {
    if (targetViewId === 'view-dashboard') {
      await dashboard.refresh();
    } else if (targetViewId === 'view-calendar') {
      await calendar.loadAndRender();
    } else if (targetViewId === 'view-projects') {
      await projects.loadAndRender();
    } else if (targetViewId === 'view-tm') {
      await tm.loadAndRender();
    } else if (targetViewId === 'view-glossary') {
      await glossary.loadTerms();
    } else if (targetViewId === 'view-analytics') {
      await analytics.loadAndRender();
    } else if (targetViewId === 'view-chat') {
      await chat.refreshChats();
      if (subParam) {
        await chat.selectChat(subParam);
      }
    } else if (targetViewId === 'view-settings') {
      await settings.show();
    }
  } catch (err) {
    console.error('[Navigation] Error loading view data:', err);
  }
}

function initSidebarNavigation() {
  const menuItems = document.querySelectorAll('.sidebar-menu .menu-item, #btn-sidebar-settings');

  menuItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();

      // Close mobile sheet if open
      const mobileSheet = document.getElementById('mobile-nav-sheet');
      if (mobileSheet && mobileSheet.classList.contains('active')) {
        mobileSheet.classList.remove('active');
      }

      const id = item.id;
      if (id === 'btn-sidebar-more') {
        if (mobileSheet) {
          mobileSheet.classList.add('active');
        }
        return;
      }

      let targetHash = 'dashboard';

      if (id === 'btn-sidebar-calendar') targetHash = 'calendar';
      else if (id === 'btn-sidebar-projects') targetHash = 'projects';
      else if (id === 'btn-sidebar-tm') targetHash = 'tm';
      else if (id === 'btn-sidebar-glossary') targetHash = 'glossary';
      else if (id === 'btn-sidebar-analytics') targetHash = 'analytics';
      else if (id === 'btn-sidebar-chat') targetHash = 'chat';
      else if (id === 'btn-sidebar-settings') targetHash = 'settings';

      window.location.hash = targetHash;
    });
  });

  // Wire up the Dashboard's "VIEW ALL CALENDAR" link to trigger the Calendar sidebar click
  const btnViewCalendar = document.getElementById('btn-view-calendar');
  if (btnViewCalendar) {
    btnViewCalendar.addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById('btn-sidebar-calendar')?.click();
    });
  }

  // Initialize draggable captions panel for mobile
  const captionsPanel = document.querySelector('.captions-panel');
  const panelHeader = document.querySelector('.panel-header');
  if (captionsPanel && panelHeader) {
    makeElementDraggable(captionsPanel, panelHeader);
  }

  // Mobile Bottom Sheet Navigation handling
  const mobileSheet = document.getElementById('mobile-nav-sheet');
  const btnCloseMobileSheet = document.getElementById('btn-close-mobile-sheet');
  
  function closeMobileSheet() {
    if (mobileSheet) {
      mobileSheet.classList.remove('active');
    }
  }

  if (btnCloseMobileSheet) {
    btnCloseMobileSheet.addEventListener('click', closeMobileSheet);
  }
  if (mobileSheet) {
    mobileSheet.addEventListener('click', (e) => {
      if (e.target === mobileSheet) {
        closeMobileSheet();
      }
    });
  }

  const sheetItems = [
    { btnId: 'btn-sheet-tm', targetId: 'btn-sidebar-tm' },
    { btnId: 'btn-sheet-glossary', targetId: 'btn-sidebar-glossary' },
    { btnId: 'btn-sheet-analytics', targetId: 'btn-sidebar-analytics' },
    { btnId: 'btn-sheet-settings', targetId: 'btn-sidebar-settings' }
  ];

  sheetItems.forEach(itemConfig => {
    const btn = document.getElementById(itemConfig.btnId);
    btn?.addEventListener('click', () => {
      closeMobileSheet();
      const targetMenu = document.getElementById(itemConfig.targetId);
      if (targetMenu) {
        targetMenu.click();
        // Overwrite active highlight for mobile bottom navigation:
        // make the "More" item active instead of the hidden original items.
        if (window.innerWidth <= 767) {
          menuItems.forEach(mi => mi.classList.remove('active'));
          document.getElementById('btn-sidebar-more')?.classList.add('active');
        }
      }
    });
  });

  const btnSheetSupport = document.getElementById('btn-sheet-support');
  btnSheetSupport?.addEventListener('click', () => {
    closeMobileSheet();
    ui.showToast('Support is available at support@syncra.io', 'info');
  });
}

// Reusable Dragging Orchestrator for absolute-positioned elements (Mobile Layouts)
function makeElementDraggable(el, handle) {
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  
  handle.addEventListener('mousedown', dragMouseDown);
  handle.addEventListener('touchstart', dragTouchStart, { passive: false });

  function dragMouseDown(e) {
    if (window.innerWidth > 767) return; // Only draggable on mobile/tablet
    e.preventDefault();
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.addEventListener('mouseup', closeDragElement);
    document.addEventListener('mousemove', elementDrag);
  }

  function dragTouchStart(e) {
    if (window.innerWidth > 767) return; // Only draggable on mobile/tablet
    const touch = e.touches[0];
    pos3 = touch.clientX;
    pos4 = touch.clientY;
    document.addEventListener('touchend', closeDragElement);
    document.addEventListener('touchmove', elementTouchDrag, { passive: false });
  }

  function elementDrag(e) {
    e.preventDefault();
    calculateAndPosition(e.clientX, e.clientY);
  }

  function elementTouchDrag(e) {
    e.preventDefault();
    const touch = e.touches[0];
    calculateAndPosition(touch.clientX, touch.clientY);
  }

  function calculateAndPosition(clientX, clientY) {
    pos1 = pos3 - clientX;
    pos2 = pos4 - clientY;
    pos3 = clientX;
    pos4 = clientY;

    const newTop = el.offsetTop - pos2;
    const newLeft = el.offsetLeft - pos1;

    // Bound clamping (keep within viewport)
    const maxTop = window.innerHeight - el.offsetHeight - 10;
    const maxLeft = window.innerWidth - el.offsetWidth - 10;
    
    el.style.top = Math.max(10, Math.min(newTop, maxTop)) + "px";
    el.style.left = Math.max(10, Math.min(newLeft, maxLeft)) + "px";
    el.style.bottom = "auto";
    el.style.right = "auto";
  }

  function closeDragElement() {
    document.removeEventListener('mouseup', closeDragElement);
    document.removeEventListener('mousemove', elementDrag);
    document.removeEventListener('touchend', closeDragElement);
    document.removeEventListener('touchmove', elementTouchDrag);
  }
}

function updateActiveParticipantsUI() {
  const countEl = document.getElementById('active-participants-count');
  const listEl = document.getElementById('call-participants-list');
  if (!listEl) return;

  const participants = webrtc.getParticipantsList(userName);
  if (countEl) {
    countEl.textContent = participants.length;
  }

  listEl.innerHTML = '';
  participants.forEach(p => {
    const row = document.createElement('div');
    row.className = 'call-participant-row';
    
    // Determine languages
    let langTagText = 'Active';
    if (p.isMe) {
      langTagText = `Spoken: ${userLang.toUpperCase()} &middot; Heard: ${targetLang.toUpperCase()}`;
    } else {
      // Find if this peer has sent any transcripts
      const peerTrans = liveTranscripts.find(t => t.speakerName === p.name);
      if (peerTrans) {
        langTagText = `Spoken: ${peerTrans.sourceLang.toUpperCase()} &middot; Heard: ${peerTrans.targetLang.toUpperCase()}`;
      } else {
        langTagText = `Connected`;
      }
    }

    row.innerHTML = `
      <div class="call-participant-info">
        <span class="call-participant-dot"></span>
        <span class="call-participant-name">${ui.escapeHtml(p.name)} ${p.isMe ? '(You)' : ''}</span>
      </div>
      <span class="call-participant-tag">${langTagText}</span>
    `;
    listEl.appendChild(row);
  });
}
