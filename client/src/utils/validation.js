import { POKER_CARDS } from './constants';

/**
 * Validation helpers for the frontend
 */

/**
 * Validates if a string is not empty and within length limits
 * @param {string} value - Value to validate
 * @param {number} minLength - Minimum length (default: 1)
 * @param {number} maxLength - Maximum length (default: 100)
 * @returns {Object} - { isValid: boolean, error: string }
 */
export const validateStringLength = (value, minLength = 1, maxLength = 100) => {
  if (!value || typeof value !== 'string') {
    return { isValid: false, error: 'Une valeur est requise' };
  }
  
  const trimmedValue = value.trim();
  
  if (trimmedValue.length < minLength) {
    return { isValid: false, error: `Minimum ${minLength} caractère(s) requis` };
  }
  
  if (trimmedValue.length > maxLength) {
    return { isValid: false, error: `Maximum ${maxLength} caractères autorisés` };
  }
  
  return { isValid: true, error: null };
};

/**
 * Validates a session name
 * @param {string} name - Session name to validate
 * @returns {Object} - { isValid: boolean, error: string }
 */
export const validateSessionName = (name) => {
  return validateStringLength(name, 1, 100);
};

/**
 * Validates a vote value
 * @param {string} value - Vote value to validate
 * @returns {Object} - { isValid: boolean, error: string }
 */
export const validateVoteValue = (value) => {
  if (!value) {
    return { isValid: false, error: 'Une valeur de vote est requise' };
  }
  
  if (!POKER_CARDS.includes(value)) {
    return { isValid: false, error: 'Valeur de vote invalide' };
  }
  
  return { isValid: true, error: null };
};

/**
 * Validates username format
 * @param {string} username - Username to validate
 * @returns {Object} - { isValid: boolean, error: string }
 */
export const validateUsername = (username) => {
  const result = validateStringLength(username, 3, 30);
  if (!result.isValid) {
    return result;
  }
  
  // Check for valid characters (alphanumeric and underscore)
  const usernameRegex = /^[a-zA-Z0-9_]+$/;
  if (!usernameRegex.test(username.trim())) {
    return { 
      isValid: false, 
      error: 'Le nom d\'utilisateur ne peut contenir que des lettres, chiffres et underscores' 
    };
  }
  
  return { isValid: true, error: null };
};

/**
 * Validates password strength
 * @param {string} password - Password to validate
 * @returns {Object} - { isValid: boolean, error: string }
 */
export const validatePassword = (password) => {
  const result = validateStringLength(password, 6, 128);
  if (!result.isValid) {
    return { isValid: false, error: 'Le mot de passe doit contenir au moins 6 caractères' };
  }
  
  return { isValid: true, error: null };
};

/**
 * Validates email format (if needed in the future)
 * @param {string} email - Email to validate
 * @returns {Object} - { isValid: boolean, error: string }
 */
export const validateEmail = (email) => {
  if (!email || typeof email !== 'string') {
    return { isValid: false, error: 'Une adresse email est requise' };
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return { isValid: false, error: 'Format d\'email invalide' };
  }
  
  return { isValid: true, error: null };
};

/**
 * Sanitizes user input to prevent XSS
 * @param {string} input - Input to sanitize
 * @returns {string} - Sanitized input
 */
export const sanitizeInput = (input) => {
  if (!input || typeof input !== 'string') {
    return '';
  }
  
  return input
    .trim()
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}; 