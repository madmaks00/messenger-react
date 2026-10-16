import { useEffect, useRef, useState } from 'react';
import type { JoinGroupPreviewData } from '../components/modals/JoinGroupDialog';
import { groupService } from '../services/group.service';
import { eventBus } from '../services/eventBus';
import { userSession } from '../services/userSession';
import { useSidebarChatsStore } from '../stores/sidebarChatsStore';
import { useNavigationStore } from '../stores/navigationStore';
import { MainTab } from '../types/enums';
import { normalizeCallAvatar } from '../utils/callAvatar';

export function useGroupInvite() {
  const [data, setData] = useState<JoinGroupPreviewData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const version = useRef(0);
  const joining = useRef(false);
  const close = () => { version.current++; joining.current = false; setData(null); setBusy(false); setError(''); };

  useEffect(() => {
    const open = async (link: string) => {
      if (!link?.trim()) return;
      const request = ++version.current;
      const account = userSession.userId;
      joining.current = false;
      setError(''); setBusy(true);
      setData({groupId:0,title:'Loading...',memberCount:0,onlineCount:0,isChannel:false,joinLink:link});
      try {
        const preview = await groupService.getLinkPreviewAsync(link);
        if (request !== version.current || account !== userSession.userId) return;
        if (!preview) throw new Error('This invitation is unavailable, expired or revoked.');
        setData({groupId:preview.id,title:preview.name,description:preview.description,avatar:normalizeCallAvatar(preview.avatar),
          memberCount:preview.memberCount,onlineCount:preview.onlineCount,isChannel:preview.isChannel,joinLink:link});
      } catch (e: any) {
        if (request === version.current && account === userSession.userId) {
          setData(current => current ? {...current,title:'Group invitation'} : null);
          setError(e?.message || 'Could not load this invitation.');
        }
      } finally { if (request === version.current) setBusy(false); }
    };
    const onOpen = (event: Event) => { void open((event as CustomEvent<string>).detail); };
    window.addEventListener('OpenJoinGroupRequestMessage', onOpen);
    const unsubscribe = eventBus.on('BeforeAccountSwitchMessage', close);
    return () => { version.current++; window.removeEventListener('OpenJoinGroupRequestMessage', onOpen); unsubscribe(); };
  }, []);

  const confirm = async () => {
    if (!data?.groupId || busy || joining.current) return;
    joining.current = true; setBusy(true); setError('');
    const request = version.current, account = userSession.userId, invite = data;
    try {
      const result = await groupService.joinGroupByLinkAsync(invite.joinLink);
      if (request !== version.current || account !== userSession.userId) return;
      if (!result?.groupId) throw new Error('Could not join. The invitation may have expired or been revoked.');
      await useSidebarChatsStore.getState().loadChats(true);
      if (request !== version.current || account !== userSession.userId) return;
      const sidebar = useSidebarChatsStore.getState();
      const chat = sidebar.allChats.find(c => c.isGroup && Number(c.groupId ?? c.id) === result.groupId);
      sidebar.openChat(chat || {id:result.groupId,groupId:result.groupId,groupName:result.groupName,
        nickName:result.groupName,isGroup:true,isChannel:invite.isChannel} as any);
      useNavigationStore.setState({currentTab:MainTab.Chats});
      close();
    } catch (e: any) {
      if (request === version.current && account === userSession.userId) setError(e?.message || 'Could not join this group.');
    } finally {
      if (request === version.current) { joining.current = false; setBusy(false); }
    }
  };
  return {data,busy,error,close,confirm};
}
