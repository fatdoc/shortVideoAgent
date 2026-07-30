export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalize(item)).join(',')}]`;
  }

  const record = value as Record<string, unknown>;
  const entries = Object.keys(record)
    .sort()
    .filter((key) => record[key] !== undefined)
    .map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`);
  return `{${entries.join(',')}}`;
}

const SHA256_INITIAL_HASH = [
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
  0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
];

const SHA256_ROUND_CONSTANTS = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
  0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
  0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
  0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
  0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
  0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

// Small synchronous SHA-256 implementation keeps the browser-only Demo fixture deterministic
// without introducing Node APIs or an additional runtime dependency.
export function sha256(value: string): string {
  const rightRotate = (input: number, amount: number) =>
    (input >>> amount) | (input << (32 - amount));
  const maxWord = 2 ** 32;
  const words: number[] = [];
  const hash = SHA256_INITIAL_HASH.slice();
  const constants = SHA256_ROUND_CONSTANTS;
  let encoded = '';
  for (const byte of new TextEncoder().encode(value)) {
    encoded += String.fromCharCode(byte);
  }
  const encodedBitLength = encoded.length * 8;

  encoded += '\x80';
  while ((encoded.length % 64) !== 56) encoded += '\x00';

  for (let index = 0; index < encoded.length; index += 1) {
    const code = encoded.charCodeAt(index);
    words[index >> 2] = (words[index >> 2] ?? 0) | (code << ((3 - (index % 4)) * 8));
  }

  words.push(Math.floor(encodedBitLength / maxWord));
  words.push(encodedBitLength);

  for (let offset = 0; offset < words.length; offset += 16) {
    const schedule = words.slice(offset, offset + 16);
    const previousHash = hash.slice();

    for (let round = 0; round < 64; round += 1) {
      const word = schedule[round];
      if (round >= 16) {
        const w15 = schedule[round - 15];
        const w2 = schedule[round - 2];
        const gamma0 =
          rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
        const gamma1 =
          rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);
        schedule[round] =
          (schedule[round - 16] + gamma0 + schedule[round - 7] + gamma1) | 0;
      }

      const sigma1 =
        rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25);
      const choice = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
      const temp1 =
        (hash[7] + sigma1 + choice + constants[round] + (word ?? schedule[round])) | 0;
      const sigma0 =
        rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22);
      const majority =
        (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
      const temp2 = (sigma0 + majority) | 0;

      hash[7] = hash[6];
      hash[6] = hash[5];
      hash[5] = hash[4];
      hash[4] = (hash[3] + temp1) | 0;
      hash[3] = hash[2];
      hash[2] = hash[1];
      hash[1] = hash[0];
      hash[0] = (temp1 + temp2) | 0;
    }

    for (let index = 0; index < 8; index += 1) {
      hash[index] = (hash[index] + previousHash[index]) | 0;
    }
  }

  return hash
    .map((word) => (word >>> 0).toString(16).padStart(8, '0'))
    .join('');
}

export function digestValue(value: unknown): string {
  return `sha256:${sha256(canonicalize(value))}`;
}
