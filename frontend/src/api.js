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

async function request(path, { method = 'GET', body } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API_BASE}/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

export const api = {
  googleAuth: (credential) => request('/auth/google', { method: 'POST', body: { credential } }),
  claimAdmin: (code) => request('/auth/claim-admin', { method: 'POST', body: { code } }),
  me: () => request('/auth/me'),

  getMovies: () => request('/movies'),
  addMovie: (movie) => request('/movies', { method: 'POST', body: movie }),
  updateMovie: (id, movie) => request(`/movies/${id}`, { method: 'PUT', body: movie }),
  deleteMovie: (id) => request(`/movies/${id}`, { method: 'DELETE' }),

  getPoll: () => request('/poll'),
  vote: (movieId) => request('/poll/vote', { method: 'POST', body: { movieId } }),
  unvote: () => request('/poll/vote', { method: 'DELETE' }),
  setNominees: (movieIds) => request('/poll/nominees', { method: 'POST', body: { movieIds } }),

  getSuggestions: () => request('/suggestions'),
  addSuggestion: (name, link, note) => request('/suggestions', { method: 'POST', body: { name, link, note } }),
  toggleUpvote: (id) => request(`/suggestions/${id}/upvote`, { method: 'POST' }),
  toggleDownvote: (id) => request(`/suggestions/${id}/downvote`, { method: 'POST' }),
  deleteSuggestion: (id) => request(`/suggestions/${id}`, { method: 'DELETE' }),
  resetSuggestionLimit: (email) => request('/suggestions/reset-limit', { method: 'POST', body: { email } }),

  getLastMovie: () => request('/last-movie'),
  setLastMovie: (movieId, shownDate) => request('/last-movie', { method: 'POST', body: { movieId, shownDate } }),
  submitFeedback: (rating, comment, experience) => request('/feedback', { method: 'POST', body: { rating, comment, experience } }),
  removeMyComment: () => request('/feedback/comment', { method: 'DELETE' }),

  getScreenings: () => request('/screenings'),

  adminReset: (scope) => request('/admin/reset', { method: 'POST', body: { scope } })
};
