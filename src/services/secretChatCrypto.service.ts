import { SessionStateDto } from '../types/dtos';

const KDF_SALT = new TextEncoder().encode('Messenger_TelegramGrade_E2EE_v3_Salt');
const INFO_MASTER_SECRET = new TextEncoder().encode('MasterSecret');
const INFO_BOB_SEND_ALICE_RECV = new TextEncoder().encode('BobSend_AliceRecv');
const INFO_ALICE_SEND_BOB_RECV = new TextEncoder().encode('AliceSend_BobRecv');
const INFO_RATCHET_STEP = new TextEncoder().encode('RatchetStep');

const TELEGRAM_EMOJI_SET = [
  '👻', '💀', '👽', '🤖', '🎃', '😺', '🐶', '🦊', '🦁', '🐯',
  '🦄', '🐝', '🦋', '🌸', '🍀', '🍎', '🍕', '🚀', '🎸', '💎',
];

const MAX_SKIP_KEYS = 2000;

export interface SecretChatSessionState {
  secretChatId: string;
  targetUserId: number;
  sharedKey: Uint8Array | null;
  sendChainKey: Uint8Array | null;
  receiveChainKey: Uint8Array | null;
  sendSequenceNumber: number;
  receiveSequenceNumber: number;
  skippedMessageKeys: Map<number, Uint8Array>;
  keyFingerprint: string;
  emojiFingerprint: string;
  localKeyPair?: CryptoKeyPair;
  isEstablished: boolean;
}

// Вспомогательные функции конвертации буферов
function toBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// HKDF деривация ключей на базе HMAC-SHA-256
async function hkdfDerive(
  ikm: Uint8Array,
  length: number,
  salt: Uint8Array,
  info: Uint8Array
): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    ikm as ArrayBufferView<ArrayBuffer>,
    { name: 'HKDF' },
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: salt as ArrayBufferView<ArrayBuffer>,
      info: info as ArrayBufferView<ArrayBuffer>,
    },
    keyMaterial,
    length * 8
  );

  return new Uint8Array(derivedBits);
}

export class SecretChatCryptoService {
  private readonly sessions = new Map<string, SecretChatSessionState>();

  // 1. Создание исходящего хэндшейка (Алиса начинает чат)
  public async createOutgoingHandshake(targetUserId: number): Promise<{
    secretChatId: string;
    publicKeyBase64: string;
    privateKeyBase64: string;
  }> {
    const keyPair = await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveBits']
    );

    const secretChatId = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    const rawPub = await crypto.subtle.exportKey('raw', keyPair.publicKey);
    const rawPriv = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

    const session: SecretChatSessionState = {
      secretChatId,
      targetUserId,
      sharedKey: null,
      sendChainKey: null,
      receiveChainKey: null,
      sendSequenceNumber: 0,
      receiveSequenceNumber: 0,
      skippedMessageKeys: new Map(),
      keyFingerprint: '',
      emojiFingerprint: '',
      localKeyPair: keyPair,
      isEstablished: false,
    };

    this.sessions.set(secretChatId, session);
    console.info(`🔐 [E2EE] Создан исходящий хэндшейк для UserId=${targetUserId}, ChatId=${secretChatId}`);

    return {
      secretChatId,
      publicKeyBase64: toBase64(rawPub),
      privateKeyBase64: toBase64(rawPriv),
    };
  }

  // 2. Обработка входящего хэндшейка (Боб принимает запрос от Алисы)
  public async processIncomingHandshake(
    secretChatId: string,
    initiatorUserId: number,
    initiatorPubKeyBase64: string
  ): Promise<{
    publicKeyBase64: string;
    fingerprint: string;
    protectedState: string;
  }> {
    const bobKeyPair = await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveBits']
    );

    const alicePubBytes = fromBase64(initiatorPubKeyBase64);
    const alicePubKey = await crypto.subtle.importKey(
      'raw',
      alicePubBytes,
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      []
    );

    const rawSecretBits = await crypto.subtle.deriveBits(
      { name: 'ECDH', public: alicePubKey },
      bobKeyPair.privateKey,
      256
    );
    const rawSecret = new Uint8Array(rawSecretBits);

    const sharedKey = await hkdfDerive(rawSecret, 32, KDF_SALT, INFO_MASTER_SECRET);
    const bobSendChain = await hkdfDerive(sharedKey, 32, KDF_SALT, INFO_BOB_SEND_ALICE_RECV);
    const bobRecvChain = await hkdfDerive(sharedKey, 32, KDF_SALT, INFO_ALICE_SEND_BOB_RECV);

    const fingerprint = await this.generateHexFingerprint(sharedKey);
    const emojiFingerprint = await this.generateTelegramEmojiFingerprint(sharedKey);

    const session: SecretChatSessionState = {
      secretChatId,
      targetUserId: initiatorUserId,
      sharedKey,
      sendChainKey: bobSendChain,
      receiveChainKey: bobRecvChain,
      sendSequenceNumber: 0,
      receiveSequenceNumber: 0,
      skippedMessageKeys: new Map(),
      keyFingerprint: fingerprint,
      emojiFingerprint,
      isEstablished: true,
    };

    this.sessions.set(secretChatId, session);

    const bobPubRaw = await crypto.subtle.exportKey('raw', bobKeyPair.publicKey);
    const protectedState = this.exportProtectedSessionState(session);

    console.info(`🔐 [E2EE] ✅ Боб рассчитал храповик! Отпечаток: ${fingerprint} (${emojiFingerprint})`);

    return {
      publicKeyBase64: toBase64(bobPubRaw),
      fingerprint,
      protectedState,
    };
  }

  // 3. Завершение хэндшейка Алисой после ответа Боба
  public async completeOutgoingHandshake(
    secretChatId: string,
    responderPubKeyBase64: string,
    savedPrivateKeyBase64?: string | null
  ): Promise<{ fingerprint: string; protectedState: string }> {
    let privateKey: CryptoKey | null = null;
    const session = this.sessions.get(secretChatId);

    if (session?.localKeyPair?.privateKey) {
      privateKey = session.localKeyPair.privateKey;
    } else if (savedPrivateKeyBase64) {
      const privBytes = fromBase64(savedPrivateKeyBase64);
      privateKey = await crypto.subtle.importKey(
        'pkcs8',
        privBytes,
        { name: 'ECDH', namedCurve: 'P-256' },
        false,
        ['deriveBits']
      );
    }

    if (!privateKey) {
      throw new Error('Приватный ключ Алисы не найден.');
    }

    const bobPubBytes = fromBase64(responderPubKeyBase64);
    const bobPubKey = await crypto.subtle.importKey(
      'raw',
      bobPubBytes,
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      []
    );

    const rawSecretBits = await crypto.subtle.deriveBits(
      { name: 'ECDH', public: bobPubKey },
      privateKey,
      256
    );
    const rawSecret = new Uint8Array(rawSecretBits);

    const sharedKey = await hkdfDerive(rawSecret, 32, KDF_SALT, INFO_MASTER_SECRET);
    const aliceSendChain = await hkdfDerive(sharedKey, 32, KDF_SALT, INFO_ALICE_SEND_BOB_RECV);
    const aliceRecvChain = await hkdfDerive(sharedKey, 32, KDF_SALT, INFO_BOB_SEND_ALICE_RECV);

    const fingerprint = await this.generateHexFingerprint(sharedKey);
    const emojiFingerprint = await this.generateTelegramEmojiFingerprint(sharedKey);

    const newSession: SecretChatSessionState = {
      secretChatId,
      targetUserId: session?.targetUserId || 0,
      sharedKey,
      sendChainKey: aliceSendChain,
      receiveChainKey: aliceRecvChain,
      sendSequenceNumber: 0,
      receiveSequenceNumber: 0,
      skippedMessageKeys: new Map(),
      keyFingerprint: fingerprint,
      emojiFingerprint,
      isEstablished: true,
    };

    this.sessions.set(secretChatId, newSession);
    const protectedState = this.exportProtectedSessionState(newSession);

    console.info(`🔐 [E2EE] ✅ Алиса вычислила ключи! Отпечаток: ${fingerprint}`);
    return { fingerprint, protectedState };
  }

  // 4. Шифрование текста сообщения (AES-GCM 256 + храповик шагов)
  public async encryptText(
    secretChatId: string,
    plaintext: string
  ): Promise<{
    ciphertextBase64: string;
    nonceBase64: string;
    tagBase64: string;
    sequenceNumber: number;
    updatedProtectedState: string;
  }> {
    const session = this.sessions.get(secretChatId);
    if (!session || !session.isEstablished || !session.sendChainKey) {
      throw new Error('Секретный чат еще не инициализирован.');
    }

    const currentSeq = session.sendSequenceNumber;
    const msgKeyInfo = new TextEncoder().encode(`MsgKey_${currentSeq}`);

    // Деривация индивидуального ключа сообщения
    const messageKeyBytes = await hkdfDerive(session.sendChainKey, 32, KDF_SALT, msgKeyInfo);
    // Шаг храповика отправки вперед
    const nextSendChain = await hkdfDerive(session.sendChainKey, 32, KDF_SALT, INFO_RATCHET_STEP);

    session.sendChainKey = nextSendChain;
    session.sendSequenceNumber++;

    const messageKey = await crypto.subtle.importKey(
      'raw',
      messageKeyBytes as ArrayBufferView<ArrayBuffer>,
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );

    const nonce = crypto.getRandomValues(new Uint8Array(12));
    const aad = new TextEncoder().encode(`${secretChatId}:${currentSeq}`);
    const plaintextBytes = new TextEncoder().encode(plaintext);

    // В Web Crypto API результат encrypt содержит шифротекст + 16 байт тега в конце
    const encryptedWithTag = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: nonce,
        additionalData: aad,
        tagLength: 128,
      },
      messageKey,
      plaintextBytes
    );

    const totalLen = encryptedWithTag.byteLength;
    const ciphertextBytes = new Uint8Array(encryptedWithTag, 0, totalLen - 16);
    const tagBytes = new Uint8Array(encryptedWithTag, totalLen - 16, 16);

    const updatedProtectedState = this.exportProtectedSessionState(session);

    return {
      ciphertextBase64: toBase64(ciphertextBytes),
      nonceBase64: toBase64(nonce),
      tagBase64: toBase64(tagBytes),
      sequenceNumber: currentSeq,
      updatedProtectedState,
    };
  }

  // 5. Расшифровка входящего текста сообщения с обработкой пропущенных шагов
  public async decryptText(
    secretChatId: string,
    ciphertextBase64: string,
    nonceBase64: string,
    tagBase64: string,
    sequenceNumber: number
  ): Promise<{ decryptedText: string; updatedProtectedState: string }> {
    const session = this.sessions.get(secretChatId);
    if (!session || !session.isEstablished || !session.receiveChainKey) {
      throw new Error('Секретный чат не готов к расшифровке.');
    }

    let messageKeyBytes: Uint8Array;

    if (session.skippedMessageKeys.has(sequenceNumber)) {
      messageKeyBytes = session.skippedMessageKeys.get(sequenceNumber)!;
      session.skippedMessageKeys.delete(sequenceNumber);
    } else {
      if (sequenceNumber < session.receiveSequenceNumber) {
        throw new Error(`Устаревшее или повторное сообщение (Seq: ${sequenceNumber}).`);
      }

      const skipCount = sequenceNumber - session.receiveSequenceNumber;
      if (skipCount > MAX_SKIP_KEYS) {
        throw new Error('Превышен максимальный лимит пропуска шагов храповика.');
      }

      while (session.receiveSequenceNumber < sequenceNumber) {
        const skipped = await hkdfDerive(
          session.receiveChainKey,
          32,
          KDF_SALT,
          new TextEncoder().encode(`MsgKey_${session.receiveSequenceNumber}`)
        );
        session.skippedMessageKeys.set(session.receiveSequenceNumber, skipped);

        const nextRecvChain = await hkdfDerive(session.receiveChainKey, 32, KDF_SALT, INFO_RATCHET_STEP);
        session.receiveChainKey = nextRecvChain;
        session.receiveSequenceNumber++;
      }

      messageKeyBytes = await hkdfDerive(
        session.receiveChainKey,
        32,
        KDF_SALT,
        new TextEncoder().encode(`MsgKey_${sequenceNumber}`)
      );

      const nextChain = await hkdfDerive(session.receiveChainKey, 32, KDF_SALT, INFO_RATCHET_STEP);
      session.receiveChainKey = nextChain;
      session.receiveSequenceNumber++;
    }

    const messageKey = await crypto.subtle.importKey(
      'raw',
      messageKeyBytes as ArrayBufferView<ArrayBuffer>,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    const ciphertext = fromBase64(ciphertextBase64);
    const nonce = fromBase64(nonceBase64);
    const tag = fromBase64(tagBase64);
    const aad = new TextEncoder().encode(`${secretChatId}:${sequenceNumber}`);

    // Соединяем шифротекст и 16 байт тега для стандарта Web Crypto
    const payloadWithTag = new Uint8Array(ciphertext.length + tag.length);
    payloadWithTag.set(ciphertext, 0);
    payloadWithTag.set(tag, ciphertext.length);

    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: nonce as ArrayBufferView<ArrayBuffer>,
        additionalData: aad,
        tagLength: 128,
      },
      messageKey,
      payloadWithTag
    );

    const decryptedText = new TextDecoder().decode(decryptedBuffer);
    const updatedProtectedState = this.exportProtectedSessionState(session);

    return { decryptedText, updatedProtectedState };
  }

  // 6. Шифрование и расшифровка файлов (AES-GCM)
  public async encryptFileBytes(rawBytes: Uint8Array): Promise<{
    encryptedBytes: Uint8Array;
    fileKeyBase64: string;
    fileNonceBase64: string;
    fileTagBase64: string;
  }> {
    const fileKeyRaw = crypto.getRandomValues(new Uint8Array(32));
    const fileNonce = crypto.getRandomValues(new Uint8Array(12));

    const key = await crypto.subtle.importKey('raw', fileKeyRaw, { name: 'AES-GCM' }, false, ['encrypt']);

    const encryptedWithTag = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: fileNonce, tagLength: 128 },
      key,
      rawBytes as ArrayBufferView<ArrayBuffer>
    );

    const totalLen = encryptedWithTag.byteLength;
    const encryptedBytes = new Uint8Array(encryptedWithTag, 0, totalLen - 16);
    const tagBytes = new Uint8Array(encryptedWithTag, totalLen - 16, 16);

    return {
      encryptedBytes,
      fileKeyBase64: toBase64(fileKeyRaw),
      fileNonceBase64: toBase64(fileNonce),
      fileTagBase64: toBase64(tagBytes),
    };
  }

  public async decryptFileBytes(
    encryptedBytes: Uint8Array,
    fileKeyBase64: string,
    fileNonceBase64: string,
    fileTagBase64: string
  ): Promise<Uint8Array> {
    const fileKeyRaw = fromBase64(fileKeyBase64);
    const fileNonce = fromBase64(fileNonceBase64);
    const fileTag = fromBase64(fileTagBase64);

    const key = await crypto.subtle.importKey('raw', fileKeyRaw, { name: 'AES-GCM' }, false, ['decrypt']);

    const payloadWithTag = new Uint8Array(encryptedBytes.length + fileTag.length);
    payloadWithTag.set(encryptedBytes, 0);
    payloadWithTag.set(fileTag, encryptedBytes.length);

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fileNonce as ArrayBufferView<ArrayBuffer>, tagLength: 128 },
      key,
      payloadWithTag
    );

    return new Uint8Array(decrypted);
  }

  // 7. Сохранение и восстановление состояния сессии
  public exportProtectedSessionState(session: SecretChatSessionState): string {
    const dto: SessionStateDto = {
      secretChatId: session.secretChatId,
      targetUserId: session.targetUserId,
      sharedKeyBase64: session.sharedKey ? toBase64(session.sharedKey) : '',
      sendChainBase64: session.sendChainKey ? toBase64(session.sendChainKey) : '',
      recvChainBase64: session.receiveChainKey ? toBase64(session.receiveChainKey) : '',
      sendSeq: session.sendSequenceNumber,
      recvSeq: session.receiveSequenceNumber,
      keyFingerprint: session.keyFingerprint,
      emojiFingerprint: session.emojiFingerprint,
    };
    return btoa(JSON.stringify(dto));
  }

  public restoreSessionFromProtectedState(secretChatId: string, protectedBlob: string): void {
    try {
      const json = atob(protectedBlob);
      const dto: SessionStateDto = JSON.parse(json);

      if (dto && dto.sharedKeyBase64) {
        this.sessions.set(secretChatId, {
          secretChatId: dto.secretChatId,
          targetUserId: dto.targetUserId,
          sharedKey: fromBase64(dto.sharedKeyBase64),
          sendChainKey: dto.sendChainBase64 ? fromBase64(dto.sendChainBase64) : null,
          receiveChainKey: dto.recvChainBase64 ? fromBase64(dto.recvChainBase64) : null,
          sendSequenceNumber: dto.sendSeq,
          receiveSequenceNumber: dto.recvSeq,
          skippedMessageKeys: new Map(),
          keyFingerprint: dto.keyFingerprint,
          emojiFingerprint: dto.emojiFingerprint,
          isEstablished: true,
        });
        console.info(`🔐 [E2EE RESTORE] Сессия ${secretChatId} успешно восстановлена.`);
      }
    } catch (e) {
      console.error(`❌ [E2EE RESTORE] Ошибка восстановления сессии ${secretChatId}:`, e);
    }
  }

  public async registerRestoredSession(
    secretChatId: string,
    targetUserId: number,
    sharedKey: Uint8Array,
    fingerprint: string
  ): Promise<void> {
    const sendChain = await hkdfDerive(sharedKey, 32, KDF_SALT, INFO_BOB_SEND_ALICE_RECV);
    const recvChain = await hkdfDerive(sharedKey, 32, KDF_SALT, INFO_ALICE_SEND_BOB_RECV);

    this.sessions.set(secretChatId, {
      secretChatId,
      targetUserId,
      sharedKey,
      sendChainKey: sendChain,
      receiveChainKey: recvChain,
      sendSequenceNumber: 0,
      receiveSequenceNumber: 0,
      skippedMessageKeys: new Map(),
      keyFingerprint: fingerprint,
      emojiFingerprint: await this.generateTelegramEmojiFingerprint(sharedKey),
      isEstablished: true,
    });
  }

  public getSession(secretChatId: string): SecretChatSessionState | null {
    return this.sessions.get(secretChatId) || null;
  }

  public clearSessions(): void {
    this.sessions.clear();
    console.warn('🔐 [E2EE] Очищены все активные криптосессии из памяти.');
  }

  // Генерация отпечатков (Hex и 4 Telegram Emoji)
  private async generateHexFingerprint(key: Uint8Array): Promise<string> {
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', key as ArrayBufferView<ArrayBuffer>));
    return Array.from(hash.slice(0, 8))
      .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
      .join(':');
  }

  private async generateTelegramEmojiFingerprint(key: Uint8Array): Promise<string> {
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', key as ArrayBufferView<ArrayBuffer>));
    return [
      TELEGRAM_EMOJI_SET[hash[0] % TELEGRAM_EMOJI_SET.Length],
      TELEGRAM_EMOJI_SET[hash[1] % TELEGRAM_EMOJI_SET.Length],
      TELEGRAM_EMOJI_SET[hash[2] % TELEGRAM_EMOJI_SET.Length],
      TELEGRAM_EMOJI_SET[hash[3] % TELEGRAM_EMOJI_SET.Length],
    ].join(' ');
  }
}

export const secretChatCrypto = new SecretChatCryptoService();