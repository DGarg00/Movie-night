const TOKEN_KEY = 'movienight_token';

// In dev, Vite proxies /api to localhost:4000 (see vite.config.js), so this can stay empty.
// In production, set VITE_API_URL to your deployed backend's URL (e.g. https://your-app.onrender.com).
const API_BASE = import.meta.env.VITE_API_URL || '';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(t) {
  localStorage.setItem(TOKEN_KEY, t);
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request(path, { method = 'GET', body, isForm = false } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!isForm) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API_BASE}/api${path}`, {
    method,
    headers,
    body: isForm ? body : body ? JSON.stringify(body) : undefined
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

export const api = {
  register: (regNo, name, password, adminCode) =>
    request('/auth/register', { method: 'POST', body: { regNo, name, password, adminCode } }),
  login: (regNo, password) =>
    request('/auth/login', { method: 'POST', body: { regNo, password } }),
  me: () => request('/auth/me'),

  getMovies: () => request('/movies'),
  addMovie: (movie) => request('/movies', { method: 'POST', body: movie }),
  deleteMovie: (id) => request(`/movies/${id}`, { method: 'DELETE' }),

  getPoll: () => request('/poll'),
  vote: (movieId) => request('/poll/vote', { method: 'POST', body: { movieId } }),
  setNominees: (movieIds) => request('/poll/nominees', { method: 'POST', body: { movieIds } }),

  getSuggestions: () => request('/suggestions'),
  addSuggestion: (name, link, note) => request('/suggestions', { method: 'POST', body: { name, link, note } }),
  toggleUpvote: (id) => request(`/suggestions/${id}/upvote`, { method: 'POST' }),
  deleteSuggestion: (id) => request(`/suggestions/${id}`, { method: 'DELETE' }),

  getLastMovie: () => request('/last-movie'),
  setLastMovie: (movieId) => request('/last-movie', { method: 'POST', body: { movieId } }),
  submitFeedback: (rating, comment) => request('/feedback', { method: 'POST', body: { rating, comment } })
};
