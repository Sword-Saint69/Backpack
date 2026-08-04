const crypto = require('crypto');

class CryptoUtils {
  // AES-256-GCM client-side payload encryption
  encryptPayload(plainBuffer, passphrase) {
    if (!passphrase) return plainBuffer;

    const salt = crypto.randomBytes(16);
    const key = crypto.pbkdf2Sync(passphrase, salt, 100000, 32, 'sha256');
    const iv = crypto.randomBytes(12);

    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(plainBuffer), cipher.final()]);
    const authTag = cipher.getAuthTag();

    const envelope = {
      encrypted: true,
      algorithm: 'aes-256-gcm',
      salt: salt.toString('hex'),
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      data: encrypted.toString('base64')
    };

    return Buffer.from(JSON.stringify(envelope, null, 2), 'utf-8');
  }

  decryptPayload(encryptedBuffer, passphrase) {
    const envelope = JSON.parse(encryptedBuffer.toString('utf-8'));
    if (!envelope.encrypted) return encryptedBuffer;

    const salt = Buffer.from(envelope.salt, 'hex');
    const iv = Buffer.from(envelope.iv, 'hex');
    const authTag = Buffer.from(envelope.authTag, 'hex');
    const data = Buffer.from(envelope.data, 'base64');

    const key = crypto.pbkdf2Sync(passphrase, salt, 100000, 32, 'sha256');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(data), decipher.final()]);
  }
}

module.exports = new CryptoUtils();
