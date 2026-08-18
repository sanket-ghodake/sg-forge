import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export interface JwtKeys {
  publicKey: crypto.KeyObject;
  privateKey: crypto.KeyObject;
  jwk: {
    kty: string;
    n: string;
    e: string;
    kid: string;
    alg: string;
    use: string;
  };
}

interface StoredKeyRecord {
  kid: string;
  publicKeyPem: string;
  privateKeyPem: string;
  jwk: any;
}

interface RotatedKeysStore {
  activeKey: JwtKeys;
  historicalKeys: JwtKeys[];
}

function getCacheFilePath(): string {
  const baseDir = process.env.JWT_KEY_CACHE_DIR || path.join(process.cwd(), ".cache");
  return path.join(baseDir, "jwt-keys.json");
}

function saveStoreToDisk(store: RotatedKeysStore) {
  try {
    const cacheFile = getCacheFilePath();
    const dir = path.dirname(cacheFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const data = {
      activeKey: {
        kid: store.activeKey.jwk.kid,
        publicKeyPem: store.activeKey.publicKey.export({ type: "spki", format: "pem" }).toString(),
        privateKeyPem: store.activeKey.privateKey
          .export({ type: "pkcs8", format: "pem" })
          .toString(),
        jwk: store.activeKey.jwk,
      },
      historicalKeys: store.historicalKeys.map((k) => ({
        kid: k.jwk.kid,
        publicKeyPem: k.publicKey.export({ type: "spki", format: "pem" }).toString(),
        privateKeyPem: k.privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
        jwk: k.jwk,
      })),
    };
    fs.writeFileSync(cacheFile, JSON.stringify(data, null, 2), "utf8");
  } catch (_err) {
    // Graceful fallback if filesystem is read-only
  }
}

function loadStoreFromDisk(): RotatedKeysStore | null {
  try {
    const cacheFile = getCacheFilePath();
    if (fs.existsSync(cacheFile)) {
      const raw = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
      if (raw?.activeKey?.publicKeyPem) {
        const activeKey: JwtKeys = {
          publicKey: crypto.createPublicKey(raw.activeKey.publicKeyPem),
          privateKey: crypto.createPrivateKey(raw.activeKey.privateKeyPem),
          jwk: raw.activeKey.jwk,
        };
        const historicalKeys: JwtKeys[] = (raw.historicalKeys || []).map((h: StoredKeyRecord) => ({
          publicKey: crypto.createPublicKey(h.publicKeyPem),
          privateKey: crypto.createPrivateKey(h.privateKeyPem),
          jwk: h.jwk,
        }));
        return { activeKey, historicalKeys };
      }
    }
  } catch (_err) {
    // fallback
  }
  return null;
}

function generateNewKeyPair(kid: string): JwtKeys {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  const jwk = publicKey.export({ format: "jwk" }) as any;
  jwk.kid = kid;
  jwk.alg = "RS256";
  jwk.use = "sig";

  return {
    publicKey,
    privateKey,
    jwk,
  };
}

function getStore(): RotatedKeysStore {
  let store = (globalThis as any).rotatedJwtKeysStore;
  if (!store) {
    const fromDisk = loadStoreFromDisk();
    if (fromDisk) {
      store = fromDisk;
    } else {
      const initialKey = generateNewKeyPair("forge-portal-key-1");
      store = {
        activeKey: initialKey,
        historicalKeys: [],
      };
      saveStoreToDisk(store);
    }
    (globalThis as any).rotatedJwtKeysStore = store;
  }
  return store;
}

export function getKeys(): JwtKeys {
  return getStore().activeKey;
}

export function getPublicKeyByKid(kid: string | undefined): crypto.KeyObject {
  if (!kid) {
    return getStore().activeKey.publicKey;
  }
  const store = getStore();
  if (store.activeKey.jwk.kid === kid) {
    return store.activeKey.publicKey;
  }
  const hist = store.historicalKeys.find((k) => k.jwk.kid === kid);
  if (hist) {
    return hist.publicKey;
  }
  return store.activeKey.publicKey;
}

export function getAllJwks(): any[] {
  const store = getStore();
  const list = [store.activeKey.jwk];
  for (const k of store.historicalKeys) {
    list.push(k.jwk);
  }
  return list;
}

export function rotateKeys(): string {
  const store = getStore();
  const newKid = `forge-portal-key-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const newKey = generateNewKeyPair(newKid);

  store.historicalKeys.unshift(store.activeKey);
  store.activeKey = newKey;

  if (store.historicalKeys.length > 5) {
    store.historicalKeys.pop();
  }

  saveStoreToDisk(store);
  return newKid;
}
