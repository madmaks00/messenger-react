export enum AttachmentType {
  Photo = 0,
  Video = 1,
  Document = 2,
  Audio = 3,
  Voice = 4,
}

export enum LastMessageType {
  None = 0,
  Text = 1,
  Photo = 2,
  Video = 3,
  Gif = 4,
  Audio = 5,
  Voice = 6,
  Document = 7,
  Call = 8,
  Deleted = 9,
}

export enum Gender {
  Male = 0,
  Female = 1,
}

export enum MainTab {
  Chats = 'Chats',
  Notes = 'Notes',
  Tasks = 'Tasks',
  Games = 'Games',
  AccountSwitch = 'AccountSwitch',
}

export enum NoteShapeType {
  None = 0,
  Text = 1,
  Square = 2,
  Rectangle = 3,
  Triangle = 4,
  Ellipse = 5,
  Line = 6,
  Polyline = 7,
}

export enum PrivacyVisibility {
  Everybody = 0,
  MyContacts = 1,
  Nobody = 2,
}

export enum TaskCategory {
  None = 0,
  Work = 1,
  Personal = 2,
  Calls = 3,
  Shopping = 4,
  Health = 5,
  Learning = 6,
  Family = 7,
  Finance = 8,
  Quick = 9,
  DeepWork = 10,
  Someday = 11,
}

export enum TaskPriority {
  None = 0,
  Low = 1,
  Medium = 2,
  High = 3,
}

export enum TaskStatus {
  Todo = 0,
  InProgress = 1,
  Review = 2,
  Waiting = 3,
  Blocked = 4,
}

export enum ThemeMode {
  Light = 'Light',
  Dark = 'Dark',
}