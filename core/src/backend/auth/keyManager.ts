import crypto from "crypto";

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

interface RotatedKeysStore {
  activeKey: JwtKeys;
  historicalKeys: JwtKeys[];
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
    const initialKey = generateNewKeyPair("forge-portal-key-1");
    store = {
      activeKey: initialKey,
      historicalKeys: [],
    };
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

  return newKid;
}
