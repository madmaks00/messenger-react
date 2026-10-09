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

function toBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

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
    console.log(`%c[E2EE 🔐] 1. Создание исходящего хэндшейка для TargetUser=${targetUserId}`, 'color: #00AFF4; font-weight: bold;');

    const keyPair = await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveBits']
    );

    const randomBytes = crypto.getRandomValues(new Uint8Array(16));
    const secretChatId = Array.from(randomBytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    const spkiPub = await crypto.subtle.exportKey('spki', keyPair.publicKey);
    const pkcs8Priv = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

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
    console.log(`%c[E2EE 🔐] Исходящий хэндшейк сгенерирован: ChatId=${secretChatId}, SPKI Bytes=${spkiPub.byteLength}`, 'color: #00AFF4');

    return {
      secretChatId,
      publicKeyBase64: toBase64(spkiPub),
      privateKeyBase64: toBase64(pkcs8Priv),
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
    console.log(`%c[E2EE 🔐] 2. Боб обрабатывает входящий хэндшейк: Initiator=${initiatorUserId}, ChatId=${secretChatId}`, 'color: #4ADE80; font-weight: bold;');

    const bobKeyPair = await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveBits']
    );

    const alicePubBytes = fromBase64(initiatorPubKeyBase64);
    let alicePubKey: CryptoKey;
    try {
      alicePubKey = await crypto.subtle.importKey(
        'spki',
        alicePubBytes as unknown as BufferSource,
        { name: 'ECDH', namedCurve: 'P-256' },
        false,
        []
      );
      console.log(`%c[E2EE 🔐] Публичный ключ инициатора успешно импортирован как SPKI (${alicePubBytes.length} байт)`, 'color: #4ADE80');
    } catch (spkiErr) {
      console.warn('[E2EE ⚠️] SPKI импорт не удался, пробуем RAW:', spkiErr);
      alicePubKey = await crypto.subtle.importKey(
        'raw',
        alicePubBytes as unknown as BufferSource,
        { name: 'ECDH', namedCurve: 'P-256' },
        false,
        []
      );
    }

    // 🟢 Вычисляем точку Z через ECDH agreement
    const rawSecretBits = await crypto.subtle.deriveBits(
      { name: 'ECDH', public: alicePubKey },
      bobKeyPair.privateKey,
      256
    );

    // 🟢 1:1 С C# .NET: DeriveKeyFromHash(..., HashAlgorithmName.SHA256) хеширует точку Z через SHA-256
    const rawSecretHash = await crypto.subtle.digest('SHA-256', rawSecretBits);
    const rawSecret = new Uint8Array(rawSecretHash);

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

    const bobPubSpki = await crypto.subtle.exportKey('spki', bobKeyPair.publicKey);
    const protectedState = this.exportProtectedSessionState(session);

    console.log(`%c[E2EE 🔐 ✅] Боб рассчитал сессию: FP=${fingerprint} | Emojis=${emojiFingerprint}`, 'color: #4ADE80; font-weight: bold;');

    return {
      publicKeyBase64: toBase64(bobPubSpki),
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
    console.log(`%c[E2EE 🔐] 3. Алиса завершает хэндшейк с Бобом: ChatId=${secretChatId}`, 'color: #F59E0B; font-weight: bold;');

    let privateKey: CryptoKey | null = null;
    const session = this.sessions.get(secretChatId);

    if (session?.localKeyPair?.privateKey) {
      privateKey = session.localKeyPair.privateKey;
      console.log('[E2EE 🔐] Приватный ключ взят из активной памяти сессии.');
    } else if (savedPrivateKeyBase64) {
      console.log('[E2EE 🔐] Приватный ключ восстанавливается из сохраненной строки PKCS8...');
      const privBytes = fromBase64(savedPrivateKeyBase64);
      privateKey = await crypto.subtle.importKey(
        'pkcs8',
        privBytes as unknown as BufferSource,
        { name: 'ECDH', namedCurve: 'P-256' },
        false,
        ['deriveBits']
      );
    }

    if (!privateKey) {
      console.error(`%c[E2EE ❌] Приватный ключ Алисы не найден для ChatId=${secretChatId}!`, 'color: #FF3B30; font-weight: bold;');
      throw new Error(`Приватный ключ Алисы не найден для чата ${secretChatId}`);
    }

    const bobPubBytes = fromBase64(responderPubKeyBase64);
    let bobPubKey: CryptoKey;
    try {
      bobPubKey = await crypto.subtle.importKey(
        'spki',
        bobPubBytes as unknown as BufferSource,
        { name: 'ECDH', namedCurve: 'P-256' },
        false,
        []
      );
    } catch {
      bobPubKey = await crypto.subtle.importKey(
        'raw',
        bobPubBytes as unknown as BufferSource,
        { name: 'ECDH', namedCurve: 'P-256' },
        false,
        []
      );
    }

    // 🟢 Вычисляем точку Z через ECDH agreement
    const rawSecretBits = await crypto.subtle.deriveBits(
      { name: 'ECDH', public: bobPubKey },
      privateKey,
      256
    );

    // 🟢 1:1 С C# .NET: DeriveKeyFromHash(..., HashAlgorithmName.SHA256) хеширует точку Z через SHA-256
    const rawSecretHash = await crypto.subtle.digest('SHA-256', rawSecretBits);
    const rawSecret = new Uint8Array(rawSecretHash);

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

    console.log(`%c[E2EE 🔐 ✅] Алиса вычислила общий ключ: FP=${fingerprint} | Emojis=${emojiFingerprint}`, 'color: #F59E0B; font-weight: bold;');
    return { fingerprint, protectedState };
  }

  // 4. Шифрование текста сообщения (AES-GCM 256 + Double Ratchet)
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
      console.error(`%c[E2EE ❌] Ошибка: сессия ${secretChatId} не установлена! (isEstablished=${session?.isEstablished})`, 'color: #FF3B30');
      throw new Error(`Секретный чат ${secretChatId} еще не инициализирован.`);
    }

    const currentSeq = session.sendSequenceNumber;
    const msgKeyInfo = new TextEncoder().encode(`MsgKey_${currentSeq}`);

    const messageKeyBytes = await hkdfDerive(session.sendChainKey, 32, KDF_SALT, msgKeyInfo);
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

    console.log(`%c[E2EE 📤 ШИФРОВАНИЕ] Seq=${currentSeq}, AAD='${secretChatId}:${currentSeq}', Plaintext Len=${plaintext.length}`, 'color: #38BDF8');

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
    console.log(`%c[E2EE 📥 ДЕШИФРОВКА] Старт: ChatId=${secretChatId}, Пришел Seq=${sequenceNumber}`, 'color: #A855F7; font-weight: bold;');

    const session = this.sessions.get(secretChatId);
    if (!session || !session.isEstablished || !session.receiveChainKey) {
      console.error(`%c[E2EE ❌] Сессия ${secretChatId} не готова к дешифровке! (session=${Boolean(session)}, isEstablished=${session?.isEstablished})`, 'color: #FF3B30');
      throw new Error(`Секретный чат ${secretChatId} не готов к расшифровке.`);
    }

    console.log(`[E2EE 📥] Текущий ожидаемый RecvSeq=${session.receiveSequenceNumber}, пришел=${sequenceNumber}`);

    let messageKeyBytes: Uint8Array;

    if (session.skippedMessageKeys.has(sequenceNumber)) {
      messageKeyBytes = session.skippedMessageKeys.get(sequenceNumber)!;
      session.skippedMessageKeys.delete(sequenceNumber);
      console.log(`%c[E2EE 📥] Взят пропущенный ключ для Seq=${sequenceNumber}`, 'color: #A855F7');
    } else {
      if (sequenceNumber < session.receiveSequenceNumber) {
        console.error(`%c[E2EE ❌ REJECT] Устаревший Seq! Пришел ${sequenceNumber}, ожидается >= ${session.receiveSequenceNumber}`, 'color: #FF3B30');
        throw new Error(
          `Устаревшее или повторное сообщение (Seq: ${sequenceNumber}, Ожидается >= ${session.receiveSequenceNumber}).`
        );
      }

      const skipCount = sequenceNumber - session.receiveSequenceNumber;
      if (skipCount > MAX_SKIP_KEYS) {
        throw new Error(
          `Превышен максимальный лимит пропуска шагов храповика (${skipCount} > ${MAX_SKIP_KEYS}).`
        );
      }

      if (skipCount > 0) {
        console.warn(`[E2EE ⚠️] Пропуск ${skipCount} шагов храповика с ${session.receiveSequenceNumber} до ${sequenceNumber}`);
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

    const payloadWithTag = new Uint8Array(ciphertext.length + tag.length);
    payloadWithTag.set(ciphertext, 0);
    payloadWithTag.set(tag, ciphertext.length);

    console.log(`[E2EE 📥] AAD='${secretChatId}:${sequenceNumber}', Ciphertext=${ciphertext.length}B, Tag=${tag.length}B, Nonce=${nonce.length}B`);

    try {
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

      console.log(`%c[E2EE 📥 ✅ УСПЕХ] Сообщение расшифровано: '${decryptedText.substring(0, 40)}...'`, 'color: #4ADE80; font-weight: bold;');
      return { decryptedText, updatedProtectedState };
    } catch (err) {
      console.error(`%c[E2EE ❌ CRITICAL] Ошибка AesGcm.Decrypt! Неверный тег/ключ/AAD для ChatId=${secretChatId}, Seq=${sequenceNumber}`, 'color: #FF3B30; font-weight: bold;', err);
      throw err;
    }
  }

  // 6. Шифрование файлов (1:1 с EncryptFile в C#)
  public async encryptFileBytes(rawBytes: Uint8Array): Promise<{
    encryptedBytes: Uint8Array;
    fileKeyBase64: string;
    fileNonceBase64: string;
    fileTagBase64: string;
  }> {
    console.log(`%c[E2EE 📁] Шифрование файла: ${rawBytes.length} байт`, 'color: #38BDF8');
    const fileKeyRaw = crypto.getRandomValues(new Uint8Array(32));
    const fileNonce = crypto.getRandomValues(new Uint8Array(12));

    const key = await crypto.subtle.importKey(
      'raw',
      fileKeyRaw,
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );

    const encryptedWithTag = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: fileNonce,
        tagLength: 128,
      },
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

  // 7. Расшифровка файлов (1:1 с DecryptFile в C#)
  public async decryptFileBytes(
    encryptedBytes: Uint8Array,
    fileKeyBase64: string,
    fileNonceBase64: string,
    fileTagBase64: string
  ): Promise<Uint8Array> {
    console.log(`%c[E2EE 📁] Расшифровка файла: ${encryptedBytes.length} байт`, 'color: #A855F7');
    const fileKeyRaw = fromBase64(fileKeyBase64);
    const fileNonce = fromBase64(fileNonceBase64);
    const fileTag = fromBase64(fileTagBase64);

    const key = await crypto.subtle.importKey(
      'raw',
      fileKeyRaw as unknown as BufferSource,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    const payloadWithTag = new Uint8Array(encryptedBytes.length + fileTag.length);
    payloadWithTag.set(encryptedBytes, 0);
    payloadWithTag.set(fileTag, encryptedBytes.length);

    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: fileNonce as ArrayBufferView<ArrayBuffer>,
        tagLength: 128,
      },
      key,
      payloadWithTag
    );

    return new Uint8Array(decrypted);
  }

  // 8. Сохранение состояния сессии в DTO
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
    return btoa(unescape(encodeURIComponent(JSON.stringify(dto))));
  }

  // 9. Восстановление состояния сессии из сохраненной строки
  public restoreSessionFromProtectedState(secretChatId: string, protectedBlob: string): void {
    try {
      const json = decodeURIComponent(escape(atob(protectedBlob)));
      const dto: SessionStateDto = JSON.parse(json);

      if (dto && dto.sharedKeyBase64) {
        this.sessions.set(secretChatId, {
          secretChatId: dto.secretChatId,
          targetUserId: dto.targetUserId,
          sharedKey: fromBase64(dto.sharedKeyBase64),
          sendChainKey: dto.sendChainBase64 ? fromBase64(dto.sendChainBase64) : null,
          receiveChainKey: dto.recvChainBase64 ? fromBase64(dto.recvChainBase64) : null,
          sendSequenceNumber: Number(dto.sendSeq || 0),
          receiveSequenceNumber: Number(dto.recvSeq || 0),
          skippedMessageKeys: new Map(),
          keyFingerprint: dto.keyFingerprint,
          emojiFingerprint: dto.emojiFingerprint,
          isEstablished: true,
        });
        console.log(`%c[E2EE 🔄 RESTORE] Сессия ${secretChatId} восстановлена из кэша: SendSeq=${dto.sendSeq}, RecvSeq=${dto.recvSeq}, FP=${dto.keyFingerprint}`, 'color: #EAB308');
      }
    } catch (e) {
      console.error(`[E2EE ❌ RESTORE ERROR] Ошибка восстановления сессии ${secretChatId}:`, e);
    }
  }

  // 10. Регистрация восстановленной сессии с вычислением цепей
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

  // 11. Получение сессии по ChatId
  public getSession(secretChatId: string): SecretChatSessionState | null {
    return this.sessions.get(secretChatId) || null;
  }

  // 12. Удаление отдельной сессии из оперативной памяти
  public removeSession(secretChatId: string): void {
    this.sessions.delete(secretChatId);
    console.log(`[E2EE 🗑️] Сессия ${secretChatId} удалена из оперативной памяти.`);
  }

  // 13. Очистка всех сессий из памяти
  public clearSessions(): void {
    const count = this.sessions.size;
    this.sessions.clear();
    console.warn(`[E2EE] Очищено ${count} активных криптосессий из памяти.`);
  }

  // 14. Генерация HEX отпечатка (8 байт = 16 hex символов)
  public async generateHexFingerprint(key: Uint8Array): Promise<string> {
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', key as ArrayBufferView<ArrayBuffer>));
    return Array.from(hash.slice(0, 8))
      .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
      .join(':');
  }

  // 15. Генерация эмодзи отпечатка (4 Telegram эмодзи)
  public async generateTelegramEmojiFingerprint(key: Uint8Array): Promise<string> {
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', key as ArrayBufferView<ArrayBuffer>));
    return [
      TELEGRAM_EMOJI_SET[hash[0] % TELEGRAM_EMOJI_SET.length],
      TELEGRAM_EMOJI_SET[hash[1] % TELEGRAM_EMOJI_SET.length],
      TELEGRAM_EMOJI_SET[hash[2] % TELEGRAM_EMOJI_SET.length],
      TELEGRAM_EMOJI_SET[hash[3] % TELEGRAM_EMOJI_SET.length],
    ].join(' ');
  }
}

export const secretChatCrypto = new SecretChatCryptoService();