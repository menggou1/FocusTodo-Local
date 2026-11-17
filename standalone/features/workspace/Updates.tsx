import { formatDateTime } from '../../domain/display.mjs';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { useWorkspace } from './Context';
import { Dialog } from './Dialog';
import { string } from './model';
import { LegacyIcon } from './LegacyIcon';

export function Updates({openTask}:{openTask(id:string):void}) {
  const {services,text,run,busy}=useWorkspace(),t=(zh:string,en:string)=>services.language.locale.startsWith('zh')?zh:en;
  const reminders=useSyncExternalStore(services.reminders.subscribe,services.reminders.getSnapshot);
  const [open,setOpen]=useState(false),[entry,setEntry]=useState<string|null>(null),[version,setVersion]=useState(0);void version;
  const entries=services.release.entries(),unread=!!(reminders.unread.length||services.release.hasUnread());
  useEffect(()=>{if(entry===services.release.metadata.version)void run(async()=>{await services.release.markRead(entry);setVersion(v=>v+1)})},[entry,services]);
  useEffect(()=>{if(!open)return;const key=(event:KeyboardEvent)=>{if(event.key==='Escape')setOpen(false)};document.addEventListener('keydown',key);return()=>document.removeEventListener('keydown',key)},[open]);
  const current=entries.find(item=>item.version===entry);
  return <><button data-view="notifications" aria-label={t('通知与更新','Notifications and updates')} title={t('通知','Notifications')} aria-expanded={open} onClick={()=>setOpen(!open)}><LegacyIcon name={unread?'header-notification-highlight':'header-notification'}/></button>
    {open&&<><button className="workspace-menu-dismiss" aria-label={text.close} onClick={()=>setOpen(false)}/><section className="legacy-notification-popover" aria-label={t('通知','Notifications')}><header>{t('通知','Notifications')}</header><div className="legacy-notification-scroll">{reminders.due.length>0&&<><h3>{t('任务提醒','Task reminders')}</h3>{reminders.due.map(row=><button className="legacy-notification-entry" aria-label={String(row.name)} key={row.id} onClick={()=>{setOpen(false);openTask(row.id)}}><strong>{row.name}</strong><small>{formatDateTime(Number(row.reminderDate),services.language.locale)}</small></button>)}<button disabled={busy||!reminders.unread.length} onClick={()=>{void run(()=>services.reminders.markRead())}}>{t('标记已读','Mark read')}</button></>}<h3>{t('版本更新','Version updates')}</h3>{entries.map((item,i)=><button className="legacy-notification-entry" data-version={string(item.version)} data-unread={i===0&&services.release.hasUnread()||undefined} key={string(item.version)} onClick={()=>{setOpen(false);setEntry(string(item.version))}}><strong>{string(item.title)}</strong><small>{string(item.date)} · {string(item.version)}</small><span>{t('点击查看详情','View details')}</span></button>)}</div></section></>}
    {entry&&<Dialog showClose={false} className="legacy-release-dialog" title={t('版本更新','Version update')} close={()=>setEntry(null)}>{dismiss=><article data-testid="release-entry"><h3>{string(current?.title)}</h3><p className="legacy-meta">{string(current?.date)} · {entry}</p><ul>{(current?.items as string[]||[]).map((item,i)=><li key={i}>{item}</li>)}</ul><footer><button className="primary" onClick={dismiss}>{services.language.legacyText('cmm_ok')}</button></footer></article>}</Dialog>}
  </>;
}
