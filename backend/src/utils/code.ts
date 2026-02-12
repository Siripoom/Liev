import crypto from 'node:crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const CODE_LENGTH = 8;
const CODE_REGEX = /^[A-Z0-9]{8}$/;

export function normalizeCode(input: string): string {
  return input.trim().toUpperCase();
}

export function isValidCodeFormat(input: string): boolean {
  return CODE_REGEX.test(input);
}

export function generateAccessCode(): string {
  let output = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    const idx = crypto.randomInt(0, ALPHABET.length);
    output += ALPHABET[idx];
  }
  return output;
}
