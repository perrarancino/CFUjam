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

  async getJamCriteriaPresets() {
    return this.request('/jams/criteria/presets');
  }

  // --- Команды ---
  async getTeams(jamSlug = 'current', search) {
    const q = search ? `?search=${encodeURIComponent(search)}` : '';
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

  // --- Live SSE поток ---
  connectLiveStream(jamSlug = 'current', onEvent) {
    const sse = new EventSource(`${API_BASE}/jams/${jamSlug}/live`);
    sse.addEventListener('PHASE_CHANGED', (e) => onEvent('PHASE_CHANGED', JSON.parse(e.data)));
    sse.addEventListener('ping', (e) => onEvent('ping', JSON.parse(e.data)));
    sse.onerror = (err) => console.warn('SSE connection error:', err);
    return () => sse.close();
  }
}

export const api = new ApiClient();
