module.exports = {
  // Environment de test
  testEnvironment: 'node',
  
  // Patterns de fichiers de test
  testMatch: [
    '**/tests/**/*.test.js',
    '**/__tests__/**/*.test.js',
    '**/*.test.js'
  ],
  
  // Dossiers à ignorer
  testPathIgnorePatterns: [
    '/node_modules/',
    '/client/',
    '/build/',
    '/dist/'
  ],
  
  // Coverage
  collectCoverageFrom: [
    '**/*.js',
    '!**/node_modules/**',
    '!**/client/**',
    '!**/tests/**',
    '!**/coverage/**',
    '!jest.config.js',
    '!server.js' // Serveur principal exclu car difficile à tester unitairement
  ],
  
  // Seuils de couverture (optionnels)
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50
    }
  },
  
  // Setup files
  setupFiles: ['<rootDir>/tests/setup.js'],
  
  // Timeout pour les tests (utile pour les tests d'API)
  testTimeout: 10000
}; 