import { logger } from '../middleware/logger';

interface ConfigValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validates critical configuration settings at startup
 * In production mode, insecure defaults will prevent the server from starting
 * In development mode, warnings are logged but the server will start
 */
export function validateConfig(): ConfigValidationResult {
  const isProduction = process.env.NODE_ENV === 'production';
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate CORS_ORIGIN
  const corsOrigin = process.env.CORS_ORIGIN;
  if (!corsOrigin || corsOrigin === '*') {
    const message = 'CORS_ORIGIN is set to allow all origins (*). Set specific origins in production.';
    if (isProduction) {
      errors.push(message);
    } else {
      warnings.push(message + ' (acceptable for development)');
    }
  }

  // Validate DB_PASSWORD
  const dbPassword = process.env.DB_PASSWORD;
  const insecureDbPasswords = ['password', '123456', 'simflow', 'postgres', 'admin'];
  if (dbPassword && insecureDbPasswords.some(insecure => dbPassword.toLowerCase() === insecure)) {
    const message = 'DB_PASSWORD appears to be a weak password. Use a strong password in production.';
    if (isProduction) {
      errors.push(message);
    } else {
      warnings.push(message);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Run configuration validation and exit if invalid in production
 */
export function enforceSecureConfig(): void {
  const result = validateConfig();
  const isProduction = process.env.NODE_ENV === 'production';

  // Log warnings
  result.warnings.forEach(warning => {
    logger.warn(`CONFIG WARNING: ${warning}`);
  });

  // Log errors
  result.errors.forEach(error => {
    logger.error(`CONFIG ERROR: ${error}`);
  });

  // In production, exit if configuration is invalid
  if (!result.isValid) {
    logger.error('');
    logger.error('═══════════════════════════════════════════════════════════════');
    logger.error('  SECURITY CONFIGURATION ERROR - SERVER CANNOT START');
    logger.error('═══════════════════════════════════════════════════════════════');
    logger.error('');
    logger.error('  The server detected insecure configuration that cannot be');
    logger.error('  used in production. Please fix the following issues:');
    logger.error('');
    result.errors.forEach((error, index) => {
      logger.error(`  ${index + 1}. ${error}`);
    });
    logger.error('');
    logger.error('  For help, see .env.example for proper configuration.');
    logger.error('');
    logger.error('═══════════════════════════════════════════════════════════════');
    process.exit(1);
  }

  // Log success message
  if (isProduction) {
    logger.info('Security configuration validated successfully');
  } else if (result.warnings.length > 0) {
    logger.info(`Running in development mode with ${result.warnings.length} configuration warning(s)`);
  }
}
