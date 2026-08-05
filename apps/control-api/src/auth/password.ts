import { randomBytes, scrypt as nodeScrypt, timingSafeEqual } from 'node:crypto';

const SCRYPT_N = 16_384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;
const MAX_MEMORY = 64 * 1024 * 1024;

// Deliberately valid but non-matching. Unknown users still pay the scrypt cost.
const DUMMY_PASSWORD_HASH = [
  'scrypt',
  SCRYPT_N,
  SCRYPT_R,
  SCRYPT_P,
  Buffer.alloc(16).toString('base64'),
  Buffer.alloc(KEY_LENGTH).toString('base64'),
].join('$');

function deriveKey(
  password: string,
  salt: Buffer,
  keyLength: number,
  parameters: { N: number; r: number; p: number },
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    nodeScrypt(password, salt, keyLength, { ...parameters, maxmem: MAX_MEMORY }, (error, key) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(key);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await deriveKey(password, salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });

  return ['scrypt', SCRYPT_N, SCRYPT_R, SCRYPT_P, salt.toString('base64'), key.toString('base64')].join(
    '$',
  );
}

export async function verifyPassword(password: string, encodedHash?: string): Promise<boolean> {
  const candidateHash = encodedHash ?? DUMMY_PASSWORD_HASH;
  const [algorithm, nText, rText, pText, saltText, keyText] = candidateHash.split('$');
  const N = Number(nText);
  const r = Number(rText);
  const p = Number(pText);

  if (
    algorithm !== 'scrypt' ||
    !saltText ||
    !keyText ||
    !Number.isSafeInteger(N) ||
    !Number.isSafeInteger(r) ||
    !Number.isSafeInteger(p) ||
    N < SCRYPT_N ||
    N > 262_144 ||
    r < 1 ||
    r > 32 ||
    p < 1 ||
    p > 8
  ) {
    return false;
  }

  try {
    const expected = Buffer.from(keyText, 'base64');
    const actual = await deriveKey(password, Buffer.from(saltText, 'base64'), expected.length, { N, r, p });
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
