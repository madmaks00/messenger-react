import { apiClient } from './apiClient';
import {
  GroupDetailsDto,
  GroupCreationDto,
  GroupCreateResultDto,
  GroupUpdateDto,
  MemberPermissionsDto,
  GroupJoinResultDto,
  GroupPreviewDto,
} from '../types/dtos';
import { IGroupMember } from '../types/models';

export interface IGroupService {
  getGroupDetailsAsync(groupId: number): Promise<GroupDetailsDto | null>;
  getGroupMembersAsync(groupId: number): Promise<IGroupMember[] | null>;
  getGroupAdministratorsAsync(groupId: number): Promise<IGroupMember[] | null>;
  getGroupBlacklistAsync(groupId: number): Promise<IGroupMember[] | null>;
  generateInviteLinkAsync(groupId: number): Promise<{ link: string; expiration: string } | null>;
  revokeInviteLinkAsync(groupId: number): Promise<boolean>;
  updateGroupSettingsAsync(groupId: number, dto: GroupUpdateDto): Promise<boolean>;
  getMemberPermissionsAsync(groupId: number, memberId: number): Promise<MemberPermissionsDto | null>;
  saveMemberPermissionsAsync(groupId: number, memberId: number, permissions: MemberPermissionsDto): Promise<boolean>;
  kickMemberAsync(groupId: number, memberId: number): Promise<boolean>;
  banMemberAsync(groupId: number, memberId: number): Promise<boolean>;
  unbanMemberAsync(groupId: number, memberId: number): Promise<boolean>;
  joinGroupByLinkAsync(link: string): Promise<GroupJoinResultDto | null>;
  getLinkPreviewAsync(link: string): Promise<GroupPreviewDto | null>;
  createGroupAsync(dto: GroupCreationDto): Promise<GroupCreateResultDto | null>;
  leaveGroupAsync(groupId: number): Promise<boolean>;
}

export class GroupService implements IGroupService {
  public async getGroupDetailsAsync(groupId: number): Promise<GroupDetailsDto | null> {
    try {
      const res = await apiClient.get<GroupDetailsDto>(`api/Groups/${groupId}`);
      return res.data;
    } catch (ex) {
      console.error(`[GroupService ERROR] Сбой получения информации о группе ${groupId}:`, ex);
      return null;
    }
  }

  public async getGroupMembersAsync(groupId: number): Promise<IGroupMember[] | null> {
    try {
      const res = await apiClient.get<IGroupMember[]>(`api/Groups/${groupId}/members`);
      return res.data;
    } catch (ex) {
      console.error(`[GroupService ERROR] Сбой запроса участников группы ${groupId}:`, ex);
      return null;
    }
  }

  public async getGroupAdministratorsAsync(groupId: number): Promise<IGroupMember[] | null> {
    try {
      const res = await apiClient.get<IGroupMember[]>(`api/Groups/${groupId}/administrators`);
      return res.data;
    } catch (ex) {
      console.error(`[GroupService ERROR] Сбой запроса админов группы ${groupId}:`, ex);
      return null;
    }
  }

  public async getGroupBlacklistAsync(groupId: number): Promise<IGroupMember[] | null> {
    try {
      const res = await apiClient.get<IGroupMember[]>(`api/Groups/${groupId}/blacklist`);
      return res.data;
    } catch (ex) {
      console.error(`[GroupService ERROR] Сбой запроса черного списка группы ${groupId}:`, ex);
      return null;
    }
  }

  public async generateInviteLinkAsync(groupId: number): Promise<{ link: string; expiration: string } | null> {
    try {
      const res = await apiClient.post<{ groupLink: string; expiration: string }>(`api/Groups/generate-invite/${groupId}`);
      if (res.data) {
        return { link: res.data.groupLink, expiration: res.data.expiration };
      }
    } catch (ex) {
      console.error(`[GroupService ERROR] Сбой генерации ссылки для ${groupId}:`, ex);
    }
    return null;
  }

  public async revokeInviteLinkAsync(groupId: number): Promise<boolean> {
    try {
      const res = await apiClient.post(`api/Groups/revoke-invite/${groupId}`);
      return res.status >= 200 && res.status < 300;
    } catch (ex) {
      console.error(`[GroupService ERROR] Сбой отзыва ссылки для ${groupId}:`, ex);
      return false;
    }
  }

  public async updateGroupSettingsAsync(groupId: number, dto: GroupUpdateDto): Promise<boolean> {
    try {
      const res = await apiClient.put(`api/Groups/${groupId}`, dto);
      return res.status >= 200 && res.status < 300;
    } catch (ex) {
      console.error(`[GroupService ERROR] Сбой сохранения настроек группы ${groupId}:`, ex);
      return false;
    }
  }

  public async getMemberPermissionsAsync(groupId: number, memberId: number): Promise<MemberPermissionsDto | null> {
    try {
      const res = await apiClient.get<MemberPermissionsDto>(`api/Groups/${groupId}/member-permissions/${memberId}`);
      return res.data;
    } catch (ex) {
      console.error(`[GroupService ERROR] Сбой получения прав участника ${memberId}:`, ex);
      return null;
    }
  }

  public async saveMemberPermissionsAsync(
    groupId: number,
    memberId: number,
    permissions: MemberPermissionsDto
  ): Promise<boolean> {
    try {
      const res = await apiClient.post(`api/Groups/${groupId}/member-permissions/${memberId}`, permissions);
      return res.status >= 200 && res.status < 300;
    } catch (ex) {
      console.error(`[GroupService ERROR] Сбой сохранения прав участника ${memberId}:`, ex);
      return false;
    }
  }

  public async kickMemberAsync(groupId: number, memberId: number): Promise<boolean> {
    try {
      const res = await apiClient.post(`api/Groups/kick/${groupId}/${memberId}`);
      return res.status >= 200 && res.status < 300;
    } catch (ex) {
      console.error(`[GroupService ERROR] Сбой кика участника ${memberId}:`, ex);
      return false;
    }
  }

  public async banMemberAsync(groupId: number, memberId: number): Promise<boolean> {
    try {
      const res = await apiClient.post(`api/Groups/ban/${groupId}/${memberId}`);
      return res.status >= 200 && res.status < 300;
    } catch (ex) {
      console.error(`[GroupService ERROR] Сбой бана участника ${memberId}:`, ex);
      return false;
    }
  }

  public async unbanMemberAsync(groupId: number, memberId: number): Promise<boolean> {
    try {
      const res = await apiClient.post(`api/Groups/unban/${groupId}/${memberId}`);
      return res.status >= 200 && res.status < 300;
    } catch (ex) {
      console.error(`[GroupService ERROR] Сбой разбана участника ${memberId}:`, ex);
      return false;
    }
  }

  public async joinGroupByLinkAsync(link: string): Promise<GroupJoinResultDto | null> {
    try {
      const res = await apiClient.post<{ id: number; name?: string }>('api/Groups/join-by-link', { link });
      if (res.data) {
        return {
          groupId: res.data.id,
          groupName: res.data.name || 'Group',
        };
      }
    } catch (ex) {
      console.error('[GroupService ERROR] Сбой JoinGroupByLinkAsync:', ex);
    }
    return null;
  }

  public async getLinkPreviewAsync(link: string): Promise<GroupPreviewDto | null> {
    try {
      const res = await apiClient.get<GroupPreviewDto>(`api/Groups/preview-link?link=${encodeURIComponent(link)}`);
      return res.data;
    } catch (ex) {
      console.warn(`[GroupService WARNING] Сбой превью ссылки ${link}:`, ex);
      return null;
    }
  }

  public async createGroupAsync(dto: GroupCreationDto): Promise<GroupCreateResultDto | null> {
    try {
      const res = await apiClient.post<GroupCreateResultDto>('api/Groups/create', dto);
      return res.data;
    } catch (ex) {
      console.error('[GroupService ERROR] Сбой CreateGroupAsync:', ex);
      return null;
    }
  }

  public async leaveGroupAsync(groupId: number): Promise<boolean> {
    try {
      const res = await apiClient.post(`api/Groups/leave/${groupId}`);
      return res.status >= 200 && res.status < 300;
    } catch (ex) {
      console.error(`[GroupService ERROR] Сбой выхода из группы ${groupId}:`, ex);
      return false;
    }
  }
}

export const groupService = new GroupService();