// ==========================================
// SYNCRA API CLIENT MODULE
// ==========================================

export const api = {
  async getMe() {
    const res = await fetch('/api/auth/me');
    if (!res.ok) throw new Error('Unauthenticated');
    return res.json();
  },

  async signIn(email, password) {
    const res = await fetch('/api/auth/signin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const payload = await res.json();
    if (!res.ok) throw new Error(payload.message || 'Sign in failed');
    return payload;
  },

  async signUp(name, email, password) {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });
    const payload = await res.json();
    if (!res.ok) throw new Error(payload.message || 'Sign up failed');
    return payload;
  },

  async signOut() {
    const res = await fetch('/api/auth/signout', { method: 'POST' });
    if (!res.ok) throw new Error('Sign out failed');
    return res.json();
  },

  async getMeetings() {
    const res = await fetch('/api/meetings');
    if (!res.ok) throw new Error('Failed to fetch meetings');
    return res.json();
  },

  async createMeeting(title, scheduledAt, projectId = null) {
    const res = await fetch('/api/meetings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, scheduledAt, projectId })
    });
    const payload = await res.json();
    if (!res.ok) throw new Error(payload.message || 'Failed to create meeting');
    return payload;
  },

  async getTranscript(meetingId) {
    const res = await fetch(`/api/meetings/${meetingId}/transcript`);
    const payload = await res.json();
    if (!res.ok) throw new Error(payload.message || 'Failed to fetch transcript');
    return payload;
  },

  async verifyMeeting(meetingId) {
    const res = await fetch(`/api/meetings/${meetingId}/verify`);
    const payload = await res.json();
    if (!res.ok) throw new Error(payload.message || 'Meeting not found');
    return payload;
  },

  async endMeeting(meetingId) {
    const res = await fetch(`/api/meetings/${meetingId}/end`, {
      method: 'POST'
    });
    const payload = await res.json();
    if (!res.ok) throw new Error(payload.message || 'Failed to end meeting');
    return payload;
  },

  async getGlossary() {
    const res = await fetch('/api/glossary');
    if (!res.ok) throw new Error('Failed to fetch glossary terms');
    return res.json();
  },

  async addGlossary(sourceText, targetText, sourceLang, targetLang, projectId = null) {
    const res = await fetch('/api/glossary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceText, targetText, sourceLang, targetLang, projectId })
    });
    const payload = await res.json();
    if (!res.ok) throw new Error(payload.message || 'Failed to add glossary term');
    return payload;
  },

  async deleteGlossary(id) {
    const res = await fetch(`/api/glossary/${id}`, {
      method: 'DELETE'
    });
    const payload = await res.json();
    if (!res.ok) throw new Error(payload.message || 'Failed to delete glossary term');
    return payload;
  },

  async getLiveKitToken(roomName, username = '') {
    const res = await fetch(`/api/livekit/token?room=${encodeURIComponent(roomName)}&username=${encodeURIComponent(username)}`);
    const payload = await res.json();
    if (!res.ok) throw new Error(payload.message || 'Failed to fetch LiveKit token');
    return payload;
  },

  async getTM() {
    const res = await fetch('/api/translation-memory');
    if (!res.ok) throw new Error('Failed to fetch translation memory');
    return res.json();
  },

  async deleteTM(id) {
    const res = await fetch(`/api/translation-memory/${id}`, {
      method: 'DELETE'
    });
    const payload = await res.json();
    if (!res.ok) throw new Error(payload.message || 'Failed to delete translation segment');
    return payload;
  },

  async search(query) {
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error('Search request failed');
    return res.json();
  },

  async getNotifications() {
    const res = await fetch('/api/notifications');
    if (!res.ok) throw new Error('Failed to fetch notifications');
    return res.json();
  },

  async clearNotifications() {
    const res = await fetch('/api/notifications', {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to clear notifications');
    return res.json();
  },

  async getProjects() {
    const res = await fetch('/api/projects');
    if (!res.ok) throw new Error('Failed to fetch projects');
    return res.json();
  },

  async createProject(name, description) {
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name, description })
    });
    const payload = await res.json();
    if (!res.ok) throw new Error(payload.message || 'Failed to create project');
    return payload;
  },

  async deleteProject(id) {
    const res = await fetch(`/api/projects/${id}`, {
      method: 'DELETE'
    });
    const payload = await res.json();
    if (!res.ok) throw new Error(payload.message || 'Failed to delete project');
    return payload;
  },

  async getAnalytics() {
    const res = await fetch('/api/analytics/stats');
    if (!res.ok) throw new Error('Failed to fetch analytics statistics');
    return res.json();
  },

  async getChats() {
    const res = await fetch('/api/chat');
    if (!res.ok) throw new Error('Failed to fetch chats');
    return res.json();
  },

  async createChat(isGroup, name, userIds) {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isGroup, name, userIds })
    });
    const payload = await res.json();
    if (!res.ok) throw new Error(payload.message || 'Failed to create chat');
    return payload;
  },

  async getChatMessages(chatId) {
    const res = await fetch(`/api/chat/${chatId}/messages`);
    const payload = await res.json();
    if (!res.ok) throw new Error(payload.message || 'Failed to fetch messages');
    return payload;
  },

  async searchChatUsers(query) {
    const res = await fetch(`/api/chat/users?q=${encodeURIComponent(query)}`);
    const payload = await res.json();
    if (!res.ok) throw new Error(payload.message || 'Failed to search users');
    return payload;
  },

  async markChatAsRead(chatId) {
    const res = await fetch(`/api/chat/${chatId}/read`, { method: 'POST' });
    const payload = await res.json();
    if (!res.ok) throw new Error(payload.message || 'Failed to mark chat as read');
    return payload;
  }
};
export default api;
