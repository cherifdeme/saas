import axios from 'axios';
import { prepareSecureCredentials, sanitizeForLogging } from '../utils/crypto';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 🔐 UTILISATEURS DE TEST : Liste des comptes de démonstration
const TEST_USERS = ['AmySy', 'JonDoe', 'AdminTest', 'ScrumMaster'];

// 🔐 FONCTION DE COMPATIBILITÉ : Détermine si on doit utiliser le chiffrement
const shouldUseClientEncryption = (username) => {
  // Désactiver le chiffrement pour les utilisateurs de test
  if (TEST_USERS.includes(username)) {
    console.log(`🔓 Mode compatibilité activé pour l'utilisateur de test: ${username}`);
    return false;
  }
  
  // Activer le chiffrement pour tous les nouveaux utilisateurs
  return true;
};

// Request interceptor for logging (sans mots de passe)
api.interceptors.request.use(
  (config) => {
    // Logger la requête de manière sécurisée
    if (process.env.NODE_ENV === 'development') {
      console.log('🔐 Requête API:', {
        method: config.method?.toUpperCase(),
        url: config.url,
        data: sanitizeForLogging(config.data)
      });
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

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

// Auth service avec chiffrement automatique
export const authService = {
  // 🔐 SÉCURITÉ : Login avec chiffrement côté client intelligent
  login: async (credentials) => {
    const useEncryption = shouldUseClientEncryption(credentials.username);
    
    if (useEncryption) {
      // Nouveau système : chiffrement côté client
      const secureCredentials = await prepareSecureCredentials(credentials);
      return api.post('/auth/login', secureCredentials);
    } else {
      // Mode compatibilité : envoi direct pour les utilisateurs de test
      console.log('🔓 Connexion en mode compatibilité (sans chiffrement côté client)');
      return api.post('/auth/login', {
        username: credentials.username,
        password: credentials.password // Envoi direct pour les utilisateurs de test
      });
    }
  },
  
  // 🔐 SÉCURITÉ : Register avec chiffrement côté client intelligent  
  register: async (userData) => {
    const useEncryption = shouldUseClientEncryption(userData.username);
    
    if (useEncryption) {
      // Nouveau système : chiffrement côté client
      const secureUserData = await prepareSecureCredentials(userData);
      return api.post('/auth/register', secureUserData);
    } else {
      // Mode compatibilité : envoi direct (rare, mais possible)
      console.log('🔓 Inscription en mode compatibilité (sans chiffrement côté client)');
      return api.post('/auth/register', userData);
    }
  },
  
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
};

// Session service
export const sessionService = {
  getSessions: () => api.get('/sessions'),
  getSession: (id) => api.get(`/sessions/${id}`),
  createSession: (sessionData) => api.post('/sessions', sessionData),
  joinSession: (id) => api.post(`/sessions/${id}/join`),
  leaveSession: (id) => api.post(`/sessions/${id}/leave`),
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