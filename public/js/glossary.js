// ==========================================
// SYNCRA GLOSSARY CONTROLLER MODULE
// ==========================================

import { api } from './api.js';
import { ui } from './ui.js';

const glossaryModal = document.getElementById('glossary-modal');
const btnCloseGlossary = document.getElementById('btn-close-glossary');
const glossaryForm = document.getElementById('glossary-form');
const glossaryItemsList = document.getElementById('glossary-items-list');

export const glossary = {
  init() {
    if (glossaryForm) {
      glossaryForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.addTerm();
      });
    }

    // Expose delete function to window for inline onclicks in dynamically rendered rows
    window.deleteGlossaryTerm = (id) => this.deleteTerm(id);
  },

  async loadTerms() {
    if (!glossaryItemsList) return;
    glossaryItemsList.innerHTML = '<tr><td colspan="4" class="loading-spinner">Loading glossary terms...</td></tr>';

    try {
      const payload = await api.getGlossary();
      this.renderTerms(payload.data.terms);
    } catch (err) {
      console.error('Error loading glossary terms:', err);
      glossaryItemsList.innerHTML = `<tr><td colspan="4" class="error-text">${err.message}</td></tr>`;
    }
  },

  renderTerms(terms) {
    if (!glossaryItemsList) return;

    if (terms.length === 0) {
      glossaryItemsList.innerHTML = `
        <tr>
          <td colspan="4" style="text-align: center; color: var(--text-muted); padding: 24px;">
            No glossary terms defined. Add one above to enforce custom translations.
          </td>
        </tr>
      `;
      return;
    }

    glossaryItemsList.innerHTML = terms.map(term => {
      return `
        <tr>
          <td data-label="Source Term" style="font-weight: 600; color: var(--text-main);">${ui.escapeHtml(term.sourceText)}</td>
          <td data-label="Translation">${ui.escapeHtml(term.targetText)}</td>
          <td data-label="Languages">
            <span class="language-direction-badge">
              ${term.sourceLang.toUpperCase()} <i data-lucide="arrow-right" class="icon-xxs" style="vertical-align: middle;"></i> ${term.targetLang.toUpperCase()}
            </span>
          </td>
          <td data-label="Action" style="text-align: right;">
            <button class="btn-table-action" onclick="deleteGlossaryTerm('${term.id}')" aria-label="Delete Term" style="color: var(--danger); padding: 4px; display: inline-flex; align-items: center; justify-content: center;">
              <i data-lucide="trash-2"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
  },

  async addTerm() {
    const sourceInput = document.getElementById('glossary-source');
    const targetInput = document.getElementById('glossary-target');
    const sourceLangSelect = document.getElementById('glossary-source-lang');
    const targetLangSelect = document.getElementById('glossary-target-lang');
    const projectSelect = document.getElementById('glossary-project');

    if (!sourceInput || !targetInput || !sourceLangSelect || !targetLangSelect) return;

    const sourceText = sourceInput.value.trim();
    const targetText = targetInput.value.trim();
    const sourceLang = sourceLangSelect.value;
    const targetLang = targetLangSelect.value;
    const projectId = projectSelect?.value || null;

    try {
      await api.addGlossary(sourceText, targetText, sourceLang, targetLang, projectId);
      ui.showToast('Glossary term added successfully!', 'success');
      
      // Reset form fields
      sourceInput.value = '';
      targetInput.value = '';
      if (projectSelect) projectSelect.value = '';
      
      // Reload terms
      await this.loadTerms();
    } catch (err) {
      console.error('Error adding term:', err);
      ui.showToast(err.message, 'error');
    }
  },

  async deleteTerm(id) {
    const confirm = await ui.showConfirm('Delete Glossary Term', 'Are you sure you want to delete this terminology mapping?');
    if (!confirm) return;

    try {
      await api.deleteGlossary(id);
      ui.showToast('Glossary term deleted successfully!', 'success');
      await this.loadTerms();
    } catch (err) {
      console.error('Error deleting term:', err);
      ui.showToast(err.message, 'error');
    }
  }
};
export default glossary;
