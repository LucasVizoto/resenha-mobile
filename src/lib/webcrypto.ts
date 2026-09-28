import { CryptoDigestAlgorithm, digest, getRandomValues } from 'expo-crypto';

const DIGESTS: Record<string, CryptoDigestAlgorithm> = {
  'SHA-1': CryptoDigestAlgorithm.SHA1,
  'SHA-256': CryptoDigestAlgorithm.SHA256,
  'SHA-384': CryptoDigestAlgorithm.SHA384,
  'SHA-512': CryptoDigestAlgorithm.SHA512,
};

type DigestAlgorithm = { name: string };

function bytesFrom(data: ArrayBuffer | ArrayBufferView): Uint8Array<ArrayBuffer> {
  const source =
    data instanceof ArrayBuffer
      ? new Uint8Array(data)
      : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  const copy = new Uint8Array(source.byteLength);
  copy.set(source);
  return copy;
}

async function subtleDigest(
  algorithm: string | DigestAlgorithm,
  data: ArrayBuffer | ArrayBufferView,
): Promise<ArrayBuffer> {
  const name = typeof algorithm === 'string' ? algorithm : algorithm.name;
  const expoAlgorithm = DIGESTS[name];
  if (!expoAlgorithm) {
    throw new Error(`Digest ${name} não suportado neste app.`);
  }
  return digest(expoAlgorithm, bytesFrom(data));
}

function installWebCrypto(): void {
  const current = globalThis.crypto;
  if (typeof current?.subtle?.digest === 'function') return;

  const subtle = { digest: subtleDigest };
  if (current) {
    try {
      Object.defineProperty(current, 'subtle', { value: subtle, configurable: true });
      return;
    } catch {
      // Some runtimes expose a sealed crypto without subtle.
    }
  }

  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: {
      getRandomValues,
      subtle,
    },
  });
}

installWebCrypto();
