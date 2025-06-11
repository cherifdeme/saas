/**
 * Test rapide du système de chiffrement
 */
import { prepareSecureCredentials, sanitizeForLogging } from './utils/crypto.js';

// Test de chiffrement
const testCrypto = async () => {
  console.log('🔐 Test du système de chiffrement...');
  
  try {
    const credentials = {
      username: 'TestUser',
      password: 'motdepasseultraSecret123!'
    };
    
    console.log('📤 Credentials avant chiffrement:', sanitizeForLogging(credentials));
    
    const secureCredentials = await prepareSecureCredentials(credentials);
    
    console.log('🔒 Credentials après chiffrement:', secureCredentials);
    
    console.log('✅ Chiffrement réussi ! Mot de passe protégé.');
    
  } catch (error) {
    console.error('❌ Erreur lors du test:', error);
  }
};

// Execute test
testCrypto(); 