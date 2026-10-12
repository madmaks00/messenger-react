import {userSession} from './userSession';
export interface UserPresence { isOnline: boolean; lastSeen: string; }
export interface GroupPresence {onlineCount:number;memberCount:number;}
export function parseGroupPresence(raw:any):GroupPresence|undefined {
  if (!raw) return undefined;const onlineCount=Number(raw.onlineCount??raw.OnlineCount),memberCount=Number(raw.memberCount??raw.MemberCount);
  return Number.isInteger(onlineCount)&&Number.isInteger(memberCount)&&onlineCount>=0&&memberCount>=onlineCount ? {onlineCount,memberCount}:undefined;
}
export interface PresenceTicket {owner: number; epoch: number; version: number;}
const hiddenLastSeen = '0001-01-01T00:00:00Z';
export function parsePresence(raw: any): UserPresence | undefined {
  if (raw === undefined || raw === null) return undefined;
  const value = typeof raw === 'object' ? raw.isOnline ?? raw.IsOnline : raw;
  if (![true,false,0,1,'true','false','True','False','0','1'].includes(value)) return undefined;
  const online = value === true || value === 1 || String(value).toLowerCase() === 'true' || value === '1';
  const seen = typeof raw === 'object' ? raw.lastSeen ?? raw.LastSeen : undefined;
  return {isOnline: online, lastSeen: typeof seen === 'string' && seen ? seen : hiddenLastSeen};
}
class UserPresenceState {
  private owner = -1; private epoch = 0; private version = 0;
  private states = new Map<number, {value: UserPresence; version: number}>();
  private groups = new Map<number,{value:GroupPresence;version:number}>();
  getGroup(id:number) {this.scope();return this.groups.get(Number(id))?.value;}
  acceptGroup(id:number,value:GroupPresence,ticket?:PresenceTicket) {
    const owner=this.scope();id=Number(id);
    if(id<=0||(ticket&&(ticket.owner!==owner||ticket.epoch!==this.epoch||(this.groups.get(id)?.version||0)>ticket.version)))return undefined;
    this.groups.set(id,{value,version:ticket?.version??++this.version});return value;
  }
  private scope() {const owner = Number(userSession.userId || 0);if (owner !== this.owner) {this.owner=owner;this.reset();}return owner;}
  reset() {this.epoch++;this.version=0;this.states.clear();this.groups.clear();}
  invalidateRequests() {this.epoch++;}
  capture(): PresenceTicket {return {owner:this.scope(),epoch:this.epoch,version:++this.version};}
  get(userId: number): UserPresence | undefined {this.scope();return this.states.get(Number(userId))?.value;}
  accept(userId: number, value: UserPresence, ticket?: PresenceTicket): UserPresence | undefined {
    const owner=this.scope();userId=Number(userId);
    if (userId<=0 || (ticket && (ticket.owner!==owner || ticket.epoch!==this.epoch || (this.states.get(userId)?.version||0)>ticket.version))) return undefined;
    this.states.set(userId,{value,version:ticket?.version??++this.version});return value;
  }
}
export const userPresenceState = new UserPresenceState();
