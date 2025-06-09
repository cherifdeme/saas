/**
 * Planning Poker card values
 * Standard Fibonacci sequence with additional values
 */
const POKER_CARDS = ['1', '2', '3', '5', '8', '13', '21', '40', '∞', '?'];

/**
 * Card descriptions for better UX
 */
const CARD_DESCRIPTIONS = {
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
const VOTE_STATISTICS = {
  CONSENSUS_THRESHOLD: 0.7, // 70% of votes need to be the same for consensus
  OUTLIER_THRESHOLD: 2 // Values more than 2 steps away are considered outliers
};

module.exports = {
  POKER_CARDS,
  CARD_DESCRIPTIONS,
  VOTE_STATISTICS
}; 