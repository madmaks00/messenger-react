import type { IUser } from '../types/models';

// Browser form values must match the server's nullable date, numeric enum and byte[] contracts.
export function createRegistrationPayload(user: Partial<IUser>, verificationCode: string) {
  const gender = String(user.gender ?? '').trim();
  const avatar = user.avatar?.trim() || null;
  const encodedAvatar = avatar?.match(/^data:[^,]*;base64,([\s\S]*)$/i)?.[1];
  return {
    username: user.username,
    password: user.password,
    email: user.email,
    verificationCode,
    nickName: user.nickName,
    firstName: user.firstName,
    lastName: user.lastName,
    description: user.description,
    phone: user.phone,
    avatar: encodedAvatar ?? avatar,
    gender: gender === '0' || gender === 'Male' ? 0 : gender === '1' || gender === 'Female' ? 1 : null,
    birthday: user.birthday?.trim() || null,
  };
}

export function getAuthErrorMessage(error: unknown, fallback: string): string {
  const candidate = error as { response?: { data?: unknown }; message?: unknown } | null;
  const data = candidate?.response?.data ?? error;
  if (typeof data === 'string' && data.trim()) return data;
  if (data && typeof data === 'object') {
    const problem = data as { detail?: unknown; message?: unknown; title?: unknown; errors?: Record<string, unknown> };
    for (const value of [problem.detail, problem.message]) {
      if (typeof value === 'string' && value.trim()) return value;
    }
    if (problem.errors && typeof problem.errors === 'object') {
      for (const [field, values] of Object.entries(problem.errors)) {
        if (field === 'request') continue; // Secondary error when JSON could not be decoded.
        if (field === '$.birthday') return 'Проверь дату рождения.';
        if (field === '$.avatar') return 'Не удалось обработать фото профиля. Выбери другое изображение.';
        if (field === '$.gender') return 'Выбери пол из списка.';
        const messages = Array.isArray(values) ? values : [values];
        const message = messages.find((value) => typeof value === 'string' && value.trim());
        if (typeof message === 'string') return message;
      }
    }
    if (typeof problem.title === 'string' && problem.title.trim()) return problem.title;
  }
  if (typeof candidate?.message === 'string' && candidate.message.trim()) return candidate.message;
  return fallback;
}
