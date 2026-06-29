// ==========================================
// SYNCRA UI UTILITIES MODULE
// ==========================================

export const ui = {
  escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  },

  copyMeetingLink(roomId) {
    const link = `${window.location.origin}/meet/${roomId}`;
    navigator.clipboard.writeText(link).then(() => {
      this.showToast('Meeting link copied to clipboard!', 'success');
    }).catch(err => {
      console.error('Copy failed:', err);
      this.showToast('Failed to copy link.', 'error');
    });
  },

  toggleModal(modalElement, show = true) {
    if (show) {
      modalElement.classList.add('active');
    } else {
      modalElement.classList.remove('active');
    }
  },

  // Custom Toast Notification System
  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast glass-card ${type}`;

    // Select icon based on toast type
    let iconName = 'info';
    if (type === 'success') iconName = 'check-circle';
    if (type === 'error') iconName = 'alert-triangle';
    if (type === 'warning') iconName = 'alert-circle';

    toast.innerHTML = `
      <div class="toast-icon">
        <i data-lucide="${iconName}"></i>
      </div>
      <div class="toast-message">${this.escapeHtml(message)}</div>
      <button class="toast-close" aria-label="Close Notification">
        <i data-lucide="x"></i>
      </button>
    `;

    container.appendChild(toast);

    // Trigger slide-in animation
    setTimeout(() => toast.classList.add('active'), 50);

    // Auto dismiss after 4 seconds
    const dismissTimeout = setTimeout(() => {
      dismissToast(toast);
    }, 4000);

    // Manual close button click
    toast.querySelector('.toast-close').addEventListener('click', () => {
      clearTimeout(dismissTimeout);
      dismissToast(toast);
    });

    // Compile Lucide icons inside the new toast
    if (window.lucide) {
      window.lucide.createIcons();
    }

    function dismissToast(el) {
      el.classList.remove('active');
      // Wait for slide-out transition to finish before removing from DOM
      el.addEventListener('transitionend', () => el.remove());
    }
  },

  // Promise-based custom confirmation modal (replaces browser confirm())
  showConfirm(title, message) {
    return new Promise((resolve) => {
      const modal = document.getElementById('confirm-modal');
      const titleEl = document.getElementById('confirm-modal-title');
      const msgEl = document.getElementById('confirm-modal-message');
      const btnConfirm = document.getElementById('btn-action-confirm');
      const btnCancel = document.getElementById('btn-cancel-confirm');
      const btnClose = document.getElementById('btn-close-confirm');

      if (!modal || !titleEl || !msgEl || !btnConfirm || !btnCancel || !btnClose) {
        console.warn('Confirmation modal elements not found in DOM.');
        resolve(false);
        return;
      }

      titleEl.textContent = title;
      msgEl.textContent = message;

      const cleanup = (value) => {
        modal.classList.remove('active');
        btnConfirm.removeEventListener('click', onConfirmClick);
        btnCancel.removeEventListener('click', onCancelClick);
        btnClose.removeEventListener('click', onCancelClick);
        resolve(value);
      };

      const onConfirmClick = () => cleanup(true);
      const onCancelClick = () => cleanup(false);

      btnConfirm.addEventListener('click', onConfirmClick);
      btnCancel.addEventListener('click', onCancelClick);
      btnClose.addEventListener('click', onCancelClick);

      modal.classList.add('active');
      if (window.lucide) {
        window.lucide.createIcons();
      }
    });
  },

  // Export a bilingual transcript array to a chronological text file download
  exportTranscriptFile(meetingTitle, segments) {
    if (!segments || segments.length === 0) {
      this.showToast('No transcript data to export.', 'warning');
      return;
    }

    const fileContent = segments.map(s => {
      const timestamp = s.timestamp ? s.timestamp : new Date().toLocaleTimeString();
      return `[${timestamp}] ${s.speakerName} (${s.sourceLang.toUpperCase()}): ${s.originalText}\n` +
             `[${timestamp}] ${s.speakerName} (${s.targetLang.toUpperCase()} - Translated): ${s.translatedText}\n`;
    }).join('\n');

    const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    // Format filename: q2_syncra_review_transcript.txt
    const sanitizedTitle = meetingTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    link.href = url;
    link.download = `${sanitizedTitle}_transcript.txt`;
    
    document.body.appendChild(link);
    link.click();
    
    // Cleanup
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    this.showToast('Transcript exported successfully!', 'success');
  },

  getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }
};
export default ui;
