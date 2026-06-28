// ==========================================
// SYNCRA PROJECTS CONTROLLER
// ==========================================

import { api } from './api.js';
import { ui } from './ui.js';

export const projects = {
  list: [],

  init() {
    const projectForm = document.getElementById('project-form');

    // Submit Create Project Form
    projectForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nameInput = document.getElementById('project-name');
      const descInput = document.getElementById('project-desc');
      
      const name = nameInput.value.trim();
      const description = descInput.value.trim();

      try {
        await api.createProject(name, description);
        ui.showToast('Project created successfully', 'success');
        nameInput.value = '';
        descInput.value = '';
        this.loadAndRender();
      } catch (err) {
        ui.showToast(err.message || 'Failed to create project', 'error');
      }
    });

    // Preload dropdown options on startup
    this.refreshDropdownsOnly();
  },

  async refreshDropdownsOnly() {
    try {
      const res = await api.getProjects();
      this.list = res.data.projects || [];
      this.populateDropdowns();
    } catch (e) {
      console.warn('[Projects] Failed to preload dropdown options:', e);
    }
  },

  async loadAndRender() {
    const listContainer = document.getElementById('projects-items-list');
    if (!listContainer) return;

    listContainer.innerHTML = `
      <div style="padding: 16px; text-align: center; color: var(--text-muted); font-size: 0.85rem;">
        Loading projects...
      </div>
    `;

    try {
      const res = await api.getProjects();
      this.list = res.data.projects || [];
      this.render(this.list);
      this.populateDropdowns();
    } catch (err) {
      console.error('[Projects] Error loading projects:', err);
      listContainer.innerHTML = `
        <div style="padding: 16px; text-align: center; color: var(--danger); font-size: 0.85rem;">
          Failed to load projects.
        </div>
      `;
    }
  },

  populateDropdowns() {
    const scheduleSelect = document.getElementById('schedule-project');
    const glossarySelect = document.getElementById('glossary-project');

    const optionsHtml = `
      <option value="">Global (No Project)</option>
      ${this.list.map(p => `<option value="${p.id}">${ui.escapeHtml(p.name)}</option>`).join('')}
    `;

    if (scheduleSelect) scheduleSelect.innerHTML = optionsHtml;
    if (glossarySelect) glossarySelect.innerHTML = optionsHtml;
  },

  render(items) {
    const listContainer = document.getElementById('projects-items-list');
    if (!listContainer) return;

    if (items.length === 0) {
      listContainer.innerHTML = `
        <div style="padding: 32px 16px; text-align: center; color: var(--text-muted); font-size: 0.85rem;">
          No projects created yet. Create one on the left.
        </div>
      `;
      return;
    }

    listContainer.innerHTML = items.map(p => `
      <div class="project-card" id="project-card-${p.id}">
        <div class="project-card-info">
          <h5>${ui.escapeHtml(p.name)}</h5>
          <p>${ui.escapeHtml(p.description || 'No description provided.')}</p>
        </div>
        <div class="project-card-actions">
          <button class="btn-delete-project btn-icon-secondary" data-id="${p.id}" style="color: var(--danger); border-color: rgba(239, 68, 68, 0.1); background: rgba(239, 68, 68, 0.02);">
            <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
          </button>
        </div>
      </div>
    `).join('');

    if (window.lucide) window.lucide.createIcons();

    // Bind delete buttons
    listContainer.querySelectorAll('.btn-delete-project').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = btn.getAttribute('data-id');
        if (confirm('Are you sure you want to delete this project? Meeting rooms, glossary terms, and cached segments will remain but will be set to Global.')) {
          try {
            await api.deleteProject(id);
            ui.showToast('Project deleted successfully', 'success');
            
            // Remove from local cache and DOM
            this.list = this.list.filter(p => p.id !== id);
            document.getElementById(`project-card-${id}`)?.remove();
            this.populateDropdowns();
            
            if (this.list.length === 0) {
              this.render([]);
            }
          } catch (err) {
            ui.showToast('Failed to delete project', 'error');
          }
        }
      });
    });
  }
};
export default projects;
