/**
 * Planning Poker card values
 * Standard Fibonacci sequence with additional values
 */
export const POKER_CARDS = ['1', '2', '3', '5', '8', '13', '21', '40', '∞', '?'];

/**
 * Card descriptions for better UX
 */
export const CARD_DESCRIPTIONS = {
  '1': '1 point - Très simple',
  '2': '2 points - Simple', 
  '3': '3 points - Facile',
  '5': '5 points - Moyen',
  '8': '8 points - Difficile',
  '13': '13 points - Très difficile',
  '21': '21 points - Complexe',
  '40': '40 points - Très complexe',
  '∞': 'Infini - Trop complexe à estimer',
  '?': 'Incertain - Besoin de plus d\'informations'
};

/**
 * Vote statistics helpers
 */
export const VOTE_STATISTICS = {
  CONSENSUS_THRESHOLD: 0.7, // 70% of votes need to be the same for consensus
  OUTLIER_THRESHOLD: 2 // Values more than 2 steps away are considered outliers
};

/**
 * Session storage keys for consistency
 */
export const SESSION_STORAGE_KEYS = {
  SESSION_ID: 'currentSessionId',
  USER_ID: 'currentUserId',
  USERNAME: 'currentUsername'
};

/**
 * API endpoints configuration
 */
export const API_ENDPOINTS = {
  BASE_URL: process.env.REACT_APP_API_URL || '/api',
  WEBSOCKET_URL: process.env.REACT_APP_SERVER_URL || 'http://localhost:5000'
};

/**
 * UI constants
 */
export const UI_CONSTANTS = {
  PRESENCE_SYNC_DELAY: 500,
  RECONNECT_DELAY: 300,
  TOAST_DURATION: 3000
}; 