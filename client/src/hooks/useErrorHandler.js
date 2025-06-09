import { useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

/**
 * Custom hook for centralized error handling
 * @returns {Object} - Error handling functions
 */
export const useErrorHandler = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  /**
   * Handles API errors consistently
   * @param {Error} error - The error object
   * @param {string} defaultMessage - Default message if none provided
   * @param {Object} options - Additional options
   * @param {boolean} options.showToast - Whether to show toast notification
   * @param {boolean} options.redirectOnAuth - Whether to redirect on auth errors
   */
  const handleApiError = useCallback((error, defaultMessage = 'Une erreur est survenue', options = {}) => {
    const { showToast = true, redirectOnAuth = true } = options;
    
    let message = defaultMessage;
    let shouldRedirect = false;

    // Check if it's an HTTP error
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      
      switch (status) {
        case 400:
          message = data?.message || 'Données invalides';
          break;
        case 401:
          message = 'Session expirée, veuillez vous reconnecter';
          shouldRedirect = redirectOnAuth;
          break;
        case 403:
          message = 'Accès non autorisé';
          break;
        case 404:
          message = 'Ressource non trouvée';
          break;
        case 429:
          message = 'Trop de requêtes, veuillez patienter';
          break;
        case 500:
          message = 'Erreur serveur, veuillez réessayer plus tard';
          break;
        default:
          message = data?.message || defaultMessage;
      }
    } else if (error.code === 'NETWORK_ERROR') {
      message = 'Erreur de connexion réseau';
    } else if (error.message) {
      message = error.message;
    }

    // Show toast notification if requested
    if (showToast) {
      toast.error(message);
    }

    // Handle authentication errors
    if (shouldRedirect && error.response?.status === 401) {
      logout();
      navigate('/login');
    }

    return { message, shouldRedirect };
  }, [logout, navigate]);

  /**
   * Handles validation errors
   * @param {Object} validationResult - Result from validation function
   * @param {boolean} showToast - Whether to show toast notification
   */
  const handleValidationError = useCallback((validationResult, showToast = true) => {
    if (!validationResult.isValid && showToast) {
      toast.error(validationResult.error);
    }
    return validationResult;
  }, []);

  /**
   * Handles WebSocket errors
   * @param {Error|Object} error - WebSocket error
   * @param {string} defaultMessage - Default message
   */
  const handleWebSocketError = useCallback((error, defaultMessage = 'Erreur de connexion temps réel') => {
    let message = defaultMessage;
    
    if (error.message) {
      message = error.message;
    } else if (typeof error === 'string') {
      message = error;
    }

    toast.error(message);
    
    return { message };
  }, []);

  /**
   * Generic error handler for try-catch blocks
   * @param {Error} error - The caught error
   * @param {string} context - Context where the error occurred
   * @param {Object} options - Error handling options
   */
  const handleError = useCallback((error, context = 'Operation', options = {}) => {
    const { showToast = true } = options;
    
    // Log error for debugging (only in development)
    if (process.env.NODE_ENV === 'development') {
      console.error(`Error in ${context}:`, error);
    }

    if (error.response) {
      return handleApiError(error, `Erreur lors de ${context}`, { showToast, ...options });
    } else {
      const message = error.message || `Erreur lors de ${context}`;
      if (showToast) {
        toast.error(message);
      }
      return { message };
    }
  }, [handleApiError]);

  return {
    handleApiError,
    handleValidationError,
    handleWebSocketError,
    handleError
  };
}; 