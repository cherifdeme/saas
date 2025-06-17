#!/usr/bin/env node

/**
 * Production Readiness Check Script
 * Vérifie que l'application est prête pour la production
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');

const execAsync = util.promisify(exec);

class ProductionChecker {
  constructor() {
    this.checks = [];
    this.warnings = [];
    this.errors = [];
  }

  /**
   * Ajoute un résultat de vérification
   */
  addCheck(name, status, message = '') {
    this.checks.push({ name, status, message });
    if (status === 'error') {
      this.errors.push(`❌ ${name}: ${message}`);
    } else if (status === 'warning') {
      this.warnings.push(`⚠️  ${name}: ${message}`);
    }
  }

  /**
   * Vérifie l'existence d'un fichier
   */
  checkFileExists(filePath, name) {
    if (fs.existsSync(filePath)) {
      this.addCheck(name, 'ok', `Fichier présent: ${filePath}`);
      return true;
    } else {
      this.addCheck(name, 'error', `Fichier manquant: ${filePath}`);
      return false;
    }
  }

  /**
   * Vérifie la configuration des variables d'environnement
   */
  checkEnvironmentConfig() {
    
    this.checkFileExists('example.env', 'Fichier exemple d\'environnement backend');
    this.checkFileExists('client/example.env', 'Fichier exemple d\'environnement frontend');
    
    // Vérification des variables critiques
    const criticalVars = ['JWT_SECRET', 'MONGODB_URI'];
    criticalVars.forEach(varName => {
      if (process.env[varName]) {
        this.addCheck(`Variable ${varName}`, 'ok', 'Définie');
      } else {
        this.addCheck(`Variable ${varName}`, 'warning', 'Non définie (utiliser .env)');
      }
    });
  }

  /**
   * Vérifie la structure des dossiers
   */
  checkProjectStructure() {
    
    const requiredDirs = [
      'config',
      'constants', 
      'controllers',
      'middleware',
      'models',
      'routes',
      'services',
      'sockets',
      'utils',
      'client/src/components',
      'client/src/contexts',
      'client/src/hooks',
      'client/src/pages',
      'client/src/services',
      'client/src/utils'
    ];

    requiredDirs.forEach(dir => {
      if (fs.existsSync(dir)) {
        this.addCheck(`Dossier ${dir}`, 'ok');
      } else {
        this.addCheck(`Dossier ${dir}`, 'error', 'Dossier manquant');
      }
    });
  }

  /**
   * Vérifie les fichiers de configuration
   */
  checkConfigFiles() {
    console.log('\n⚙️  Vérification des fichiers de configuration...');
    
    const configFiles = [
      '.eslintrc.js',
      '.prettierrc',
      'docker-compose.yml',
      'Dockerfile',
      'package.json',
      'client/package.json'
    ];

    configFiles.forEach(file => {
      this.checkFileExists(file, `Fichier de config ${file}`);
    });
  }

  /**
   * Vérifie les imports et exports
   */
  async checkCodeQuality() {
    console.log('\n🔍 Vérification de la qualité du code...');
    
    try {
      // Vérifier s'il reste des console.log
      const { stdout: consoleLogCheck } = await execAsync(
        'grep -r "console\\.log" --include="*.js" --exclude-dir=node_modules . || true'
      );
      
      if (consoleLogCheck.trim()) {
        this.addCheck('Console.log cleanup', 'warning', 'Des console.log détectés');
      } else {
        this.addCheck('Console.log cleanup', 'ok', 'Aucun console.log trouvé');
      }
    } catch (error) {
      this.addCheck('Code quality check', 'warning', 'Impossible de vérifier les console.log');
    }

    // Vérifier la structure des constantes
    if (fs.existsSync('constants/pokerCards.js')) {
      this.addCheck('Constantes centralisées', 'ok', 'Fichier poker cards présent');
    } else {
      this.addCheck('Constantes centralisées', 'error', 'Fichier de constantes manquant');
    }

    // Vérifier les utilitaires frontend
    if (fs.existsSync('client/src/utils/constants.js')) {
      this.addCheck('Constantes frontend', 'ok');
    } else {
      this.addCheck('Constantes frontend', 'error', 'Fichier de constantes frontend manquant');
    }
  }

  /**
   * Vérifie la sécurité
   */
  checkSecurity() {
    
    // Vérifier la présence des middlewares de sécurité
    const securityMiddleware = [
      'helmet',
      'cors',
      'express-rate-limit',
      'joi'
    ];

    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };

    securityMiddleware.forEach(middleware => {
      if (dependencies[middleware]) {
        this.addCheck(`Middleware ${middleware}`, 'ok', 'Installé');
      } else {
        this.addCheck(`Middleware ${middleware}`, 'error', 'Non installé');
      }
    });

    // Vérifier les middlewares d'authentification
    if (fs.existsSync('middleware/auth.js')) {
      this.addCheck('Middleware d\'authentification', 'ok');
    } else {
      this.addCheck('Middleware d\'authentification', 'error', 'Fichier manquant');
    }
  }

  /**
   * Vérifie la documentation
   */
  checkDocumentation() {
    
    const docFiles = [
      'README.md',
      'PRODUCTION_READY_SUMMARY.md'
    ];

    docFiles.forEach(file => {
      this.checkFileExists(file, `Documentation ${file}`);
    });
  }

  /**
   * Affiche le rapport final
   */
  generateReport() {

    const okChecks = this.checks.filter(c => c.status === 'ok').length;
    const warningChecks = this.checks.filter(c => c.status === 'warning').length;
    const errorChecks = this.checks.filter(c => c.status === 'error').length;


    if (this.warnings.length > 0) {
      this.warnings.forEach(warning => console.log(`  ${warning}`));
    }

    if (this.errors.length > 0) {
      this.errors.forEach(error => console.log(`  ${error}`));
    }

    if (errorChecks === 0) {
      console.log('🎉 APPLICATION PRÊTE POUR LA PRODUCTION!');
      if (warningChecks > 0) {
        console.log('💡 Considérez corriger les avertissements pour une qualité optimale.');
      }
      process.exit(0);
    } else {
      console.log('🚫 APPLICATION NON PRÊTE - Corrigez les erreurs ci-dessus');
      process.exit(1);
    }
  }

  /**
   * Lance toutes les vérifications
   */
  async runAllChecks() {
    console.log('🔍 Lancement des vérifications de production readiness...');
    
    this.checkEnvironmentConfig();
    this.checkProjectStructure();
    this.checkConfigFiles();
    await this.checkCodeQuality();
    this.checkSecurity();
    this.checkDocumentation();
    
    this.generateReport();
  }
}

// Lancer les vérifications
const checker = new ProductionChecker();
checker.runAllChecks().catch(console.error); 