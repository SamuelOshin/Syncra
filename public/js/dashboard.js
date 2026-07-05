// ==========================================
// SYNCRA DASHBOARD CONTROLLER MODULE
// ==========================================

import { api } from './api.js';
import { ui } from './ui.js';

// DOM Elements
const upcomingList = document.getElementById('upcoming-list');
const vaultList = document.getElementById('vault-list');

const scheduleModal = document.getElementById('schedule-modal');
const btnCloseSchedule = document.getElementById('btn-close-schedule');
const btnCancelSchedule = document.getElementById('btn-cancel-schedule');
const scheduleForm = document.getElementById('schedule-form');

const transcriptModal = document.getElementById('transcript-modal');
const btnCloseTranscript = document.getElementById('btn-close-transcript');
const transcriptDialogues = document.getElementById('transcript-dialogues');
const transcriptSearch = document.getElementById('transcript-search');
const transcriptModalTitle = document.getElementById('transcript-modal-title');

let activeMeetings = [];
let vaultMeetings = [];
let allTranscripts = []; // Cache for live search

// Module-level auth context (set once in init, used by refresh/render)
let _currentUser = null;
let _onJoinRoom = null;

export const dashboard = {
  init(currentUser, onJoinRoom) {
    // 1. Schedule Meeting Triggers (Sidebar, Dashboard Card & Calendar Link)
    const btnSidebarSchedule = document.getElementById('btn-sidebar-schedule');
    if (btnSidebarSchedule) {
      btnSidebarSchedule.addEventListener('click', () => ui.toggleModal(scheduleModal, true));
    }

    const btnOpenSchedule = document.getElementById('btn-open-schedule');
    if (btnOpenSchedule) {
      btnOpenSchedule.addEventListener('click', () => ui.toggleModal(scheduleModal, true));
    }

    // 2. Schedule Modal Events
    const closeSchedule = () => ui.toggleModal(scheduleModal, false);
    if (btnCloseSchedule) btnCloseSchedule.addEventListener('click', closeSchedule);
    if (btnCancelSchedule) btnCancelSchedule.addEventListener('click', closeSchedule);

    if (scheduleForm) {
      scheduleForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('schedule-title').value.trim();
        const localDate = document.getElementById('schedule-date').value;
        const scheduledAt = new Date(localDate).toISOString();
        const projectId = document.getElementById('schedule-project').value || null;

        try {
          await api.createMeeting(title, scheduledAt, projectId);
          closeSchedule();
          document.getElementById('schedule-title').value = '';
          document.getElementById('schedule-project').value = '';
          ui.showToast('Meeting scheduled successfully!', 'success');
          await this.refresh(currentUser, onJoinRoom);
        } catch (err) {
          console.error('Scheduling error:', err);
          ui.showToast(err.message, 'error');
        }
      });
    }

    // 3. Transcript Viewer Events
    if (btnCloseTranscript) {
      btnCloseTranscript.addEventListener('click', () => ui.toggleModal(transcriptModal, false));
    }
    
    if (transcriptSearch) {
      transcriptSearch.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        if (!query) {
          this.renderTranscripts(allTranscripts);
          return;
        }
        const filtered = allTranscripts.filter(t => 
          t.speakerName.toLowerCase().includes(query) || 
          t.originalText.toLowerCase().includes(query) || 
          t.translatedText.toLowerCase().includes(query)
        );
        this.renderTranscripts(filtered);
      });
    }

    // 4. Vault Search & Bulk Export Events
    const vaultSearch = document.getElementById('vault-search');
    if (vaultSearch) {
      vaultSearch.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        if (!query) {
          this.renderVaultTable(vaultMeetings);
          return;
        }
        const filtered = vaultMeetings.filter(m => 
          m.title.toLowerCase().includes(query) || 
          m.id.toLowerCase().includes(query)
        );
        this.renderVaultTable(filtered);
      });
    }

    const btnDownloadAll = document.getElementById('btn-download-all');
    if (btnDownloadAll) {
      btnDownloadAll.addEventListener('click', async () => {
        if (vaultMeetings.length === 0) {
          ui.showToast('No transcripts available to download', 'warning');
          return;
        }
        try {
          ui.showToast('Preparing bulk download...', 'info');
          let bulkText = `SYNCRA TRANSCRIPT VAULT BULK EXPORT\nGenerated on: ${new Date().toLocaleString()}\n========================================\n\n`;
          
          for (const meeting of vaultMeetings) {
            const payload = await api.getTranscript(meeting.id);
            const transcripts = payload.data.transcripts;
            if (transcripts && transcripts.length > 0) {
              bulkText += `MEETING: ${meeting.title}\nID: ${meeting.id}\nDATE: ${new Date(meeting.scheduledAt).toLocaleString()}\n----------------------------------------\n`;
              bulkText += transcripts.map(t => {
                const time = new Date(t.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                return `[${time}] ${t.speakerName}: ${t.originalText} (➔ ${t.translatedText})`;
              }).join('\n');
              bulkText += `\n\n========================================\n\n`;
            }
          }

          const blob = new Blob([bulkText], { type: 'text/plain;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `Syncra_Bulk_Transcripts_${new Date().toISOString().slice(0,10)}.txt`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          ui.showToast('All transcripts downloaded', 'success');
        } catch (err) {
          console.error('[Bulk Download] Error:', err);
          ui.showToast('Failed to complete bulk download', 'error');
        }
      });
    }
    // Store auth context so refresh() can use it without extra args
    _currentUser = currentUser;
    _onJoinRoom = onJoinRoom;

    // Initialize Push Notification Banner
    this.initPushBanner();
  },
 
  async refresh() {
    try {
      const payload = await api.getMeetings();
      const meetings = payload.data.meetings;
 
      activeMeetings = meetings.filter(m => m.status === 'scheduled');
      vaultMeetings = meetings.filter(m => m.status === 'completed' || new Date(m.scheduledAt) < new Date());
 
      this.renderUpcoming(activeMeetings, _currentUser, _onJoinRoom);
      this.renderVault(vaultMeetings);
    } catch (err) {
      console.error('Error refreshing dashboard:', err);
    }
  },
 
  renderUpcoming(meetings, currentUser, onJoinRoom) {
    if (!upcomingList) return;
 
    if (meetings.length === 0) {
      upcomingList.innerHTML = `
        <div class="list-empty">
          <i data-lucide="calendar-days"></i>
          <p>No upcoming meetings scheduled.</p>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }
 
    upcomingList.innerHTML = meetings.map(meeting => {
      const date = new Date(meeting.scheduledAt);
      const monthStr = date.toLocaleDateString(undefined, { month: 'short' }).toUpperCase();
      const dayStr = date.toLocaleDateString(undefined, { day: '2-digit' });
      const timeString = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
      
      // Calculate display end time (default to +1 hour)
      const endDate = new Date(date.getTime() + 60 * 60 * 1000);
      const endTimeString = endDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
 
      return `
        <div class="meeting-row-item">
          <div class="calendar-badge">
            <span class="cal-month">${monthStr}</span>
            <span class="cal-day">${dayStr}</span>
          </div>
          <div class="meeting-info">
            <span class="meeting-title" title="${ui.escapeHtml(meeting.title)}">${ui.escapeHtml(meeting.title)}</span>
            <div class="meeting-meta">
              <span class="language-direction-badge">EN <i data-lucide="arrow-right" class="icon-xxs"></i> FR</span>
              <span class="meeting-time">
                <i data-lucide="clock" class="icon-xxs"></i> ${timeString} - ${endTimeString}
              </span>
              <span class="code-badge-inline btn-copy-link" data-room-id="${meeting.id}" title="Copy meeting link: ${meeting.id}">
                <i data-lucide="copy" class="icon-xxs"></i> ${meeting.id}
              </span>
            </div>
          </div>
          <div class="meeting-action">
            <button class="btn-join-premium btn-join-room" data-room-id="${meeting.id}">Join</button>
          </div>
        </div>
      `;
    }).join('');
    
    if (window.lucide) window.lucide.createIcons();

    // Event delegation — no inline onclick (blocked by CSP script-src-attr 'none')
    upcomingList.querySelectorAll('.btn-join-room').forEach(btn => {
      btn.addEventListener('click', () => {
        const roomId = btn.getAttribute('data-room-id');
        if (roomId) onJoinRoom(roomId, currentUser.name, currentUser.preferredLanguage || 'en');
      });
    });

    upcomingList.querySelectorAll('.btn-copy-link').forEach(badge => {
      badge.addEventListener('click', (e) => {
        e.stopPropagation();
        const roomId = badge.getAttribute('data-room-id');
        if (roomId) ui.copyMeetingLink(roomId);
      });
    });
  },
 
  renderVault(meetings) {
    if (!vaultList) return;
 
    if (meetings.length === 0) {
      vaultList.innerHTML = `
        <div class="list-empty">
          <i data-lucide="folder-open"></i>
          <p>No past meeting transcripts found.</p>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }
 
    vaultMeetings = meetings;
    this.renderVaultTable(meetings);
  },

  renderVaultTable(meetings) {
    const listBody = document.getElementById('vault-list');
    if (!listBody) return;

    listBody.innerHTML = `
      <div class="table-responsive">
        <table class="vault-table">
          <thead>
            <tr>
              <th>DATE</th>
              <th>TITLE</th>
              <th>LANGUAGE PAIRS</th>
              <th>WORDS</th>
              <th style="text-align: right;">ACTION</th>
            </tr>
          </thead>
          <tbody>
            ${meetings.map(meeting => {
              const date = new Date(meeting.scheduledAt);
              const dateString = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
              
              // Render dynamic language badges
              const langBadges = (meeting.languages || ['EN➔FR']).map(pair => {
                const parts = pair.split('➔');
                if (parts.length === 2) {
                  return `
                    <span class="language-direction-badge" style="margin-right: 4px;">
                      ${parts[0]} <i data-lucide="arrow-right" class="icon-xxs" style="width: 10px; height: 10px; margin: 0 2px; vertical-align: middle;"></i> ${parts[1]}
                    </span>
                  `;
                }
                return `<span class="badge" style="margin-right: 4px;">${pair}</span>`;
              }).join('');

              const wordCount = meeting.wordCount || 0;

              return `
                <tr class="vault-row" data-meeting-id="${meeting.id}" data-meeting-title="${ui.escapeHtml(meeting.title)}" style="cursor: pointer;">
                  <td class="col-date" data-label="Date">${dateString}</td>
                  <td class="col-title font-display-medium" data-label="Title" style="font-weight: 600;">
                    ${ui.escapeHtml(meeting.title)}
                  </td>
                  <td class="col-langs" data-label="Languages">
                    <div style="display: flex; flex-wrap: wrap; gap: 4px;">
                      ${langBadges}
                    </div>
                  </td>
                  <td class="col-words" data-label="Words" style="color: var(--text-muted); font-size: 0.85rem;">
                    ${wordCount.toLocaleString()} words
                  </td>
                  <td class="col-action" data-label="Action" style="text-align: right;">
                    <div style="display: flex; justify-content: flex-end; gap: 6px;">
                      <button class="btn-download-transcript btn-icon-secondary" data-id="${meeting.id}" data-title="${ui.escapeHtml(meeting.title)}" title="Download Transcript (TXT)" style="width: 32px; height: 32px;">
                        <i data-lucide="download" style="width: 14px; height: 14px;"></i>
                      </button>
                      <button class="btn-view-transcript btn-icon-secondary" data-id="${meeting.id}" data-title="${ui.escapeHtml(meeting.title)}" title="View Transcript" style="width: 32px; height: 32px;">
                        <i data-lucide="file-text" style="width: 14px; height: 14px;"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();

    // Event delegation — no inline onclick (blocked by CSP script-src-attr 'none')

    // Clickable row → open transcript viewer
    listBody.querySelectorAll('.vault-row').forEach(row => {
      row.addEventListener('click', (e) => {
        // Don't open viewer if the download button was clicked
        if (e.target.closest('.btn-download-transcript')) return;
        const id = row.getAttribute('data-meeting-id');
        const title = row.getAttribute('data-meeting-title');
        if (id) this.loadTranscript(id, title);
      });
    });

    // View-transcript icon button
    listBody.querySelectorAll('.btn-view-transcript').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        const title = btn.getAttribute('data-title');
        if (id) this.loadTranscript(id, title);
      });
    });

    // Download button
    listBody.querySelectorAll('.btn-download-transcript').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        const title = btn.getAttribute('data-title');
        try {
          ui.showToast('Fetching transcript...', 'info');
          const payload = await api.getTranscript(id);
          const transcripts = payload.data.transcripts;
          this.downloadTranscriptFile(title, transcripts);
        } catch (err) {
          ui.showToast('Failed to download transcript', 'error');
        }
      });
    });
  },

  downloadTranscriptFile(title, transcripts) {
    if (!transcripts || transcripts.length === 0) {
      ui.showToast('No transcript data to download', 'warning');
      return;
    }

    const textContent = transcripts.map(t => {
      const time = new Date(t.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      return `[${time}] ${t.speakerName}:
Original (${t.sourceLang.toUpperCase()}): ${t.originalText}
Translation (${t.targetLang.toUpperCase()}): ${t.translatedText}
----------------------------------------`;
    }).join('\n\n');

    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title.replace(/\s+/g, '_')}_Transcript.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    ui.showToast('Transcript downloaded', 'success');
  },
 
  async loadTranscript(meetingId, title) {
    if (!transcriptModalTitle || !transcriptModal || !transcriptDialogues || !transcriptSearch) return;
 
    transcriptModalTitle.textContent = title;
    ui.toggleModal(transcriptModal, true);
    transcriptDialogues.innerHTML = '<div class="loading-spinner">Loading transcript...</div>';
    transcriptSearch.value = '';
    allTranscripts = [];
 
    // Bind modal copy and download buttons
    const btnCopyTranscript = document.getElementById('btn-copy-transcript-modal');
    const btnDownloadTranscript = document.getElementById('btn-download-transcript-modal');
    
    if (btnCopyTranscript && btnDownloadTranscript) {
      const newBtnCopy = btnCopyTranscript.cloneNode(true);
      const newBtnDownload = btnDownloadTranscript.cloneNode(true);
      btnCopyTranscript.parentNode.replaceChild(newBtnCopy, btnCopyTranscript);
      btnDownloadTranscript.parentNode.replaceChild(newBtnDownload, btnDownloadTranscript);

      newBtnCopy.addEventListener('click', () => {
        if (allTranscripts.length === 0) {
          ui.showToast('No transcript data to copy', 'warning');
          return;
        }
        const text = allTranscripts.map(t => `[${t.speakerName}]: ${t.originalText} (➔ ${t.translatedText})`).join('\n');
        navigator.clipboard.writeText(text).then(() => {
          ui.showToast('Transcript copied to clipboard', 'success');
        });
      });

      newBtnDownload.addEventListener('click', () => {
        this.downloadTranscriptFile(title, allTranscripts);
      });
    }

    try {
      const payload = await api.getTranscript(meetingId);
      allTranscripts = payload.data.transcripts;
      this.renderTranscripts(allTranscripts);
    } catch (err) {
      console.error('Error fetching transcript:', err);
      transcriptDialogues.innerHTML = `<div class="error-text">${err.message || 'An error occurred.'}</div>`;
    }
  },
 
  renderTranscripts(transcripts) {
    if (!transcriptDialogues) return;
 
    if (transcripts.length === 0) {
      transcriptDialogues.innerHTML = '<div class="list-empty"><p>No speech or translation segments recorded for this meeting.</p></div>';
      return;
    }
 
    transcriptDialogues.innerHTML = transcripts.map(t => {
      const timeStr = new Date(t.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const initials = t.speakerName ? t.speakerName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'U';
      
      return `
        <div class="transcript-card" style="display: flex; gap: 16px; align-items: flex-start; padding: 16px; border-bottom: 1px solid var(--border-subtle); background: var(--bg-secondary); border-radius: 12px; margin-bottom: 12px; border: 1px solid var(--border-subtle);">
          <div class="speaker-avatar" style="display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 50%; background: var(--primary-light); color: var(--primary); font-family: var(--font-display); font-weight: 700; font-size: 0.88rem; flex-shrink: 0; border: 1px solid rgba(30, 91, 240, 0.15);">
            ${initials}
          </div>
          <div style="flex-grow: 1; display: flex; flex-direction: column; gap: 4px;">
            <div class="caption-meta" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 2px;">
              <span class="speaker-name" style="font-family: var(--font-display); font-weight: 700; font-size: 0.92rem; color: var(--text-main);">${ui.escapeHtml(t.speakerName)}</span>
              <span class="latency-badge" style="font-size: 0.75rem; color: var(--text-muted);">${timeStr}</span>
            </div>
            <p class="original" style="margin: 0; font-size: 0.9rem; color: var(--text-body); font-style: italic;">${ui.escapeHtml(t.originalText)}</p>
            <p class="translated" style="margin: 4px 0 0 0; font-size: 0.9rem; color: var(--primary); font-weight: 500;">${ui.escapeHtml(t.translatedText)}</p>
          </div>
        </div>
      `;
    }).join('');
  },

  initPushBanner() {
    const banner = document.getElementById('push-onboarding-banner');
    const btnEnable = document.getElementById('btn-push-banner-enable');
    const btnClose = document.getElementById('btn-push-banner-close');

    if (!banner) return;

    // Check if browser supports push notifications
    const isSupported = 'serviceWorker' in navigator && 'PushManager' in window;
    if (!isSupported) {
      banner.style.display = 'none';
      return;
    }

    // Check if user has already allowed, blocked, or dismissed the banner
    const isPermissionDefault = Notification.permission === 'default';
    const isDismissed = localStorage.getItem('syncra_dismissed_push_banner') === 'true';

    if (isPermissionDefault && !isDismissed) {
      banner.style.display = 'flex';
      banner.classList.add('active');
    } else {
      banner.style.display = 'none';
    }

    // Bind Enable Button
    if (btnEnable) {
      btnEnable.addEventListener('click', async () => {
        try {
          btnEnable.disabled = true;
          // Trigger settings push toggle logic
          const { settings } = await import('./settings.js');
          
          if (!settings.swRegistration) {
            await settings.registerServiceWorker();
          }
          
          await settings.handlePushToggle(true);
          
          // Hide banner
          banner.classList.remove('active');
          setTimeout(() => {
            banner.style.display = 'none';
          }, 300);
        } catch (err) {
          console.error('[WebPush] Banner subscribe failed:', err);
        } finally {
          btnEnable.disabled = false;
        }
      });
    }

    // Bind Close Button
    if (btnClose) {
      btnClose.addEventListener('click', () => {
        localStorage.setItem('syncra_dismissed_push_banner', 'true');
        banner.classList.remove('active');
        setTimeout(() => {
          banner.style.display = 'none';
        }, 300);
      });
    }
  }
};
export default dashboard;
