/**
 * CFU Jam API Client
 * Легковесный клиент для связи фронтенда с бэкендом CFUjam API
 */

const API_BASE = '/api';

class ApiClient {
  constructor() {
    this.token = typeof window !== 'undefined' ? localStorage.getItem('cfujam_token') : null;
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('cfujam_token', token);
    } else {
      localStorage.removeItem('cfujam_token');
    }
  }

  getToken() {
    return this.token;
  }

  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.message || data.error || `Ошибка сервера (${res.status})`);
    }

    return data;
  }

  // --- Авторизация ---
  async login(login, pass) {
    const res = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ login, pass })
    });
    if (res.token) this.setToken(res.token);
    return res;
  }

  async register(nick, email, pass) {
    const res = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ nick, email, pass })
    });
    if (res.token) this.setToken(res.token);
    return res;
  }

  async getMe() {
    return this.request('/auth/me');
  }

  logout() {
    this.setToken(null);
  }

  // --- Джемы ---
  async getCurrentJam() {
    return this.request('/jams/current');
  }

  async getJamSession(jamSlug = 'current') {
    return this.request(`/jams/${jamSlug}/session`);
  }

  async getJamCriteriaPresets() {
    return this.request('/jams/criteria/presets');
  }

  // --- Команды ---
  async getTeams(jamSlug = 'current', search, openOnly = false) {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (openOnly) params.set('openOnly', 'true');
    const q = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/jams/${jamSlug}/teams${q}`);
  }

  async createTeam(jamSlug = 'current', teamData) {
    return this.request(`/jams/${jamSlug}/teams`, {
      method: 'POST',
      body: JSON.stringify(teamData)
    });
  }

  async joinTeam(teamId, inviteCode) {
    return this.request(`/teams/${teamId}/join`, {
      method: 'POST',
      body: JSON.stringify({ inviteCode })
    });
  }

  async leaveTeam(teamId) {
    return this.request(`/teams/${teamId}/leave`, { method: 'POST' });
  }

  async kickTeamMember(teamId, userId) {
    return this.request(`/teams/${teamId}/members/${userId}`, { method: 'DELETE' });
  }

  async updateTeamRecruitment(teamId, recruitmentData) {
    return this.request(`/teams/${teamId}/recruitment`, {
      method: 'PATCH',
      body: JSON.stringify(recruitmentData)
    });
  }

  // --- Игры и сабмишены ---
  async getSubmissions(jamSlug = 'current', engine, search) {
    const params = new URLSearchParams();
    if (engine) params.set('engine', engine);
    if (search) params.set('search', search);
    const q = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/jams/${jamSlug}/submissions${q}`);
  }

  async toggleLike(submissionId) {
    return this.request(`/submissions/${submissionId}/like`, { method: 'POST' });
  }

  // --- Оценивание и Лидерборд ---
  async getJudgeQueue(jamSlug = 'current') {
    return this.request(`/jams/${jamSlug}/queue`);
  }

  async vote(submissionId, criteriaScores, feedback) {
    return this.request(`/submissions/${submissionId}/vote`, {
      method: 'POST',
      body: JSON.stringify({ criteriaScores, feedback })
    });
  }

  async getLeaderboard(jamSlug = 'current') {
    return this.request(`/jams/${jamSlug}/leaderboard`);
  }

  // --- Биржа тимейтов (LFG) и инвайты ---
  async sendInvite(teamId, targetUsername, role = 'OTHER', message = '') {
    return this.request(`/teams/${teamId}/invites`, {
      method: 'POST',
      body: JSON.stringify({ targetUsername, role, message })
    });
  }

  async applyToTeam(teamId, role = 'OTHER', message = '') {
    return this.request(`/teams/${teamId}/apply`, {
      method: 'POST',
      body: JSON.stringify({ role, message })
    });
  }

  async getMyInvites() {
    return this.request('/me/invites');
  }

  async respondInvite(inviteId, accept = true) {
    return this.request(`/invites/${inviteId}/respond`, {
      method: 'POST',
      body: JSON.stringify({ accept })
    });
  }

  async getLfgCandidates(jamSlug = 'current', { role, search } = {}) {
    const params = new URLSearchParams();
    if (role) params.set('role', role);
    if (search) params.set('search', search);
    const q = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/jams/${jamSlug}/lfg${q}`);
  }

  async getJamVacancies(jamSlug = 'current', search) {
    const q = search ? `?search=${encodeURIComponent(search)}` : '';
    return this.request(`/jams/${jamSlug}/vacancies${q}`);
  }

  async updateMyLfgProfile({ bio, skills }) {
    return this.request('/me/lfg', {
      method: 'PUT',
      body: JSON.stringify({ bio, skills })
    });
  }

  // --- Дневники разработки (Devlogs) ---
  async getDevlogs(jamSlug = 'current', teamId) {
    const q = teamId ? `?teamId=${encodeURIComponent(teamId)}` : '';
    return this.request(`/jams/${jamSlug}/devlogs${q}`);
  }

  async createDevlog(jamSlug = 'current', { title, content, images = [] }) {
    return this.request(`/jams/${jamSlug}/devlogs`, {
      method: 'POST',
      body: JSON.stringify({ title, content, images })
    });
  }

  async likeDevlog(postId) {
    return this.request(`/devlogs/${postId}/like`, { method: 'POST' });
  }

  async deleteDevlog(postId) {
    return this.request(`/devlogs/${postId}`, { method: 'DELETE' });
  }

  // --- Live SSE поток ---
  connectLiveStream(jamSlug = 'current', onEvent) {
    const sse = new EventSource(`${API_BASE}/jams/${jamSlug}/live`);
    sse.addEventListener('PHASE_CHANGED', (e) => onEvent('PHASE_CHANGED', JSON.parse(e.data)));
    sse.addEventListener('NEW_DEVLOG', (e) => onEvent('NEW_DEVLOG', JSON.parse(e.data)));
    sse.addEventListener('NEW_INVITE', (e) => onEvent('NEW_INVITE', JSON.parse(e.data)));
    sse.addEventListener('NEW_APPLICATION', (e) => onEvent('NEW_APPLICATION', JSON.parse(e.data)));
    sse.addEventListener('INVITE_ACCEPTED', (e) => onEvent('INVITE_ACCEPTED', JSON.parse(e.data)));
    sse.addEventListener('ping', (e) => onEvent('ping', JSON.parse(e.data)));
    sse.onerror = (err) => console.warn('SSE connection error:', err);
    return () => sse.close();
  }
}

export const api = new ApiClient();
