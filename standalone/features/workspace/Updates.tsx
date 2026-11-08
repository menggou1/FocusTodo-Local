import { useEffect, useState, useSyncExternalStore } from 'react';
import { useWorkspace } from './Context';
import { Dialog } from './Dialog';
import { string } from './model';

export function Updates({openTask}:{openTask(id:string):void}) {
  const {services,text,run,busy}=useWorkspace(),t=(zh:string,en:string)=>services.language.locale.startsWith('zh')?zh:en;
  const reminders=useSyncExternalStore(services.reminders.subscribe,services.reminders.getSnapshot);
  const [open,setOpen]=useState(false),[entry,setEntry]=useState<string|null>(null),[version,setVersion]=useState(0);void version;
  const entries=services.release.entries();
  useEffect(()=>{if(entry===services.release.metadata.version)void run(async()=>{await services.release.markRead(entry);setVersion(v=>v+1)})},[entry,services]);
  return <><button data-view="notifications" aria-label={t('通知与更新','Notifications and updates')} onClick={e=>{e.currentTarget.focus();setOpen(true)}}>{t('通知','Notifications')}{(reminders.unread.length||services.release.hasUnread())?' ●':''}</button>
    {open&&<Dialog title={t('通知与更新','Notifications and updates')} close={()=>{setOpen(false);setEntry(null)}}><h3>{t('任务提醒','Task reminders')}</h3>{reminders.due.length===0&&<p>{text.empty}</p>}{reminders.due.map(row=><p key={row.id}><button onClick={()=>{setOpen(false);openTask(row.id)}}>{row.name}</button> · {new Date(Number(row.reminderDate)).toLocaleString(services.language.locale)}</p>)}<button disabled={busy||!reminders.unread.length} onClick={()=>{void run(()=>services.reminders.markRead())}}>{t('标记已读','Mark read')}</button><h3>{t('更新记录','Updates')}</h3>{entries.map(item=><button className="domain-update-entry" key={string(item.version)} onClick={()=>setEntry(string(item.version))}>{string(item.version)} · {string(item.date)} · {string(item.title)}</button>)}{entry&&<article data-testid="release-entry"><h3>{string(entries.find(item=>item.version===entry)?.title)}</h3><ul>{(entries.find(item=>item.version===entry)?.items as string[]||[]).map((item,i)=><li key={i}>{item}</li>)}</ul></article>}</Dialog>}
  </>;
}
