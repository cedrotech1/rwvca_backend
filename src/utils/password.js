import bcrypt from "bcryptjs";
import crypto from "crypto";

const SALT_ROUNDS = 10;

export async function hashPassword(plain) {
  return bcrypt.hash(String(plain), SALT_ROUNDS);
}

export async function verifyPassword(plain, hash) {
  if (!plain || !hash) return false;
  const normalized = String(hash).replace(/^\$2y\$/, "$2b$");
  try {
    return await bcrypt.compare(String(plain), normalized);
  } catch (error) {
    return false;
  }
}

export function generatePassword(length = 12) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+";
  const bytes = crypto.randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += chars[bytes[i] % chars.length];
  }
  return out;
}

export function generateResetCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, "0");
}
