const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');
const { URL } = require('url');

/** Always allow current RWVCA frontends even if Render env is stale. */
const BUILTIN_FRONTEND_ORIGINS = [
  'https://rwvca-frontend.vercel.app',
  'https://rwvca-frontend1.vercel.app',
  'https://rwvca.org.rw',
  'https://www.rwvca.org.rw',
];

function parseAllowedOrigins() {
  const fromEnv = (process.env.CORS_ORIGINS || 'http://localhost,http://127.0.0.1')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const fromFrontendUrl = String(process.env.FRONTEND_URL || '')
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);
  return [...new Set([...fromEnv, ...fromFrontendUrl, ...BUILTIN_FRONTEND_ORIGINS])];
}

function isRwvcaVercelOrigin(origin) {
  try {
    const { hostname, protocol } = new URL(origin);
    if (protocol !== 'https:') return false;
    // https://rwvca-frontend.vercel.app and https://rwvca-frontend1.vercel.app (+ previews)
    return (
      hostname === 'rwvca-frontend.vercel.app' ||
      hostname === 'rwvca-frontend1.vercel.app' ||
      /^rwvca-frontend(-[\w-]+)?\.vercel\.app$/i.test(hostname) ||
      /^rwvca-frontend1(-[\w-]+)?\.vercel\.app$/i.test(hostname)
    );
  } catch {
    return false;
  }
}

function normalizeHost(host) {
  if (!host) return '';
  return host.split(':')[0].toLowerCase();
}

function getRequestHost(req) {
  const forwarded = req.headers['x-forwarded-host'];
  const raw = typeof forwarded === 'string'
    ? forwarded.split(',')[0].trim()
    : (req.headers.host || '').trim();
  return normalizeHost(raw);
}

function originMatchesAllowed(origin, allowed) {
  if (allowed === '*') return true;
  if (origin === allowed || origin.startsWith(`${allowed}/`)) {
    return true;
  }

  try {
    const originUrl = new URL(origin);
    const allowedUrl = new URL(allowed.includes('://') ? allowed : `http://${allowed}`);
    return originUrl.hostname === allowedUrl.hostname && originUrl.protocol === allowedUrl.protocol;
  } catch {
    return false;
  }
}

function isLocalhostHost(host) {
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
}

function isPrivateLanHost(host) {
  if (isLocalhostHost(host)) return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  const match = host.match(/^172\.(\d{1,2})\.\d{1,3}\.\d{1,3}$/);
  if (match) {
    const second = parseInt(match[1], 10);
    return second >= 16 && second <= 31;
  }
  return false;
}

function isSameHostOrigin(origin, req) {
  if (process.env.CORS_ALLOW_SAME_HOST === '0') return false;

  try {
    const originUrl = new URL(origin);
    return normalizeHost(originUrl.hostname) === getRequestHost(req);
  } catch {
    return false;
  }
}

function isOriginAllowed(origin, req) {
  if (!origin) return true;

  if (isRwvcaVercelOrigin(origin)) {
    return true;
  }

  const allowedOrigins = parseAllowedOrigins();
  if (allowedOrigins.some((allowed) => originMatchesAllowed(origin, allowed))) {
    return true;
  }

  if (isSameHostOrigin(origin, req)) {
    return true;
  }

  try {
    const host = normalizeHost(new URL(origin).hostname);
    if (isLocalhostHost(host)) return true;
    if (process.env.CORS_ALLOW_LAN === '1' && isPrivateLanHost(host)) return true;
  } catch {
    return false;
  }

  return false;
}

const corsConfig = {
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  maxAge: 600,
};

function corsMiddleware(req, res, next) {
  return cors({
    ...corsConfig,
    origin(origin, callback) {
      if (isOriginAllowed(origin, req)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
  })(req, res, next);
}

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_AUTH_MAX || '25', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Try again later.' },
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_API_MAX || '600', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Try again later.' },
  // Never block login / auth bridge (dashboard refresh storms must not lock users out)
  skip: (req) => {
    const path = String(req.originalUrl || req.url || '').toLowerCase();
    return (
      path.includes('/auth/login') ||
      path.includes('/auth/hostel-bridge') ||
      path.includes('/auth/me') ||
      path.includes('/auth/refresh') ||
      path.includes('/auth/logout')
    );
  },
});

const helmetMiddleware = helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false,
});

module.exports = {
  helmetMiddleware,
  cors: corsMiddleware,
  hpp: hpp(),
  authLimiter,
  apiLimiter,
};
