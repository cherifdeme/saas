// Setup global pour les tests Jest
require('dotenv').config({ path: '.env.test' });

// Variables d'environnement par défaut pour les tests
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/planning-poker-test';
process.env.PORT = process.env.PORT || 3001;

// Désactiver les logs pendant les tests (optionnel)
if (process.env.SILENT_TESTS === 'true') {
  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};
} 