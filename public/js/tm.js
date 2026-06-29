// ==========================================
// SYNCRA TRANSLATION MEMORY CONTROLLER
// ==========================================

import { api } from './api.js';
import { ui } from './ui.js';

export const tm = {
  segments: [],

  init() {
    const tmSearch = document.getElementById('tm-search');

    // Real-time Search Filtering
    tmSearch?.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase().trim();
      this.filterAndRender(query);
    });
  },

  async loadAndRender() {
    const listBody = document.getElementById('tm-items-list');
    if (!listBody) return;

    // Reset search input
    const tmSearch = document.getElementById('tm-search');
    if (tmSearch) tmSearch.value = '';

    listBody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align: center; color: var(--text-muted); padding: 24px;">
          Loading translation memory...
        </td>
      </tr>
    `;

    try {
      const res = await api.getTM();
      this.segments = res.data.segments || [];
      this.render(this.segments);
    } catch (err) {
      console.error('[TM] Error loading segments:', err);
      listBody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align: center; color: var(--danger); padding: 24px;">
            Failed to load translation memory segments.
          </td>
        </tr>
      `;
    }
  },

  render(items) {
    const listBody = document.getElementById('tm-items-list');
    if (!listBody) return;

    if (items.length === 0) {
      listBody.innerHTML = `
        <tr>
          <td colspan="4">
            <div class="list-empty">
              <i data-lucide="info"></i>
              <p>No cached translations found. Start a call and speak to automatically cache segments.</p>
            </div>
          </td>
        </tr>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    listBody.innerHTML = items.map(item => `
      <tr id="tm-row-${item.id}">
        <td data-label="Source Text" style="font-weight: 500; color: var(--text-main); max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${ui.escapeHtml(item.sourceText)}">
          ${ui.escapeHtml(item.sourceText)}
        </td>
        <td data-label="Translation" style="color: var(--text-body); max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${ui.escapeHtml(item.targetText)}">
          ${ui.escapeHtml(item.targetText)}
        </td>
        <td data-label="Languages">
          <div style="display: flex; align-items: center; justify-content: flex-end; gap: 6px;">
            <span class="badge" style="background: hsl(210, 40%, 96%); border: 1px solid var(--border-subtle);">${item.sourceLang.toUpperCase()}</span>
            <i data-lucide="arrow-right" style="width: 12px; height: 12px; color: var(--text-muted);"></i>
            <span class="badge" style="background: var(--primary-light); color: var(--primary); border: 1px solid rgba(30, 91, 240, 0.15);">${item.targetLang.toUpperCase()}</span>
          </div>
        </td>
        <td data-label="Action" style="text-align: right;">
          <button class="btn-delete-tm btn-icon-secondary" data-id="${item.id}" style="display: inline-flex; width: 32px; height: 32px; color: var(--danger); border-color: rgba(239, 68, 68, 0.1); background: rgba(239, 68, 68, 0.02); align-items: center; justify-content: center;">
            <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
          </button>
        </td>
      </tr>
    `).join('');

    if (window.lucide) window.lucide.createIcons();

    // Bind delete buttons
    listBody.querySelectorAll('.btn-delete-tm').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = btn.getAttribute('data-id');
        if (confirm('Are you sure you want to delete this translation segment?')) {
          try {
            await api.deleteTM(id);
            ui.showToast('Translation segment deleted', 'success');
            
            // Remove from local cache and DOM
            this.segments = this.segments.filter(s => s.id !== id);
            document.getElementById(`tm-row-${id}`)?.remove();
            
            if (this.segments.length === 0) {
              this.render([]);
            }
          } catch (err) {
            ui.showToast('Failed to delete translation segment', 'error');
          }
        }
      });
    });
  },

  filterAndRender(query) {
    if (!query) {
      this.render(this.segments);
      return;
    }

    const filtered = this.segments.filter(s => 
      s.sourceText.toLowerCase().includes(query) || 
      s.targetText.toLowerCase().includes(query)
    );
    this.render(filtered);
  }
};
export default tm;
