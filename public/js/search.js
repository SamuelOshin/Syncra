// ==========================================
// SYNCRA GLOBAL SEARCH CONTROLLER
// ==========================================

import { api } from './api.js';
import { ui } from './ui.js';

export const search = {
  init() {
    const searchInput = document.getElementById('global-search');
    const dropdown = document.getElementById('search-results-dropdown');

    if (!searchInput || !dropdown) return;

    let debounceTimeout;

    // Handle input with debouncing to limit API requests
    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimeout);
      const query = e.target.value.trim();

      if (!query) {
        this.closeDropdown();
        return;
      }

      debounceTimeout = setTimeout(() => {
        this.executeSearch(query);
      }, 300);
    });

    // Close dropdown on clicking outside
    document.addEventListener('click', (e) => {
      if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
        this.closeDropdown();
      }
    });

    // Re-open dropdown on focus if it contains text
    searchInput.addEventListener('focus', () => {
      if (searchInput.value.trim()) {
        dropdown.classList.add('active');
      }
    });
  },

  closeDropdown() {
    const dropdown = document.getElementById('search-results-dropdown');
    if (dropdown) {
      dropdown.classList.remove('active');
      dropdown.innerHTML = '';
    }
  },

  async executeSearch(query) {
    const dropdown = document.getElementById('search-results-dropdown');
    if (!dropdown) return;

    dropdown.innerHTML = `
      <div style="padding: 16px; text-align: center; color: var(--text-muted); font-size: 0.85rem;">
        Searching...
      </div>
    `;
    dropdown.classList.add('active');

    try {
      const res = await api.search(query);
      const { meetings, transcripts, glossary, translationMemory } = res.data.results;

      const hasResults = meetings.length > 0 || transcripts.length > 0 || glossary.length > 0 || translationMemory.length > 0;

      if (!hasResults) {
        dropdown.innerHTML = `
          <div class="search-no-results">
            No results found for "${ui.escapeHtml(query)}"
          </div>
        `;
        return;
      }

      let html = '';

      // 1. Render Meetings
      if (meetings.length > 0) {
        html += `<div class="search-category">Meetings</div>`;
        meetings.forEach(m => {
          html += `
            <div class="search-item" data-type="meeting" data-id="${m.id}">
              <i data-lucide="video"></i>
              <div class="search-item-content">
                <div class="search-item-title">${ui.escapeHtml(m.title)}</div>
                <div class="search-item-desc">Room Code: ${m.id} • Status: ${m.status}</div>
              </div>
            </div>
          `;
        });
      }

      // 2. Render Glossary Terms
      if (glossary.length > 0) {
        html += `<div class="search-category">Glossary</div>`;
        glossary.forEach(g => {
          html += `
            <div class="search-item" data-type="glossary" data-term="${ui.escapeHtml(g.sourceText)}">
              <i data-lucide="book-open"></i>
              <div class="search-item-content">
                <div class="search-item-title">${ui.escapeHtml(g.sourceText)} ➔ ${ui.escapeHtml(g.targetText)}</div>
                <div class="search-item-desc">Glossary Term (${g.sourceLang.toUpperCase()} ➔ ${g.targetLang.toUpperCase()})</div>
              </div>
            </div>
          `;
        });
      }

      // 3. Render Translation Memory Cached Segments
      if (translationMemory.length > 0) {
        html += `<div class="search-category">Translation Memory</div>`;
        translationMemory.forEach(tm => {
          html += `
            <div class="search-item" data-type="tm" data-term="${ui.escapeHtml(tm.sourceText)}">
              <i data-lucide="database"></i>
              <div class="search-item-content">
                <div class="search-item-title">${ui.escapeHtml(tm.sourceText)} ➔ ${ui.escapeHtml(tm.targetText)}</div>
                <div class="search-item-desc">Cached Segment (${tm.sourceLang.toUpperCase()} ➔ ${tm.targetLang.toUpperCase()})</div>
              </div>
            </div>
          `;
        });
      }

      // 4. Render Transcripts
      if (transcripts.length > 0) {
        html += `<div class="search-category">Transcripts</div>`;
        transcripts.forEach(t => {
          html += `
            <div class="search-item" data-type="transcript" data-query="${ui.escapeHtml(query)}">
              <i data-lucide="message-square"></i>
              <div class="search-item-content">
                <div class="search-item-title">${ui.escapeHtml(t.originalText)}</div>
                <div class="search-item-desc">Translation: "${ui.escapeHtml(t.translatedText)}"</div>
              </div>
            </div>
          `;
        });
      }

      dropdown.innerHTML = html;
      if (window.lucide) window.lucide.createIcons();

      // Bind click handlers to search items
      dropdown.querySelectorAll('.search-item').forEach(item => {
        item.addEventListener('click', () => {
          const type = item.getAttribute('data-type');
          
          if (type === 'meeting') {
            const id = item.getAttribute('data-id');
            this.closeDropdown();
            // Trigger SPA navigation to meeting room
            window.history.pushState({}, '', `/meet/${id}`);
            if (window.checkSessionAndRoute) {
              window.checkSessionAndRoute();
            } else {
              window.location.reload();
            }
          } 
          
          else if (type === 'glossary') {
            const term = item.getAttribute('data-term');
            this.closeDropdown();
            // Open Glossary Modal and filter table
            const glossaryBtn = document.getElementById('btn-sidebar-glossary');
            if (glossaryBtn) {
              glossaryBtn.click();
              setTimeout(() => {
                const searchInput = document.getElementById('glossary-search');
                if (searchInput) {
                  searchInput.value = term;
                  searchInput.dispatchEvent(new Event('input'));
                }
              }, 100);
            }
          } 
          
          else if (type === 'tm') {
            const term = item.getAttribute('data-term');
            this.closeDropdown();
            // Open TM Modal and filter table
            const tmBtn = document.getElementById('btn-sidebar-tm');
            if (tmBtn) {
              tmBtn.click();
              setTimeout(() => {
                const searchInput = document.getElementById('tm-search');
                if (searchInput) {
                  searchInput.value = term;
                  searchInput.dispatchEvent(new Event('input'));
                }
              }, 100);
            }
          } 
          
          else if (type === 'transcript') {
            const query = item.getAttribute('data-query');
            this.closeDropdown();
            // Scroll to Vault Section
            const vaultSection = document.querySelector('.vault-section');
            if (vaultSection) {
              vaultSection.scrollIntoView({ behavior: 'smooth' });
              ui.showToast(`Transcripts filtered by query: "${query}"`, 'info');
            }
          }
        });
      });

    } catch (err) {
      console.error('[Search] Failed to execute search:', err);
      dropdown.innerHTML = `
        <div style="padding: 16px; text-align: center; color: var(--danger); font-size: 0.85rem;">
          Search failed. Please try again.
        </div>
      `;
    }
  }
};
export default search;
