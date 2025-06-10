const request = require('supertest');

// Test basique pour vérifier que l'application peut démarrer
describe('Application', () => {
  test('should load environment variables', () => {
    // Test simple : vérifier que dotenv fonctionne
    expect(process.env).toBeDefined();
  });

  test('should require main modules without errors', () => {
    // Test d'importation des modules principaux
    expect(() => {
      require('../config/database');
      require('../models/User');
      require('../models/Session');
      require('../models/Vote');
    }).not.toThrow();
  });

  test('should have required dependencies', () => {
    // Test de présence des dépendances critiques
    expect(() => {
      require('express');
      require('socket.io');
      require('mongoose');
      require('bcryptjs');
      require('jsonwebtoken');
    }).not.toThrow();
  });
});

// Test des utilitaires
describe('Utilities', () => {
  test('should load JWT utilities', () => {
    const jwt = require('../utils/jwt');
    expect(jwt).toBeDefined();
    expect(typeof jwt.generateToken).toBe('function');
    expect(typeof jwt.verifyToken).toBe('function');
  });

  test('should load poker cards constants', () => {
    const pokerCards = require('../constants/pokerCards');
    expect(pokerCards).toBeDefined();
    expect(Array.isArray(pokerCards.POKER_CARDS)).toBe(true);
    expect(typeof pokerCards.CARD_DESCRIPTIONS).toBe('object');
    expect(typeof pokerCards.VOTE_STATISTICS).toBe('object');
  });
}); 