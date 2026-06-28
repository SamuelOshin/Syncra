// ==========================================
// SYNCRA CLIENT ORCHESTRATOR & ENTRY POINT
// ==========================================

import { api } from './api.js';
import { ui } from './ui.js';
import { auth } from './auth.js';
import { dashboard } from './dashboard.js';
import { webrtc } from './webrtc.js';
import { speech } from './speech.js';
import { glossary } from './glossary.js';
import { settings } from './settings.js';
import { tm } from './tm.js';
import { search } from './search.js';
import { notifications } from './notifications.js';
import { projects } from './projects.js';
import { analytics } from './analytics.js';
import { calendar } from './calendar.js';

const socket = io();

// UI Screens
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
  window.checkSessionAndRoute = checkSessionAndRoute; // Expose for SPA search routing
  await checkSessionAndRoute();
});

function getRoomIdFromUrl() {
  const match = window.location.pathname.match(/\/meet\/([a-z]{3}-[a-z]{4}-[a-z]{3})/);
  return match ? match[1] : null;
}

function showScreen(screen) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  screen.classList.add('active');
}

async function checkSessionAndRoute() {
  const urlRoomId = getRoomIdFromUrl();
  
  try {
    const payload = await api.getMe();
    currentUser = payload.data.user;
    
    // Populate Profile Header UI
    profileName.textContent = currentUser.name;
    profileEmail.textContent = currentUser.email;
    welcomeName.textContent = currentUser.name;
    userAvatar.textContent = currentUser.name.charAt(0).toUpperCase();

    if (urlRoomId) {
      // Authenticated user direct navigation -> bypass join form
      joinRoom(urlRoomId, currentUser.name, 'en');
    } else {
      showScreen(dashboardScreen);
      dashboard.init(currentUser, joinRoom);
      window.syncraJoinRoom = (roomId) => joinRoom(roomId, currentUser.name, 'en');
      await dashboard.refresh();
    }
  } catch (err) {
    // Unauthenticated
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

  // Call controls click bindings
  btnMute.addEventListener('click', handleMuteClick);
  btnCamera.addEventListener('click', handleCameraClick);
  btnLeave.addEventListener('click', handleLeaveClick);
  if (btnExport) {
    btnExport.addEventListener('click', handleExportClick);
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
}

// ==========================================
// 2. JOIN ROOM FLOW
// ==========================================

async function joinRoom(roomId, name, lang) {
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
  userLang = lang;
  targetLang = userLang === 'en' ? 'fr' : 'en';
  liveTranscripts = []; // Reset transcript cache for new call

  // Silently update browser URL without reloading
  window.history.pushState({}, '', `/meet/${roomId}`);

  // Update Call Header
  roomTitle.textContent = `#${roomId}`;
  userLangBadge.textContent = userLang.toUpperCase();
  targetLangBadge.textContent = targetLang.toUpperCase();

  try {
    const mediaEngine = currentMeeting.mediaEngine;

    // 2. Connect to the media engine (handles local stream and room connection)
    await webrtc.connect(roomId, userName, mediaEngine, socket);

    // 3. Start speech-to-text translation
    speech.init(userLang, onFinalTranscript, onInterimTranscript);

    // 4. Switch screens
    showScreen(callScreen);
    if (window.lucide) {
      window.lucide.createIcons();
    }
  } catch (err) {
    console.error('Error joining meeting:', err);
    ui.showToast('Could not access media devices or connect to room.', 'error');
  }
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
  webrtc.cleanup();
  speech.stop();
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
  ui.showToast('Participant left the call.', 'info');
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
      <span class="speaker-name">${ui.escapeHtml(data.speakerName)}</span>
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
});

// ==========================================
// 5. CALL CONTROL HANDLERS
// ==========================================

function handleMuteClick() {
  isMuted = !isMuted;
  webrtc.toggleMute(isMuted);
  speech.setMuted(isMuted);

  if (isMuted) {
    btnMute.classList.remove('active');
    btnMute.classList.add('muted');
    btnMute.innerHTML = '<i data-lucide="mic-off"></i>';
    ui.showToast('Microphone muted', 'warning');
  } else {
    btnMute.classList.add('active');
    btnMute.classList.remove('muted');
    btnMute.innerHTML = '<i data-lucide="mic"></i>';
    ui.showToast('Microphone unmuted', 'info');
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

  // Navigate back home
  window.history.pushState({}, '', '/');
  checkSessionAndRoute();
  lucide.createIcons();
}

function handleExportClick() {
  const title = roomTitle.textContent.replace('#', '');
  ui.exportTranscriptFile(title, liveTranscripts);
}

function initSidebarNavigation() {
  const menuItems = document.querySelectorAll('.sidebar-menu .menu-item');
  const contentViews = document.querySelectorAll('.content-view');

  menuItems.forEach(item => {
    // Settings is still a modal (transient action), let settings.js handle it
    if (item.id === 'btn-sidebar-settings') return;

    item.addEventListener('click', async (e) => {
      e.preventDefault();

      const id = item.id;
      let targetViewId = 'view-dashboard';

      if (id === 'btn-sidebar-calendar') targetViewId = 'view-calendar';
      else if (id === 'btn-sidebar-projects') targetViewId = 'view-projects';
      else if (id === 'btn-sidebar-tm') targetViewId = 'view-tm';
      else if (id === 'btn-sidebar-glossary') targetViewId = 'view-glossary';
      else if (id === 'btn-sidebar-analytics') targetViewId = 'view-analytics';

      // Update active sidebar item
      menuItems.forEach(mi => mi.classList.remove('active'));
      item.classList.add('active');

      // Switch active view
      contentViews.forEach(view => {
        view.classList.remove('active');
        if (view.id === targetViewId) {
          view.classList.add('active');
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
        }
      } catch (err) {
        console.error('[Navigation] Error loading view data:', err);
      }
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
}
