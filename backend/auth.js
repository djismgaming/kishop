const crypto = require('crypto');

/**
 * Hash a password using scrypt with a random salt
 * @param {string} password - Plain text password
 * @returns {string} Salt and hash joined with a colon
 */
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Verify a plain text password against a stored salt:hash pair
 * Uses timing-safe comparison to avoid leaking information about the hash
 * @param {string} password - Plain text password to check
 * @param {string} stored - Stored "salt:hash" string
 * @returns {boolean} True if the password matches
 */
function verifyPassword(password, stored) {
  if (typeof stored !== 'string' || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  if (candidate.length !== expected.length) return false;
  return crypto.timingSafeEqual(candidate, expected);
}

/**
 * Generate a cryptographically random session token
 * @returns {string} Hex-encoded 32 byte token
 */
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

module.exports = { hashPassword, verifyPassword, generateToken };
