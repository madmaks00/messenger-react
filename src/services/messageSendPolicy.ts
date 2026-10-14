import type { IMessage } from '../types/models';

const errors: Record<number, string> = {
  [-1]: 'Нет доступа к этому чату или получателю.',
  [-2]: 'Нет разрешения отправлять медиа в этот чат.',
  [-3]: 'Нет разрешения отправлять сообщения в этот чат.',
  [-4]: 'Сообщение пустое.',
  [-5]: 'Размер вложения превышает 500 МБ.',
  [-6]: 'Сообщение превышает 4096 символов.',
  [-7]: 'Вложение недоступно. Попробуйте отправить его повторно.',
};

export function canAutoSend(message: IMessage, now = Date.now()): boolean {
  return !message.sendError && (message.nextSendAttemptAt || 0) <= now;
}

export function sendFailure(message: IMessage, code = 0, now = Date.now()): Partial<IMessage> {
  const sendAttempts = (message.sendAttempts || 0) + 1;
  const stopped = code < 0 || sendAttempts >= 5;
  return {
    sendAttempts,
    sendErrorCode: stopped ? code : null,
    sendError: stopped ? (errors[code] || 'Не удалось отправить сообщение. Нажмите, чтобы повторить.') : null,
    nextSendAttemptAt: stopped ? 0 : now + Math.min(300000, 5000 * 2 ** (sendAttempts - 1)),
  };
}

export const resetSendFailure: Partial<IMessage> = {
  sendAttempts: 0, sendErrorCode: null, sendError: null, nextSendAttemptAt: 0,
};
