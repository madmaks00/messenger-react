import type { IUser } from '../types/models';
import { createRegistrationPayload } from './auth-contract';

export function createProfileUpdatePayload(user: IUser) {
  const value = createRegistrationPayload(user, '');
  return {
    firstName: value.firstName, lastName: value.lastName, nickName: value.nickName,
    username: value.username, description: value.description, phone: value.phone,
    email: value.email, gender: value.gender, birthday: value.birthday, avatar: value.avatar,
  };
}
