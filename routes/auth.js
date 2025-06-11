const express = require('express');
const Joi = require('joi');
const User = require('../models/User');
const { generateToken, createTokenCookie, clearTokenCookie } = require('../utils/jwt');
const { authenticate } = require('../middleware/auth');
const connectionManager = require('../services/connectionManager');
const { secureLog } = require('../middleware/sanitizeLogging');

const router = express.Router();

// Validation schemas
const registerSchema = Joi.object({
  username: Joi.string().min(3).max(30).required(),
  password: Joi.string().min(6).optional(),
  passwordHash: Joi.string().optional(),
  clientHash: Joi.boolean().optional()
});

const loginSchema = Joi.object({
  username: Joi.string().required(),
  password: Joi.string().optional(),
  passwordHash: Joi.string().optional(),
  clientHash: Joi.boolean().optional()
});

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', async (req, res) => {
  try {
    // Validate input
    const { error } = registerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const { username, password, passwordHash, clientHash } = req.body;
    
    // 🔐 SÉCURITÉ: Déterminer le mot de passe à utiliser
    let finalPassword;
    if (clientHash && passwordHash) {
      // Mot de passe déjà chiffré côté client
      finalPassword = passwordHash;
    } else if (password) {
      // Mot de passe en clair - pour compatibilité descendante
      finalPassword = password;
    } else {
      return res.status(400).json({ message: 'Mot de passe requis' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: 'Un utilisateur avec ce nom existe déjà' });
    }

    // Create new user
    const user = new User({
      username,
      passwordHash: finalPassword // Will be hashed by the pre-save hook or used directly if already hashed
    });

    await user.save();

    // 🔐 SÉCURITÉ: Enregistrer la connexion pour le nouvel utilisateur
    connectionManager.registerConnection(username, user._id.toString());

    // Generate token and set cookie
    const token = generateToken(user._id);
    createTokenCookie(res, token);

    // Log de création et connexion (sans mot de passe)
    secureLog('info', `Nouvel utilisateur "${username}" créé et connecté.`, { 
      userId: user._id.toString(),
      ip: req.ip 
    });

    res.status(201).json({
      message: 'Utilisateur créé avec succès',
      user: {
        id: user._id,
        username: user.username
      }
    });
  } catch (error) {
    secureLog('error', 'Erreur lors de l\'inscription', error, { 
      ip: req.ip 
    });
    res.status(500).json({ message: 'Erreur interne du serveur' });
  }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', async (req, res) => {
  try {
    // Validate input
    const { error } = loginSchema.validate(req.body);
    if (error) {
      secureLog('warn', 'Tentative de connexion avec données invalides', { 
        error: error.details[0].message,
        ip: req.ip 
      });
      return res.status(400).json({ message: error.details[0].message });
    }

      const { username, password, passwordHash, clientHash } = req.body;
  
  // 🔐 SÉCURITÉ: Déterminer le mot de passe à utiliser
  let finalPassword;
  if (clientHash && passwordHash) {
    // Mot de passe déjà chiffré côté client - utiliser directement
    finalPassword = passwordHash;
  } else if (password) {
    // Mot de passe en clair - pour compatibilité descendante
    finalPassword = password;
  } else {
    secureLog('warn', 'Tentative de connexion sans mot de passe', { 
      username, 
      ip: req.ip 
    });
    return res.status(400).json({ message: 'Mot de passe requis' });
  }

  // 🔐 SÉCURITÉ: Vérifier si l'utilisateur est déjà connecté
  if (connectionManager.isUserConnected(username)) {
      secureLog('warn', 'Tentative de double connexion refusée', { 
        username, 
        ip: req.ip,
        userAgent: req.get('User-Agent') 
      });
      return res.status(409).json({ 
        message: 'Utilisateur déjà connecté. Une seule session est autorisée par utilisateur.' 
      });
    }

    // Find user
    const user = await User.findOne({ username });
    if (!user) {
      secureLog('warn', 'Tentative de connexion avec utilisateur inexistant', { 
        username, 
        ip: req.ip 
      });
      return res.status(401).json({ message: 'Nom d\'utilisateur ou mot de passe incorrect' });
    }

    // Check password - gestion chiffrement côté client
    let isPasswordValid;
    if (clientHash && passwordHash) {
      // Comparer directement le hash côté client avec le hash stocké
      // Pour l'instant, utiliser le même hash pour le stockage (migration progressive)
      isPasswordValid = await user.comparePassword(finalPassword);
    } else {
      // Méthode classique pour compatibilité
      isPasswordValid = await user.comparePassword(finalPassword);
    }
    if (!isPasswordValid) {
      secureLog('warn', 'Tentative de connexion avec mot de passe incorrect', { 
        username, 
        ip: req.ip 
      });
      return res.status(401).json({ message: 'Nom d\'utilisateur ou mot de passe incorrect' });
    }

    // 🔐 SÉCURITÉ: Enregistrer la connexion avant de créer le token
    const connectionRegistered = connectionManager.registerConnection(username, user._id.toString());
    if (!connectionRegistered) {
      // Race condition: quelqu'un s'est connecté entre temps
      secureLog('warn', 'Race condition détectée lors de la connexion', { 
        username, 
        ip: req.ip 
      });
      return res.status(409).json({ 
        message: 'Utilisateur déjà connecté. Une seule session est autorisée par utilisateur.' 
      });
    }

    // Generate token and set cookie
    const token = generateToken(user._id);
    createTokenCookie(res, token);

    // Log de connexion réussie (sans mot de passe)
    secureLog('info', `Utilisateur "${username}" connecté.`, { 
      userId: user._id.toString(),
      ip: req.ip 
    });

    res.json({
      message: 'Connexion réussie',
      user: {
        id: user._id,
        username: user.username
      }
    });
  } catch (error) {
    secureLog('error', 'Erreur lors de la connexion', error, { 
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    res.status(500).json({ message: 'Erreur interne du serveur' });
  }
});

// @route   POST /api/auth/logout
// @desc    Logout user
// @access  Private
router.post('/logout', authenticate, (req, res) => {
  try {
    const username = req.user.username;
    
    // 🔐 SÉCURITÉ: Supprimer la connexion du gestionnaire
    connectionManager.removeConnectionByUsername(username);
    
    // Nettoyer le cookie
    clearTokenCookie(res);
    
    // Log de déconnexion
    secureLog('info', `Utilisateur "${username}" déconnecté.`, { 
      userId: req.user._id.toString(),
      ip: req.ip 
    });
    
    res.json({ message: 'Déconnexion réussie' });
  } catch (error) {
    secureLog('error', 'Erreur lors de la déconnexion', error, { 
      ip: req.ip 
    });
    res.status(500).json({ message: 'Erreur lors de la déconnexion' });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', authenticate, (req, res) => {
  res.json({
    user: {
      id: req.user._id,
      username: req.user.username
    }
  });
});

module.exports = router; 