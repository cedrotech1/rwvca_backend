/**
 * Validates required environment variables at startup.
 */

const LOCAL_DB_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);
const CLOUD_DB_PATTERN = /render\.com|amazonaws\.com|rds\.|azure\.com|mongodb\.net|supabase/i;

export function isLocalDbHost(host) {
  if (!host || typeof host !== 'string') return false;
  return LOCAL_DB_HOSTS.has(host.trim().toLowerCase());
}

export function validateEnv() {
  const errors = [];
  const isProd = process.env.NODE_ENV === 'production';

  if (!process.env.JWT_SECRET) {
    errors.push('JWT_SECRET is required');
  } else if (process.env.JWT_SECRET.length < 32) {
    errors.push('JWT_SECRET must be at least 32 characters');
  } else if (isProd && ['secret', 'changeme', 'your-secret'].includes(process.env.JWT_SECRET.toLowerCase())) {
    errors.push('JWT_SECRET must not use a default/weak value in production');
  }

  const devHost = process.env.DEV_DATABASE_HOST;
  const proHost = process.env.PRO_DATABASE_HOST;
  const uatHost = process.env.UAT_DATABASE_HOST || devHost;
  const devName = process.env.DEV_DATABASE_NAME;
  const proName = process.env.PRO_DATABASE_NAME;
  const uatName = process.env.UAT_DATABASE_NAME || 'rwvca_uat';

  if (!isProd && (!devHost || !devName)) {
    errors.push('DEV_DATABASE_* configuration is incomplete');
  }
  if (isProd && (!proHost || !proName)) {
    errors.push('PRO_DATABASE_* configuration is incomplete');
  }
  if (process.env.NODE_ENV === 'uat' && (!uatHost || !uatName)) {
    errors.push('UAT_DATABASE_* configuration is incomplete for NODE_ENV=uat');
  }

  // Development uses DEV_DATABASE_*. A remote PRO_DATABASE_HOST may stay in the file for production.
  if (!isProd) {
    const activeHost = process.env.NODE_ENV === 'uat' ? uatHost : devHost;
    if (activeHost && !isLocalDbHost(activeHost)) {
      errors.push(`The ${process.env.NODE_ENV === 'uat' ? 'UAT' : 'DEV'}_DATABASE_HOST must be local only (got: ${activeHost})`);
    }
    if (activeHost && CLOUD_DB_PATTERN.test(activeHost)) {
      errors.push(`Remote cloud database host is not allowed outside production: ${activeHost}`);
    }
  }

  if (errors.length > 0) {
    console.error('Environment validation failed:');
    errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }
}
