import { PublicError } from "./avatar-contract.ts";

const encoder = new TextEncoder();
const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
function decode(value: string) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}
export type SealedCredential = {
  ciphertext: string;
  nonce: string;
  key_version: string;
};
export type CredentialBinding = {
  userId: string;
  connectionId: string;
  provider: string;
};
function additionalData(binding: CredentialBinding) {
  return encoder.encode(
    JSON.stringify([binding.userId, binding.connectionId, binding.provider]),
  );
}

export function credentialVault(
  keys: Record<string, string>,
  activeVersion: string,
) {
  async function key(version: string) {
    try {
      if (!keys[version]) throw new Error("Unavailable key version");
      const bytes = decode(keys[version]);
      if (bytes.length !== 32) throw new Error("Invalid key length");
      return await crypto.subtle.importKey("raw", bytes, "AES-GCM", false, [
        "encrypt",
        "decrypt",
      ]);
    } catch {
      throw new PublicError(
        "ENCRYPTION_UNAVAILABLE",
        "Provider connection storage is not configured. Please contact support.",
        503,
      );
    }
  }
  return {
    async seal(
      secret: string,
      binding: CredentialBinding,
    ): Promise<SealedCredential> {
      const nonce = crypto.getRandomValues(new Uint8Array(12));
      const ciphertext = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv: nonce, additionalData: additionalData(binding) },
        await key(activeVersion),
        encoder.encode(secret),
      );
      return {
        ciphertext: encode(new Uint8Array(ciphertext)),
        nonce: encode(nonce),
        key_version: activeVersion,
      };
    },
    async open(
      sealed: SealedCredential,
      binding: CredentialBinding,
    ): Promise<string> {
      const cryptoKey = await key(sealed.key_version);
      try {
        const nonce = decode(sealed.nonce);
        if (nonce.length !== 12) throw new Error("Invalid nonce");
        const bytes = await crypto.subtle.decrypt(
          {
            name: "AES-GCM",
            iv: nonce,
            additionalData: additionalData(binding),
          },
          cryptoKey,
          decode(sealed.ciphertext),
        );
        return new TextDecoder().decode(bytes);
      } catch {
        throw new PublicError(
          "CREDENTIAL_UNAVAILABLE",
          "Reconnect HeyGen to restore this connection.",
          503,
        );
      }
    },
  };
}
