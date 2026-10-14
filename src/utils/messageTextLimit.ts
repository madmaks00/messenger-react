export const MAX_MESSAGE_CHARACTERS = 4096;

export function isMessageTextTooLong(text: string | null | undefined): boolean {
  let count = 0;
  let previousCr = false;
  for (const character of text || '') {
    const crlf = previousCr && character === '\n';
    previousCr = character === '\r';
    if (!crlf && ++count > MAX_MESSAGE_CHARACTERS) return true;
  }
  return false;
}
