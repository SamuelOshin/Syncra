// ==========================================
// SYNCRA NOTIFICATIONS CONTROLLER
// ==========================================

import { api } from './api.js';
import { ui } from './ui.js';

export const notifications = {
  list: [],

  init() {
    const btnBell = document.getElementById('btn-notifications');
    const dropdown = document.getElementById('notifications-dropdown');
    const btnClear = document.getElementById('btn-clear-notifications');

    if (!btnBell || !dropdown) return;

    // Toggle Dropdown
    btnBell.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('active');
      if (dropdown.classList.contains('active')) {
        this.loadAndRender();
        this.markAsRead();
      }
    });

    // Clear All Notifications
    btnClear?.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        await api.clearNotifications();
        ui.showToast('All notifications cleared', 'success');
        this.list = [];
        this.render([]);
        this.updateBadge();
      } catch (err) {
        ui.showToast('Failed to clear notifications', 'error');
      }
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target) && !btnBell.contains(e.target)) {
        dropdown.classList.remove('active');
      }
    });

    // Initial check for unread alerts
    this.pollNotifications();
    
    // Poll for new notifications every 30 seconds (lightweight real-time updates)
    setInterval(() => this.pollNotifications(), 30000);
  },

  async pollNotifications() {
    try {
      const res = await api.getNotifications();
      this.list = res.data.notifications || [];
      this.updateBadge();
    } catch (e) {
      console.warn('[Notifications] Error polling alerts:', e);
    }
  },

  async loadAndRender() {
    const listContainer = document.getElementById('notifications-list');
    if (!listContainer) return;

    listContainer.innerHTML = `
      <div style="padding: 16px; text-align: center; color: var(--text-muted); font-size: 0.85rem;">
        Loading notifications...
      </div>
    `;

    try {
      const res = await api.getNotifications();
      this.list = res.data.notifications || [];
      this.render(this.list);
    } catch (err) {
      console.error('[Notifications] Failed to load notifications:', err);
      listContainer.innerHTML = `
        <div style="padding: 16px; text-align: center; color: var(--danger); font-size: 0.85rem;">
          Failed to load notifications.
        </div>
      `;
    }
  },

  async markAsRead() {
    try {
      await fetch('/api/notifications/read', { method: 'POST' });
      // Update local state to read
      this.list.forEach(n => n.read = true);
      this.updateBadge();
    } catch (e) {
      console.warn('[Notifications] Failed to mark alerts as read:', e);
    }
  },

  updateBadge() {
    const badge = document.getElementById('notification-badge');
    if (!badge) return;

    const unreadCount = this.list.filter(n => !n.read).length;
    if (unreadCount > 0) {
      badge.style.display = 'block';
    } else {
      badge.style.display = 'none';
    }
  },

  render(items) {
    const listContainer = document.getElementById('notifications-list');
    if (!listContainer) return;

    if (items.length === 0) {
      listContainer.innerHTML = `
        <div class="empty-state">No new notifications</div>
      `;
      return;
    }

    listContainer.innerHTML = items.map(n => {
      let icon = 'info';
      if (n.type === 'success') icon = 'check-circle';
      if (n.type === 'warning') icon = 'alert-triangle';

      const timeStr = new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      return `
        <div class="notification-card ${n.read ? 'read' : 'unread'}">
          <div class="notification-icon-wrapper ${n.type || 'info'}">
            <i data-lucide="${icon}"></i>
          </div>
          <div class="notification-content">
            <div class="notification-title">${ui.escapeHtml(n.title)}</div>
            <div class="notification-message">${ui.escapeHtml(n.message)}</div>
            <div class="notification-time">${timeStr}</div>
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
  }
};
export default notifications;
