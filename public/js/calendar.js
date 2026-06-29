// ==========================================
// SYNCRA CALENDAR / MEETINGS VIEW CONTROLLER
// ==========================================

import { api } from './api.js';
import { ui } from './ui.js';

export const calendar = {
  init() {
    const btnCalendarSchedule = document.getElementById('btn-calendar-schedule');
    if (btnCalendarSchedule) {
      btnCalendarSchedule.addEventListener('click', () => {
        const scheduleModal = document.getElementById('schedule-modal');
        ui.toggleModal(scheduleModal, true);
      });
    }
  },

  async loadAndRender() {
    const listBody = document.getElementById('calendar-meetings-list');
    if (!listBody) return;

    listBody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 24px;">
          Loading meetings...
        </td>
      </tr>
    `;

    try {
      const res = await api.getMeetings();
      const meetings = res.data.meetings || [];
      this.render(meetings);
    } catch (err) {
      console.error('[Calendar] Error loading meetings:', err);
      listBody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; color: var(--danger); padding: 24px;">
            Failed to load meetings.
          </td>
        </tr>
      `;
    }
  },

  render(meetings) {
    const listBody = document.getElementById('calendar-meetings-list');
    if (!listBody) return;

    if (meetings.length === 0) {
      listBody.innerHTML = `
        <tr>
          <td colspan="5">
            <div class="list-empty">
              <i data-lucide="calendar"></i>
              <p>No meetings scheduled. Click "Schedule Call" to create one.</p>
            </div>
          </td>
        </tr>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    // Sort meetings: active first, then scheduled (by date ascending), then ended (by date descending)
    const sortedMeetings = [...meetings].sort((a, b) => {
      if (a.status === 'active' && b.status !== 'active') return -1;
      if (b.status === 'active' && a.status !== 'active') return 1;
      
      if (a.status === 'scheduled' && b.status === 'ended') return -1;
      if (b.status === 'scheduled' && a.status === 'ended') return 1;

      const timeA = new Date(a.scheduledAt).getTime();
      const timeB = new Date(b.scheduledAt).getTime();
      
      if (a.status === 'scheduled') {
        return timeA - timeB; // Ascending for upcoming
      } else {
        return timeB - timeA; // Descending for past
      }
    });

    listBody.innerHTML = sortedMeetings.map(meeting => {
      const dateStr = new Date(meeting.scheduledAt).toLocaleString([], {
        dateStyle: 'medium',
        timeStyle: 'short'
      });
      
      // Determine status badge
      let statusClass = 'badge-secondary';
      let statusLabel = 'Scheduled';
      if (meeting.status === 'active') {
        statusClass = 'badge-success';
        statusLabel = 'Active';
      } else if (meeting.status === 'ended') {
        statusClass = 'badge-muted';
        statusLabel = 'Ended';
      }

      // Action button
      let actionBtn = '';
      if (meeting.status === 'active' || meeting.status === 'scheduled') {
        actionBtn = `
          <button class="btn btn-primary btn-xs btn-join-meeting" data-id="${meeting.id}">
            Join
          </button>
        `;
      } else {
        actionBtn = `
          <span style="color: var(--text-muted); font-size: 0.82rem;">—</span>
        `;
      }

      return `
        <tr id="calendar-row-${meeting.id}">
          <td data-label="Title" style="font-weight: 600; color: var(--text-main);">
            ${ui.escapeHtml(meeting.title)}
          </td>
          <td data-label="Date & Time" style="color: var(--text-body); font-size: 0.88rem;">
            ${dateStr}
          </td>
          <td data-label="Room Code">
            <span class="code-badge-inline btn-copy-code" data-code="${meeting.id}" style="cursor: pointer;">
              ${meeting.id}
              <i data-lucide="copy" style="width: 10px; height: 10px; margin-left: 2px;"></i>
            </span>
          </td>
          <td data-label="Status">
            <span class="badge ${statusClass}">${statusLabel}</span>
          </td>
          <td data-label="Action" style="text-align: right;">
            ${actionBtn}
          </td>
        </tr>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();

    // Bind Join buttons
    listBody.querySelectorAll('.btn-join-meeting').forEach(btn => {
      btn.addEventListener('click', () => {
        const roomId = btn.getAttribute('data-id');
        if (window.syncraJoinRoom) {
          window.syncraJoinRoom(roomId);
        }
      });
    });

    // Bind Copy buttons
    listBody.querySelectorAll('.btn-copy-code').forEach(btn => {
      btn.addEventListener('click', () => {
        const code = btn.getAttribute('data-code');
        navigator.clipboard.writeText(code).then(() => {
          ui.showToast('Room code copied to clipboard', 'success');
        });
      });
    });
  }
};
export default calendar;
