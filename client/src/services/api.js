import axios from 'axios';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Don't redirect automatically on 401, let the auth context handle it
    // Only log the error for debugging
    if (error.response?.status === 401) {
      console.log('401 Unauthorized - Auth context will handle this');
    }
    return Promise.reject(error);
  }
);

// Auth service
export const authService = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (userData) => api.post('/auth/register', userData),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
};

// Session service
export const sessionService = {
  getSessions: () => api.get('/sessions'),
  getSession: (id) => api.get(`/sessions/${id}`),
  createSession: (sessionData) => api.post('/sessions', sessionData),
  joinSession: (id) => api.post(`/sessions/${id}/join`),
  deleteSession: (id) => api.delete(`/sessions/${id}`),
  updateTicket: (id, ticketData) => api.put(`/sessions/${id}/ticket`, ticketData),
};

// Vote service
export const voteService = {
  submitVote: (sessionId, voteData) => api.post(`/votes/${sessionId}`, voteData),
  getVotes: (sessionId) => api.get(`/votes/${sessionId}`),
  revealVotes: (sessionId) => api.post(`/votes/${sessionId}/reveal`),
  resetVotes: (sessionId) => api.post(`/votes/${sessionId}/reset`),
};

// Jira service (optional)
export const jiraService = {
  searchTickets: (query) => api.get(`/jira/search?q=${encodeURIComponent(query)}`),
  getTicket: (key) => api.get(`/jira/ticket/${key}`),
  updateStoryPoints: (key, points) => api.put(`/jira/ticket/${key}/story-points`, { points }),
};

export default api; 