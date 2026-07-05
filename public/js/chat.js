import { api } from './api.js';
import { ui } from './ui.js';

export const chat = {
  activeChatId: null,
  chats: [],
  users: [],
  currentUser: null,
  socket: null,
  typingTimeout: null,
  unreadCounts: {},
  isGroupMode: false,
  selectedUserIds: new Set(),

  languages: {
    en: 'English',
    fr: 'Français',
    es: 'Español',
    de: 'Deutsch',
    ja: '日本語',
    pt: 'Português',
    it: 'Italiano',
    nl: 'Nederlands',
    zh: '中文',
    ru: 'Русский',
    ar: 'العربية',
    hi: 'हिन्दी',
    ko: '한국어'
  },

  init(user, socketInstance) {
    this.currentUser = user;
    this.socket = socketInstance;

    // 1. Load initial chats
    this.refreshChats();

    // 2. Setup socket listeners
    this.setupSocketListeners();

    // 3. Setup UI event listeners
    this.setupUIEventListeners();

  },

  async refreshChats() {
    try {
      const res = await api.getChats();
      this.chats = res.data.chats;

      // Populate local unread counts from the server
      this.chats.forEach(c => {
        this.unreadCounts[c.id] = c.unreadCount || 0;
      });

      // Automatically join socket rooms for all retrieved chats
      if (this.socket && this.socket.connected) {
        this.socket.emit('join-chats', { userId: this.currentUser.id });
      }

      this.renderChatList();
      this.updateSidebarBadge();
    } catch (err) {
      console.error('Failed to load chats:', err);
    }
  },

  setupSocketListeners() {
    if (!this.socket) return;

    // Listen for new messages
    this.socket.on('new-chat-message', (msg) => {
      // Find the chat in our local list
      const chatIndex = this.chats.findIndex(c => c.id === msg.chatId);
      if (chatIndex !== -1) {
        const targetChat = this.chats[chatIndex];
        targetChat.lastMessage = {
          id: msg.id,
          originalText: msg.originalText,
          sourceLang: msg.sourceLang,
          senderId: msg.senderId,
          senderName: msg.senderName,
          createdAt: msg.createdAt
        };
        
        // Move chat to top of the list
        this.chats.splice(chatIndex, 1);
        this.chats.unshift(targetChat);
      } else {
        // If it's a new chat we don't have yet, refresh the list
        this.refreshChats();
      }

      // If this message belongs to the currently active chat
      if (this.activeChatId === msg.chatId) {
        this.appendMessage(msg);
        this.scrollToBottom();
        // Mark as read in DB immediately since we are in the active chat
        api.markChatAsRead(msg.chatId).catch(err => console.error('Failed to mark message as read:', err));
        
        // Also emit mark-chat-read socket event so the sender gets the blue ticks instantly!
        if (this.socket && this.socket.connected && msg.senderId !== this.currentUser.id) {
          this.socket.emit('mark-chat-read', { chatId: msg.chatId, userId: this.currentUser.id });
        }
      } else {
        // Increment unread count
        this.unreadCounts[msg.chatId] = (this.unreadCounts[msg.chatId] || 0) + 1;
        ui.showToast(`New message from ${msg.senderName}`, 'info');
      }

      this.renderChatList();
      this.updateSidebarBadge();
    });

    // Listen for read receipts
    this.socket.on('chat-read', (data) => {
      if (this.activeChatId === data.chatId && data.userId !== this.currentUser.id) {
        this.updateMessageTicksToRead();
      }
    });

    // Listen for typing indicators
    this.socket.on('chat-typing', (data) => {
      if (this.activeChatId === data.chatId) {
        const indicator = document.getElementById('chat-typing-indicator');
        if (indicator) {
          const textEl = indicator.querySelector('.typing-text');
          if (data.isTyping) {
            textEl.textContent = `${data.username} is typing...`;
            indicator.style.display = 'flex';
          } else {
            indicator.style.display = 'none';
          }
        }
      }
    });

    // Handle socket reconnection
    this.socket.on('connect', () => {
      if (this.currentUser) {
        this.socket.emit('join-chats', { userId: this.currentUser.id });
      }
    });
  },

  setupUIEventListeners() {
    // New Chat buttons (Opens modal)
    document.getElementById('btn-new-chat')?.addEventListener('click', () => this.openNewChatModal());
    document.getElementById('btn-empty-new-chat')?.addEventListener('click', () => this.openNewChatModal());
    document.getElementById('btn-close-new-chat')?.addEventListener('click', () => this.closeNewChatModal());
    document.getElementById('btn-cancel-new-chat')?.addEventListener('click', () => this.closeNewChatModal());

    // Back button on mobile/tablet
    document.getElementById('btn-chat-back')?.addEventListener('click', () => {
      const layout = document.querySelector('.chat-card-layout');
      layout?.classList.remove('show-chat-window');
      this.activeChatId = null;
      this.renderChatList();
      window.location.hash = 'chat';
    });

    // Video Call button click (planned placeholder)
    document.getElementById('btn-chat-video-call')?.addEventListener('click', () => {
      ui.showToast('Video calling feature is coming soon!', 'info');
    });

    // Chat search filter
    document.getElementById('chat-search-input')?.addEventListener('input', (e) => {
      const val = e.target.value.trim().toLowerCase();
      this.filterChatsList(val);
    });

    // Modal Type Toggles
    document.getElementById('btn-type-dm')?.addEventListener('click', () => this.setModalMode(false));
    document.getElementById('btn-type-group')?.addEventListener('click', () => this.setModalMode(true));

    // Modal User Search
    document.getElementById('new-chat-user-search')?.addEventListener('input', (e) => {
      const query = e.target.value;
      this.searchUsersForModal(query);
    });

    // Modal Group Name Input (triggers validation)
    document.getElementById('new-group-name')?.addEventListener('input', () => this.validateModalSubmitButton());

    // Submit New Chat
    document.getElementById('btn-create-chat-submit')?.addEventListener('click', () => this.submitNewChat());

    // Listen for profile updates to keep currentUser synced
    document.addEventListener('syncra-profile-updated', (e) => {
      this.currentUser = e.detail;
    });

    // Message Composer Form Submission
    document.getElementById('chat-composer-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.sendMessage();
    });

    // Message input typing indicator hook
    const messageInput = document.getElementById('chat-message-input');
    messageInput?.addEventListener('input', () => {
      this.sendTypingStatus(true);
      
      clearTimeout(this.typingTimeout);
      this.typingTimeout = setTimeout(() => {
        this.sendTypingStatus(false);
      }, 2000);
    });
  },

  renderChatList() {
    const listContainer = document.getElementById('chat-list');
    if (!listContainer) return;

    if (this.chats.length === 0) {
      listContainer.innerHTML = `
        <div class="chat-empty-state-list">
          <i data-lucide="message-square-dashed"></i>
          <p>No conversations yet</p>
          <button id="btn-empty-list-new-chat" class="btn btn-secondary" style="margin-top: 8px; height: 38px; padding: 0 16px; font-size: 0.85rem; border-radius: 8px;">
            <i data-lucide="plus" style="width: 14px; height: 14px;"></i>
            <span>Start a Chat</span>
          </button>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();

      const btnEmptyListChat = document.getElementById('btn-empty-list-new-chat');
      if (btnEmptyListChat) {
        btnEmptyListChat.addEventListener('click', (e) => {
          e.stopPropagation();
          this.openNewChatModal();
        });
      }
      return;
    }

    listContainer.innerHTML = this.chats.map(chatItem => {
      const isActive = chatItem.id === this.activeChatId ? 'active' : '';
      const unreadCount = this.unreadCounts[chatItem.id] || 0;
      const badgeHtml = unreadCount > 0 ? `<span class="chat-badge">${unreadCount}</span>` : '';

      // Format last message preview
      let lastMsgText = 'No messages yet';
      let lastMsgTime = '';
      if (chatItem.lastMessage) {
        lastMsgText = chatItem.lastMessage.originalText;
        if (chatItem.lastMessage.senderId === this.currentUser.id) {
          lastMsgText = `You: ${lastMsgText}`;
        } else if (chatItem.isGroup) {
          lastMsgText = `${chatItem.lastMessage.senderName}: ${lastMsgText}`;
        }
        
        const msgDate = new Date(chatItem.lastMessage.createdAt);
        lastMsgTime = msgDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }

      const initials = chatItem.name.charAt(0).toUpperCase();

      return `
        <div class="chat-item ${isActive}" data-chat-id="${chatItem.id}">
          <div class="chat-avatar">${initials}</div>
          <div class="chat-item-details">
            <div class="chat-item-header">
              <span class="chat-item-name">${ui.escapeHtml(chatItem.name)}</span>
              <span class="chat-item-time">${lastMsgTime}</span>
            </div>
            <div class="chat-item-body">
              <span class="chat-item-message">${ui.escapeHtml(lastMsgText)}</span>
              ${badgeHtml}
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Bind click events
    listContainer.querySelectorAll('.chat-item').forEach(el => {
      el.addEventListener('click', () => {
        const chatId = el.getAttribute('data-chat-id');
        window.location.hash = 'chat/' + chatId;
      });
    });
  },

  filterChatsList(query) {
    document.querySelectorAll('.chat-item').forEach(el => {
      const name = el.querySelector('.chat-item-name').textContent.toLowerCase();
      const msg = el.querySelector('.chat-item-message').textContent.toLowerCase();
      if (name.includes(query) || msg.includes(query)) {
        el.style.display = 'flex';
      } else {
        el.style.display = 'none';
      }
    });
  },

  async selectChat(chatId) {
    this.activeChatId = chatId;
    
    // Clear unread counts locally
    this.unreadCounts[chatId] = 0;
    this.updateSidebarBadge();

    // Mark as read on the server
    try {
      await api.markChatAsRead(chatId);
    } catch (err) {
      console.error('Failed to mark chat as read:', err);
    }

    // Emit socket event so others in the room know we read their messages
    if (this.socket && this.socket.connected) {
      this.socket.emit('mark-chat-read', { chatId, userId: this.currentUser.id });
    }

    // Toggle View State
    document.getElementById('chat-window-empty').style.display = 'none';
    const activeWindow = document.getElementById('chat-window-active');
    activeWindow.style.display = 'flex';

    // Toggle mobile screen active pane
    const layout = document.querySelector('.chat-card-layout');
    layout?.classList.add('show-chat-window');

    // Find chat details
    const selectedChat = this.chats.find(c => c.id === chatId);
    if (selectedChat) {
      document.getElementById('active-chat-name').textContent = selectedChat.name;
      document.getElementById('active-chat-avatar').textContent = selectedChat.name.charAt(0).toUpperCase();
      
      const statusText = selectedChat.isGroup 
        ? `${selectedChat.participants.length} participants: ${selectedChat.participants.map(p => p.name).join(', ')}`
        : `Direct Message`;
      document.getElementById('active-chat-status').textContent = statusText;
    }

    // Refresh chat list to clear badges
    this.renderChatList();

    // Load messages
    const msgContainer = document.getElementById('chat-messages-container');
    msgContainer.innerHTML = '<div class="chat-messages-loading">Loading message history...</div>';

    try {
      const res = await api.getChatMessages(chatId);
      this.renderMessages(res.data.messages);
      this.scrollToBottom();
    } catch (err) {
      console.error('Failed to load chat messages:', err);
      msgContainer.innerHTML = '<div class="chat-messages-error">Failed to load message history.</div>';
    }
  },

  renderMessages(messages) {
    const container = document.getElementById('chat-messages-container');
    if (!container) return;

    if (messages.length === 0) {
      container.innerHTML = `
        <div class="chat-messages-empty">
          <p>No messages in this workspace yet. Send a message to start the conversation.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = '';
    let lastDateStr = '';

    messages.forEach(msg => {
      // 1. Insert Date Separators
      const msgDate = new Date(msg.createdAt);
      const dateStr = msgDate.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
      if (dateStr !== lastDateStr) {
        const separator = document.createElement('div');
        separator.className = 'chat-date-separator';
        separator.textContent = dateStr;
        container.appendChild(separator);
        lastDateStr = dateStr;
      }

      // 2. Render Message Bubble
      const isMe = msg.senderId === this.currentUser.id;
      const bubble = this.createMessageBubbleHTML(msg, isMe);
      container.appendChild(bubble);
    });

    // Bind translation toggles
    container.querySelectorAll('.btn-toggle-translation').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const bubble = btn.closest('.chat-bubble-wrapper');
        const textEl = bubble.querySelector('.chat-message-text');
        const isTranslated = bubble.classList.toggle('showing-original');

        const original = bubble.getAttribute('data-original');
        const translated = bubble.getAttribute('data-translated');

        if (isTranslated) {
          textEl.textContent = original;
          btn.innerHTML = '<i data-lucide="globe"></i>';
          btn.setAttribute('title', 'Show Translation');
        } else {
          textEl.textContent = translated;
          btn.innerHTML = '<i data-lucide="undo-2"></i>';
          btn.setAttribute('title', 'Show Original');
        }
        lucide.createIcons();
      });
    });
  },

  createMessageBubbleHTML(msg, isMe) {
    const wrapper = document.createElement('div');
    wrapper.className = `chat-bubble-wrapper ${isMe ? 'me' : 'them'}`;
    
    // Store translations on attributes for easy toggling
    const userLang = (this.currentUser.preferredLanguage || 'en').toLowerCase();
    const isTranslatable = msg.translatedText && msg.sourceLang.toLowerCase() !== userLang;
    
    wrapper.setAttribute('data-original', msg.originalText);
    wrapper.setAttribute('data-translated', msg.translatedText || msg.originalText);

    const displayName = isMe ? 'You' : msg.senderName;
    const msgDate = new Date(msg.createdAt);
    const timeStr = msgDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    const displayText = isTranslatable ? msg.translatedText : msg.originalText;
    const translationBadge = isTranslatable 
      ? `<span class="translation-badge" title="Translated from ${this.languages[msg.sourceLang.toLowerCase()] || msg.sourceLang}"><i data-lucide="languages"></i> ${msg.sourceLang.toUpperCase()}</span>` 
      : '';

    const toggleButton = isTranslatable 
      ? `<button class="btn-toggle-translation" title="Show Original"><i data-lucide="undo-2"></i></button>` 
      : '';

    const initials = msg.senderName.charAt(0).toUpperCase();

    // Render checkmarks (ticks) on our own messages
    let ticksHtml = '';
    if (isMe) {
      const status = msg.status || 'sent';
      if (status === 'read') {
        ticksHtml = `<span class="message-ticks read" title="Seen"><i data-lucide="check-check"></i></span>`;
      } else if (status === 'delivered') {
        ticksHtml = `<span class="message-ticks delivered" title="Delivered"><i data-lucide="check-check"></i></span>`;
      } else {
        ticksHtml = `<span class="message-ticks sent" title="Sent"><i data-lucide="check"></i></span>`;
      }
    }

    wrapper.innerHTML = `
      <div class="chat-bubble-avatar">${initials}</div>
      <div class="chat-bubble-container">
        <div class="chat-bubble-meta">
          <span class="chat-bubble-sender">${ui.escapeHtml(displayName)}</span>
          <span class="chat-bubble-time">${timeStr}</span>
          ${ticksHtml}
        </div>
        <div class="chat-bubble-content">
          <p class="chat-message-text">${ui.escapeHtml(displayText)}</p>
          <div class="chat-bubble-actions">
            ${translationBadge}
            ${toggleButton}
          </div>
        </div>
      </div>
    `;

    return wrapper;
  },

  appendMessage(msg) {
    const container = document.getElementById('chat-messages-container');
    if (!container) return;

    // Remove empty state if present
    const emptyState = container.querySelector('.chat-messages-empty');
    if (emptyState) emptyState.remove();

    const isMe = msg.senderId === this.currentUser.id;
    
    // Format payload for render bubble
    const userLang = (this.currentUser.preferredLanguage || 'en').toLowerCase();
    const msgPayload = {
      id: msg.id,
      senderId: msg.senderId,
      senderName: msg.senderName,
      originalText: msg.originalText,
      sourceLang: msg.sourceLang,
      translatedText: msg.translations[userLang] || null,
      status: msg.status || 'sent',
      createdAt: msg.createdAt
    };

    const bubble = this.createMessageBubbleHTML(msgPayload, isMe);
    container.appendChild(bubble);
    
    // Bind toggle for this new bubble
    bubble.querySelector('.btn-toggle-translation')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const textEl = bubble.querySelector('.chat-message-text');
      const isTranslated = bubble.classList.toggle('showing-original');

      const original = bubble.getAttribute('data-original');
      const translated = bubble.getAttribute('data-translated');

      if (isTranslated) {
        textEl.textContent = original;
        e.currentTarget.innerHTML = '<i data-lucide="globe"></i>';
      } else {
        textEl.textContent = translated;
        e.currentTarget.innerHTML = '<i data-lucide="undo-2"></i>';
      }
      lucide.createIcons();
    });

    if (window.lucide) window.lucide.createIcons();
  },

  scrollToBottom() {
    const container = document.getElementById('chat-messages-container');
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  },

  async sendMessage() {
    const input = document.getElementById('chat-message-input');
    const langSelect = document.getElementById('chat-source-lang-select');
    if (!input || !input.value.trim() || !this.activeChatId) return;

    const messageText = input.value.trim();
    const sourceLang = langSelect ? langSelect.value : (this.currentUser.preferredLanguage || 'en');

    // Emit via Socket.io for real-time delivery
    if (this.socket && this.socket.connected) {
      this.socket.emit('send-chat-message', {
        chatId: this.activeChatId,
        senderId: this.currentUser.id,
        originalText: messageText,
        sourceLang: sourceLang
      });
      
      // Stop typing indicator
      this.sendTypingStatus(false);
    } else {
      ui.showToast('Disconnected from server. Unable to send message.', 'error');
    }

    input.value = '';
    input.focus();
  },

  sendTypingStatus(isTyping) {
    if (this.socket && this.socket.connected && this.activeChatId) {
      this.socket.emit('chat-typing', {
        chatId: this.activeChatId,
        userId: this.currentUser.id,
        isTyping,
        username: this.currentUser.name
      });
    }
  },

  // ==========================================
  // NEW CHAT MODAL FUNCTIONS
  // ==========================================

  async openNewChatModal() {
    const modal = document.getElementById('new-chat-modal');
    if (!modal) return;

    modal.classList.add('active');
    this.setModalMode(false); // Default to DM
    
    // Clear selections
    this.selectedUserIds.clear();
    document.getElementById('new-group-name').value = '';
    document.getElementById('new-chat-user-search').value = '';

    // Load initial users list
    await this.searchUsersForModal('');
  },

  closeNewChatModal() {
    document.getElementById('new-chat-modal')?.classList.remove('active');
  },

  setModalMode(isGroup) {
    this.isGroupMode = isGroup;
    this.selectedUserIds.clear();

    const dmBtn = document.getElementById('btn-type-dm');
    const groupBtn = document.getElementById('btn-type-group');
    const groupWrapper = document.getElementById('group-name-wrapper');

    if (isGroup) {
      groupBtn.classList.add('active');
      dmBtn.classList.remove('active');
      groupWrapper.style.display = 'block';
    } else {
      dmBtn.classList.add('active');
      groupBtn.classList.remove('active');
      groupWrapper.style.display = 'none';
    }

    this.renderUsersList();
    this.validateModalSubmitButton();
  },

  async searchUsersForModal(query) {
    const listContainer = document.getElementById('new-chat-users-list');
    if (listContainer) {
      listContainer.innerHTML = '<div class="modal-loading">Searching colleagues...</div>';
    }

    try {
      const res = await api.searchChatUsers(query);
      this.users = res.data.users;
      this.renderUsersList();
    } catch (err) {
      console.error('Failed to search users:', err);
      if (listContainer) {
        listContainer.innerHTML = '<div class="modal-error">Failed to search colleagues.</div>';
      }
    }
  },

  renderUsersList() {
    const container = document.getElementById('new-chat-users-list');
    if (!container) return;

    if (this.users.length === 0) {
      container.innerHTML = '<div class="modal-empty-state">No colleagues found.</div>';
      return;
    }

    container.innerHTML = this.users.map(user => {
      const isChecked = this.selectedUserIds.has(user.id) ? 'checked' : '';
      const inputType = this.isGroupMode ? 'checkbox' : 'radio';

      return `
        <div class="modal-user-item" data-user-id="${user.id}">
          <div class="modal-user-avatar">${user.name.charAt(0).toUpperCase()}</div>
          <div class="modal-user-details">
            <span class="modal-user-name">${ui.escapeHtml(user.name)}</span>
            <span class="modal-user-email">${ui.escapeHtml(user.email)}</span>
          </div>
          <div class="modal-user-selection">
            <input type="${inputType}" name="modal-user-select" value="${user.id}" ${isChecked}>
          </div>
        </div>
      `;
    }).join('');

    // Bind click events on user items to select them
    container.querySelectorAll('.modal-user-item').forEach(el => {
      el.addEventListener('click', (e) => {
        const userId = el.getAttribute('data-user-id');
        const input = el.querySelector('input');

        if (this.isGroupMode) {
          if (this.selectedUserIds.has(userId)) {
            this.selectedUserIds.delete(userId);
            input.checked = false;
          } else {
            this.selectedUserIds.add(userId);
            input.checked = true;
          }
        } else {
          // DM mode: select exactly one
          this.selectedUserIds.clear();
          this.selectedUserIds.add(userId);
          container.querySelectorAll('input').forEach(i => i.checked = false);
          input.checked = true;
        }

        this.validateModalSubmitButton();
      });
    });
  },

  validateModalSubmitButton() {
    const submitBtn = document.getElementById('btn-create-chat-submit');
    if (!submitBtn) return;

    let isValid = false;
    if (this.isGroupMode) {
      const groupName = document.getElementById('new-group-name').value.trim();
      isValid = groupName.length > 0 && this.selectedUserIds.size > 0;
    } else {
      isValid = this.selectedUserIds.size === 1;
    }

    submitBtn.disabled = !isValid;
  },

  async submitNewChat() {
    if (this.selectedUserIds.size === 0) return;

    let payload = {
      isGroup: this.isGroupMode,
      userIds: Array.from(this.selectedUserIds)
    };

    if (this.isGroupMode) {
      const groupName = document.getElementById('new-group-name').value.trim();
      if (!groupName) return;
      payload.name = groupName;
    }

    const submitBtn = document.getElementById('btn-create-chat-submit');
    const originalBtnHtml = submitBtn ? submitBtn.innerHTML : '';

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Starting Chat...';
    }

    try {
      const res = await api.createChat(payload.isGroup, payload.name || null, payload.userIds);

      this.closeNewChatModal();
      
      // Refresh chats and select the newly created one
      await this.refreshChats();
      window.location.hash = 'chat/' + res.data.chat.id;
    } catch (err) {
      ui.showToast(err.message || 'Failed to create conversation', 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnHtml;
      }
    }
  },

  updateSidebarBadge() {
    const totalUnread = Object.values(this.unreadCounts).reduce((a, b) => a + b, 0);
    const chatBtn = document.getElementById('btn-sidebar-chat');
    if (!chatBtn) return;

    let badge = chatBtn.querySelector('.sidebar-badge');
    if (totalUnread > 0) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'sidebar-badge';
        chatBtn.appendChild(badge);
      }
      badge.textContent = totalUnread;
      badge.style.display = 'inline-block';
    } else if (badge) {
      badge.style.display = 'none';
    }
  },

  updateMessageTicksToRead() {
    const container = document.getElementById('chat-messages-container');
    if (!container) return;

    // Find all of our sent message checkmarks that are not yet marked as read
    const ticks = container.querySelectorAll('.chat-bubble-wrapper.me .message-ticks:not(.read)');
    ticks.forEach(tick => {
      tick.className = 'message-ticks read';
      tick.setAttribute('title', 'Seen');
      tick.innerHTML = '<i data-lucide="check-check"></i>';
    });

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }
};
export default chat;
