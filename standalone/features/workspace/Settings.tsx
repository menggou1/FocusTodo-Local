import { Avatar } from './Avatar';
import { confirmInApp } from '../../services/confirmation';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { WritablePreference, PreferenceState, EncodedBackup, BackupInspection } from '../../services/core.mjs';
import { useWorkspace } from './Context';
import { Dialog } from './Dialog';
import { SoundSettings, SettingsSelect } from './SoundSettings';
import { SettingsProjects } from './SettingsProjects';
import { string } from './model';
import { usePreferenceChanges } from './usePreferenceChanges';

const themes=import.meta.glob<string>('../../../public/img/timer-bg-*.jpg',{query:'?url',import:'default',eager:true});
const icons=import.meta.glob<string>('../../../public/img/{setting-*,header-portrait,github,theme-selected}.*',{query:'?url',import:'default',eager:true});
const icon=(name:string)=>icons['../../../public/img/'+name];
export const classicThemes: Record<string,string>={Leaf:'leaf',Ocean:'ocean',Trees:'trees',StarrySky:'starrysky',Desert:'desert',Forest:'forest',Mountain:'mountain',Beach:'beach',City:'city',Lake:'lake'};
const platformNames = {apple: 'Apple', android: 'Android', windows: 'Windows', mac: 'macOS', chrome: 'Chrome', edge: 'Edge'};
const externalLink = {target: '_blank', rel: 'noopener noreferrer'} as const;
const platformLinks=(zh:boolean):Record<string,string>=>({apple:'https://itunes.apple.com/'+(zh?'CN':'US')+'/app/id966057213?mt=8',android:zh?'https://sj.qq.com/myapp/detail.htm?apkName=com.superelement.pomodoro':'https://play.google.com/store/apps/details?id=com.superelement.pomodoro',windows:'https://www.microsoft.com/store/apps/9N8GPB2TK8GB',mac:'https://itunes.apple.com/'+(zh?'CN':'US')+'/app/id1258530160?mt=12',chrome:'https://chrome.google.com/webstore/detail/ngceodoilcgpmkijopinlkmohnfifjfb',edge:'https://microsoftedge.microsoft.com/addons/detail/ffhiojdfkpecinnmmbhmijmgffknaokd'});
export function themeURL(theme:string) {return themes['../../../public/img/timer-bg-'+(classicThemes[theme==='Sea'?'Ocean':theme]||'leaf')+'.jpg']}
// Cache decoded images, keeping the old painted timer until the next is ready.
const decodedImages=new Map<string,Promise<HTMLImageElement>>();
export function prepareImage(url:string) {
  let pending=decodedImages.get(url);
  if(!pending){const image=new Image();image.src=url;pending=image.decode().then(()=>image);decodedImages.set(url,pending);pending.catch(()=>decodedImages.delete(url))}
  return pending;
}
export function preloadThemes(){for(const url of Object.values(themes))void prepareImage(url).catch(()=>{})}
function download(bytes:Uint8Array,mime:string,name:string) {const url=URL.createObjectURL(new Blob([new Uint8Array(bytes)],{type:mime}));const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000)}
export function Settings({initialTab='pomodoro'}:{initialTab?:string}) {
  const {services,text,run,busy,blocked,report}=useWorkspace(),lt=(value:string)=>services.language.text(value) as string,legacy=services.language.legacyText,t=(zh:string,en:string)=>services.language.locale.startsWith('zh')?zh:en;
  const {prefs,change}=usePreferenceChanges(),data=useSyncExternalStore(services.business.subscribe,services.business.getSnapshot),permission=useSyncExternalStore(services.notifications.subscribe,services.notifications.getSnapshot);
  const profile=useSyncExternalStore(services.settings.subscribeProfile,services.settings.profile);
  const [tab,setTab]=useState(initialTab),[modal,setModal]=useState<'export'|'restore'|'reset'|null>(null),[version,setVersion]=useState(0),[scope,setScope]=useState(true),[format,setFormat]=useState<'json'|'gzip'>(typeof CompressionStream==='undefined'?'json':'gzip'),[file,setFile]=useState<File|null>(null),[countdown,setCountdown]=useState(5),[name,setName]=useState(profile.name),[prepared,setPrepared]=useState<EncodedBackup|null>(null),[inspection,setInspection]=useState<BackupInspection|null>(null),[backupStatus,setBackupStatus]=useState(''),[backupError,setBackupError]=useState(''),[avatarDraft,setAvatarDraft]=useState(''),[notice,setNotice]=useState('');
  const content=useRef<HTMLDivElement>(null),themeRequest=useRef(0);
  const selectTheme=async(id:string,url:string)=>{const request=++themeRequest.current,current=services.themes.read();if((current.active||current.theme||'Leaf')===id)return;try{await prepareImage(url);if(request!==themeRequest.current||!mounted.current)return;if(classicThemes[id])await services.wallpaper.classic(id);else await services.wallpaper.select(id)}catch(error){report(error)}};
  useLayoutEffect(()=>{content.current?.scrollTo(0,0)},[tab]);
  const avatarCanvas=useRef<HTMLCanvasElement|null>(null);
  const wallpaper=useSyncExternalStore(services.wallpaper.subscribe,services.wallpaper.getSnapshot),bingLoading=wallpaper.loading,bingRequest=useRef(false),mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[]);
  const library=tab==='appearance'?services.wallpaper.read():{},selectedTheme=tab==='appearance'?(services.themes.read().active||services.themes.read().theme||'Leaf'):'Leaf';
  const loadBing=async()=>{
    if(!prefs.externalNetwork){setNotice(lt('请打开外部联网'));return}
    if(bingRequest.current)return;themeRequest.current++;const cached=services.wallpaper.read().__bing_daily__?.dataUrl;bingRequest.current=true;setNotice('');
    try{const pending=services.wallpaper.bing();setVersion(v=>v+1);await pending}
    catch(error){const failure=error as {code?:string;recoveryRequired?:boolean};if(failure.recoveryRequired||['disposed','incompatible-client'].includes(failure.code||''))report(error);else if(failure.code!=='cancelled'&&mounted.current&&!cached){setNotice(lt('获取 Bing 每日壁纸失败。')+((error as Error).message||''))}}
    finally{bingRequest.current=false;if(mounted.current)setVersion(v=>v+1)}
  };
  const avatarInput=useRef<HTMLInputElement>(null),wallpaperInput=useRef<HTMLInputElement>(null),importInput=useRef<HTMLInputElement>(null);
  void version;
  useEffect(()=>{if(tab!=='account'){avatarCanvas.current=null;setAvatarDraft('')}},[tab]);
  useEffect(()=>{const refresh=()=>{services.notifications.refresh()};window.addEventListener('focus',refresh);refresh();return()=>window.removeEventListener('focus',refresh)},[services]);
  useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(''),3000);return()=>clearTimeout(timer)},[notice]);
  useEffect(()=>{if(modal!=='reset')return;setCountdown(5);const timer=setInterval(()=>setCountdown(n=>Math.max(0,n-1)),1000);return()=>clearInterval(timer)},[modal]);
  useEffect(()=>{if(modal!=='export')return;let active=true;setPrepared(null);void services.backup.export({format:'json',includeWallpapers:scope}).then(result=>{if(active)setPrepared(result)},report);return()=>{active=false}},[modal,scope,services]);
  useEffect(()=>{if(modal!=='restore'||!file)return;let active=true;setInspection(null);setBackupError('');setBackupStatus(lt('正在识别、解压和校验文件…'));void services.backup.inspect(file).then(result=>{if(active){setInspection(result);setBackupStatus('')}},error=>{if(active){setBackupStatus('');setBackupError(lt('导入失败：')+(error as Error).message+lt('。当前数据未被覆盖。'))}});return()=>{active=false}},[modal,file,services]);
  const labels:Record<string,string>={account:legacy('usr_acct'),general:legacy('gen'),pomodoro:legacy('pomo'),projects:legacy('gen_project_management'),appearance:legacy('apr'),about:legacy('abt')};
  const navIcons:Record<string,string>={account:'account',general:'general',pomodoro:'pomo',projects:'projects',appearance:'theme',about:'about'};
  const toggle=(key:WritablePreference,label:string)=><label className="domain-setting" key={key}><span>{label}</span><input className="legacy-switch" type="checkbox" checked={!!prefs[key]} disabled={busy||blocked} onChange={e=>{void change(key,e.target.checked as never)}}/></label>;
  const minuteOptions=useMemo(()=>Array.from({length:480},(_,i)=><option key={i+1} value={i+1} data-search-value={(i+1)*60}>{legacy('pomo_min',i+1)}</option>),[legacy,services.language.locale]);
  const duration=(key:'workInterval'|'shortBreakInterval'|'longBreakInterval',label:string,accessible:string)=><div className="domain-setting" key={key}><span>{label}</span><SettingsSelect aria-label={accessible} value={prefs[key]/60} disabled={busy||blocked} onChange={e=>{void change(key,Math.round(Number(e.target.value)*60))}}>{minuteOptions}{!Number.isInteger(prefs[key]/60)&&<option value={prefs[key]/60}>{legacy('pomo_min',prefs[key]/60)}</option>}</SettingsSelect></div>;
  const openBackup=(kind:'export'|'restore'|'reset')=>{setBackupStatus('');setBackupError('');if(kind==='restore'){importInput.current?.click();return}setModal(kind);setFile(null)};
  useEffect(()=>setName(profile.name),[profile.name]);
  const saveName=async()=>{if(name===profile.name)return;if(await run(()=>services.settings.saveProfile('name',name)))return;setName(profile.name)};
  const accountButtons=<><button type="button" onClick={()=>openBackup('export')}>{t('导出数据','Export data')}</button><button type="button" className="danger" onClick={()=>openBackup('reset')}>{t('删除数据','Delete data')}</button><button type="button" onClick={()=>openBackup('restore')}>{t('导入数据','Import data')}</button></>;
  return <section data-testid="settings-page" className="domain-settings legacy-settings" data-tab={tab}><nav aria-label={text.settings}>{Object.entries(labels).map(([key,label])=><button key={key} data-settings-tab={key} aria-label={key==='account'?t('账号资料','Profile'):key==='projects'?text.manageLists:label} aria-current={tab===key?'page':undefined} onClick={()=>setTab(key)}><img draggable={false} src={icon('setting-'+navIcons[key]+'.png')} alt=""/><span>{label}</span></button>)}</nav><div ref={content} className="domain-card legacy-settings-content">
    {tab==='general'&&<>
      <h2 className="workspace-sr">{labels.general}</h2>
      <div className="domain-setting"><span>{text.language}</span><SettingsSelect searchable={false} selectedMark data-testid="prototype-language" aria-label={text.language} value={prefs.language} disabled={busy||blocked} onChange={e=>{void change('language',e.target.value as PreferenceState['language'])}}><option value="auto">{text.auto}</option><option value="zh-CN">简体中文</option><option value="en">English</option></SettingsSelect></div>
      {toggle('newTaskOnTop',legacy('gen_new_task_on_top'))}
      <hr/>
      <h3 className="legacy-settings-category">{lt('通知')}</h3>
      <div className="domain-setting">
        <span>{lt('桌面通知')}</span>
        <button className="legacy-notification-action" disabled={busy||blocked||permission==='unavailable'||permission==='denied'} aria-describedby="desktop-notification-status" onClick={()=>{void run(async()=>{if(permission==='granted')services.notifications.show(lt('通知测试'),lt('专注完成时将在此显示通知。'));else await services.notifications.requestPermission()})}}>{lt(permission==='granted'?'发送测试通知':'允许通知')}</button>
        <span id="desktop-notification-status" className="workspace-sr" role="status">{lt(permission==='granted'?'通知已允许':permission==='denied'?'通知已被阻止，请在浏览器站点设置中修改。':permission==='unavailable'?'当前浏览器不支持桌面通知。':'通知未授权')}</span>
      </div>
      <hr/>
      <h3 className="legacy-settings-category">{legacy('gen_feature')}</h3>
      {toggle('forestEnabled',legacy('frt'))}{toggle('externalNetwork',lt('外部联网（实验性）'))}
    </>}
    {tab==='pomodoro'&&<><h2 className="workspace-sr">{labels.pomodoro}</h2>{duration('workInterval',legacy('pomo_len'),text.interval)}{duration('shortBreakInterval',legacy('pomo_break_short'),t('短休息（分钟）','Short break (minutes)'))}{duration('longBreakInterval',legacy('pomo_break_long'),t('长休息（分钟）','Long break (minutes)'))}<div className="domain-setting"><span>{legacy('pomo_break_num')}</span><SettingsSelect aria-label={t('长休息间隔番茄数','Pomodoros before long break')} value={prefs.longBreakPomodoros} onChange={e=>{void change('longBreakPomodoros',Number(e.target.value))}}>{[...new Set([...Array.from({length:90},(_,i)=>i+1),prefs.longBreakPomodoros])].map(n=><option key={n} value={n}>{legacy('pomo_unit').replace('{0}',String(n))}</option>)}</SettingsSelect></div><hr/>{toggle('autoWorkEnabled',legacy('pomo_auto_start'))}{toggle('autoBreakEnabled',legacy('pomo_auto_break'))}{toggle('banBreakEnabled',legacy('pomo_ban_break'))}<hr/><SoundSettings inline/></>}
    {tab==='appearance'&&<><h2 className="workspace-sr">{labels.appearance}</h2><div className="domain-setting"><span>{legacy('apr_dark_mode')}</span><SettingsSelect data-testid="prototype-theme" aria-label={text.theme} value={prefs.isDarkMode===null?'auto':prefs.isDarkMode?'dark':'light'} disabled={busy||blocked} onChange={e=>{void change('isDarkMode',e.target.value==='auto'?null:e.target.value==='dark')}}><option value="light">{text.light}</option><option value="dark">{text.dark}</option><option value="auto">{legacy('apr_sys')}</option></SettingsSelect></div><hr/><h3 className="legacy-theme-title">{legacy('apr_theme')}</h3><div className="domain-theme-grid">{Object.entries(classicThemes).map(([key,name])=><button key={key} className="legacy-theme" title={key} aria-label={key} disabled={busy||blocked} aria-pressed={(selectedTheme==='Sea'?'Ocean':selectedTheme)===key} onClick={()=>{void selectTheme(key,themeURL(key))}}><span><img draggable={false} src={themes['../../../public/img/timer-bg-'+name+'-shortcut.jpg']} alt=""/></span>{(selectedTheme==='Sea'?'Ocean':selectedTheme)===key&&<img className="legacy-theme-selected" src={icon('theme-selected.png')} alt=""/>}</button>)}
      <button className="legacy-theme legacy-bing" aria-label={t('Bing 每日','Bing daily')} aria-pressed={selectedTheme==='__bing_daily__'} aria-busy={bingLoading} disabled={busy||blocked} onClick={()=>void loadBing()}><span><img src={string(library.__bing_daily__?.thumbnail)||icon('setting-theme.png')} alt=""/></span><small>{bingLoading?lt('下载中...'):t('Bing 每日','Bing daily')}</small>{selectedTheme==='__bing_daily__'&&<img className="legacy-theme-selected" src={icon('theme-selected.png')} alt=""/>}</button><button className="legacy-theme legacy-upload" disabled={busy||blocked} onClick={()=>wallpaperInput.current?.click()}><span><span className="legacy-upload-placeholder"><b aria-hidden="true">📁</b>{lt('本地上传')}</span></span></button>
      {Object.entries(library).filter(([id,row])=>id!=='__bing_daily__'&&row.type!=='bing').sort(([,a],[,b])=>Number(a.createdAt||0)-Number(b.createdAt||0)).map(([id,row])=>{const name=string(row.originalName||row.name)||lt('自定义');return <div className="legacy-custom-theme" key={id}><button className="legacy-theme" aria-label={name} title={name} aria-pressed={selectedTheme===id} disabled={busy||blocked} onClick={()=>{void selectTheme(id,string(row.dataUrl))}}><span><img src={string(row.thumbnail||row.dataUrl)} alt=""/></span><small>{name.length>10?name.slice(0,8)+'...':name}</small>{selectedTheme===id&&<img className="legacy-theme-selected" src={icon('theme-selected.png')} alt=""/>}</button><button className="legacy-theme-remove" disabled={busy||blocked} title={lt('删除此主题')} aria-label={text.remove+': '+name} onClick={async()=>{if(await confirmInApp(lt('删除此主题'),lt('确定要删除此自定义主题吗？')))void run(async()=>{await services.wallpaper.remove(id);setVersion(v=>v+1)})}}>×</button></div>})}
      </div><input ref={wallpaperInput} type="file" hidden accept="image/*" disabled={busy||blocked} aria-label={t('上传图片','Upload image')} onChange={e=>{const image=e.target.files?.[0];if(image)void run(async()=>{await services.wallpaper.add(image,image.name);setVersion(v=>v+1)});e.target.value=''}}/></>}
    {tab==='projects'&&<><h2 className="workspace-sr">{labels.projects}</h2><SettingsProjects projects={data.projects}/></>}
    {tab==='account'&&<><h2 className="workspace-sr">{t('账号资料','Profile')}</h2><div className="legacy-account-row"><span>{legacy('usr_portrait')}</span><div><Avatar className="domain-avatar" src={avatarDraft||profile.avatar} alt=""/>{avatarDraft?<><button className="primary" disabled={busy||blocked} onClick={()=>{void run(async()=>{await services.settings.saveProfile('avatar',avatarDraft);setAvatarDraft('')})}}>{legacy('cmm_ok')}</button><button disabled={busy} onClick={()=>setAvatarDraft('')}>{text.cancel}</button></>:<button type="button" onClick={()=>avatarInput.current?.click()}>{legacy('usr_upload')}</button>}<input ref={avatarInput} type="file" hidden accept="image/png,image/jpeg,image/gif" aria-label={legacy('usr_portrait')} disabled={busy||blocked} onChange={e=>{const image=e.target.files?.[0];if(image)void run(async()=>{const value=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(reader.error);reader.readAsDataURL(image)});const cropped=await new Promise<string>((resolve,reject)=>{const source=new Image();source.onload=()=>{try{const side=Math.min(source.naturalWidth,source.naturalHeight);if(!side)throw new Error('Invalid avatar dimensions');if(!avatarCanvas.current){avatarCanvas.current=document.createElement('canvas');avatarCanvas.current.width=avatarCanvas.current.height=64}const canvas=avatarCanvas.current,context=canvas.getContext('2d');if(!context){reject(new Error('Canvas unavailable'));return}context.drawImage(source,(source.width-side)/2,(source.height-side)/2,side,side,0,0,64,64);resolve(canvas.toDataURL())}catch(error){reject(Object.assign(error as Error,{code:'validation'}))}};source.onerror=()=>reject(Object.assign(new Error('Invalid avatar'),{code:'validation'}));source.src=value});setAvatarDraft(cropped)}).then(saved=>{if(!saved)setNotice(t('头像上传失败，请选择有效图片。','Avatar upload failed. Choose a valid image.'))});e.target.value=''}}/></div></div><label className="legacy-account-row"><span>{legacy('usr_username')}</span><input aria-label={text.name} required maxLength={50} value={name} onChange={e=>setName(e.target.value)} onBlur={()=>{void saveName()}} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();e.currentTarget.blur()}}}/></label><div className="legacy-account-row"><span>{legacy('usr_acct_management')}</span><div className="legacy-account-actions">{accountButtons}</div></div></>}
    {tab==='about'&&<section className="legacy-about" aria-label={labels.about}>
      <div className="legacy-account-row">
        <span>{t('版本','Version')}</span>
        <span data-selectable>{services.release.metadata.version} · {services.release.metadata.date}</span>
      </div>
      <div className="legacy-account-row">
        <span>{t('本地版作者','Local edition by')}</span>
        <div>
          <span>{services.release.metadata.author}</span>
          <a className="about-icon-link" href="https://github.com/menggou1/FocusTodo-Local" {...externalLink} aria-label={t('GitHub 项目仓库','GitHub project repository')}>
            <img className="about-github-icon" src={icon('github.svg')} width="24" height="24" alt="" draggable={false}/>
          </a>
        </div>
      </div>
      <div className="legacy-account-row">
        <span>{t('来源项目','Source project')}</span>
        <a href="https://github.com/lamngockhuong/focustodo" {...externalLink}>FocusTodo {services.release.metadata.sourceVersion} · Lâm Ngọc Khương</a>
      </div>
      <div className="legacy-account-row">
        <span>{t('许可与版权','Licenses and credits')}</span>
        <div>
          <a href="https://github.com/menggou1/FocusTodo-Local/blob/main/LICENSE" {...externalLink}>MIT</a>
          <a href="https://github.com/menggou1/FocusTodo-Local/blob/main/THIRD-PARTY-NOTICES.txt" {...externalLink}>{t('第三方声明','Third-party notices')}</a>
        </div>
      </div>
      <div className="legacy-account-row">
        <span>{t('本地数据','Local data')}</span>
        <p className="legacy-about-note">{t('任务、专注记录和设置保存在当前浏览器中。本地启动后可离线使用，默认关闭外部联网。','Tasks, focus records, and settings are stored in this browser. The local app works offline, with external networking off by default.')}</p>
      </div>
      <div className="legacy-account-row">
        <span>{t('下载官方版本','Download the official version')}</span>
        <div className="legacy-platforms">
          {Object.entries(platformLinks(services.language.locale.startsWith('zh'))).map(([platform,href])=>{
            const name = platformNames[platform as keyof typeof platformNames];
            return <a className="about-icon-link" key={platform} href={href} {...externalLink} aria-label={t(name+' 官方版本下载','Official '+name+' download')}>
              <img draggable={false} src={icon('setting-logo-'+platform+'.png')} alt=""/>
            </a>;
          })}
        </div>
      </div>
      <div className="legacy-account-row">
        <span>{t('官方网站','Official Website')}</span>
        <a data-selectable href="https://www.focustodo.cn/" {...externalLink}>www.focustodo.cn</a>
      </div>
      <div className="legacy-account-row">
        <span>{t('支持正版','Support the official app')}</span>
        <p className="legacy-about-note">{t('本地版基于原项目开发。感谢原作者的工作，欢迎通过官方渠道支持正版 Focus To-Do。','This local edition is based on the original project. We thank its creators and encourage you to support Focus To-Do through its official channels.')}</p>
      </div>
    </section>}
  </div>
  {notice&&<div className="legacy-settings-notice" role="status">{notice}</div>}
  <input ref={importInput} type="file" hidden accept=".json,.gz,.gzip,application/json,application/gzip" aria-label={lt('导入数据')} onChange={e=>{const picked=e.target.files?.[0];if(picked){setFile(picked);setInspection(null);setModal('restore')}e.target.value=''}}/>
  {modal&&<Dialog appTile={modal==='reset'} className={'legacy-backup-dialog legacy-backup-'+modal} title={lt(modal==='export'?'导出数据备份':modal==='restore'?'导入数据备份':'删除本地数据')} close={()=>setModal(null)}>{dismiss=>{
  const scrollable=modal==='restore'||modal==='export';
  const form=<form tabIndex={scrollable?0:undefined} data-local-scroll={scrollable||undefined}
    onKeyDown={scrollable?event=>{
      if(event.target!==event.currentTarget||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return;
      if(event.key!=='Home'&&event.key!=='End')return;
      event.preventDefault();
      const form=event.currentTarget;
      form.scrollTo({top:event.key==='Home'?0:form.scrollHeight-form.clientHeight,behavior:'instant'});
    }:undefined} onSubmit={async e=>{e.preventDefault();setBackupError('');if(await run(async()=>{
    if(modal==='export'){const result=await services.backup.export({format,includeWallpapers:scope}),filename='FocusTodo-backup-'+(result.scope==='without-wallpapers'?'without-wallpapers':'full')+'-'+new Date().toISOString().replace(/[:.]/g,'-')+result.extension;download(result.bytes,result.mime,filename);setBackupStatus(lt('已发起')+(result.format==='gzip'?lt(' Gzip 压缩'):lt('普通 JSON'))+lt('下载：')+filename+lt('，实际文件 ')+formatBytes(result.size)+lt('。请在浏览器下载列表确认文件已保存。'))}
    else if(modal==='restore'&&file)await services.backup.restore(file);
    else if(modal==='reset')await services.backup.reset();
  })&&modal!=='export') {dismiss();setVersion(v=>v+1);setAvatarDraft('');setName(services.settings.profile().name)}}}>
    {modal==='export'?<><label className="workspace-check legacy-backup-scope"><input type="checkbox" checked={scope} disabled={busy} onChange={e=>setScope(e.target.checked)}/>{lt('包含壁纸图片（完整备份，默认）')}</label><p className="legacy-meta">{lt(scope?'保留全部任务、历史、设置和壁纸。':'不含壁纸：任务和专注明细保留；导入后使用默认 Leaf 主题。导入前和删除前自动备份始终包含全部壁纸。')}</p><fieldset className="legacy-backup-formats"><legend>{lt('文件格式')}</legend><label className="workspace-check"><input type="radio" name="format" value="gzip" checked={format==='gzip'} disabled={busy||typeof CompressionStream==='undefined'} onChange={()=>setFormat('gzip')}/>{lt('Gzip 压缩（.json.gz，推荐）')}</label><label className="workspace-check"><input type="radio" name="format" value="json" checked={format==='json'} disabled={busy} onChange={()=>setFormat('json')}/>{lt('普通紧凑 JSON（.json，兼容旧版）')}</label></fieldset><p className="legacy-meta">{lt(typeof CompressionStream==='undefined'?'当前浏览器不支持压缩 API，将导出普通 JSON。':'新版可读取旧 JSON；旧版需先解压 .json.gz，或使用普通 JSON。')}</p>{prepared&&<BackupAnalysis data={prepared.data} totalBytes={prepared.rawBytes}/>}<p className="legacy-meta" role="status">{backupStatus||(prepared?lt('数据快照已准备，可选择范围和格式后生成文件。'):lt('正在读取一致数据快照…'))}</p></>:modal==='restore'?<><p className="legacy-meta" role="status">{backupStatus||(inspection?(inspection.format==='gzip'?lt('Gzip 压缩文件'):lt('JSON 文件'))+lt('，解码后 ')+formatBytes(inspection.decodedBytes)+lt('。范围：')+lt(inspection.scope==='full'?'完整备份（含壁纸）':'不含壁纸（恢复后使用默认 Leaf 主题）')+'。':'')}</p>{inspection&&<><BackupAnalysis data={inspection.data} totalBytes={inspection.decodedBytes}/><p>{lt('将覆盖当前任务、专注记录和设置。导入前会发起完整安全备份下载，请确认下载文件已保存。计时快照不会自动运行。')}</p></>}</>:<><p>{lt('将删除所有任务、专注记录和设置，并重置为默认状态。')}</p><p>{lt('删除前会生成完整备份，请检查浏览器下载文件。此操作无需密码。')}</p></>}
    <p className="legacy-backup-error" role="alert" data-selectable>{backupError}</p><footer><button type="button" disabled={busy} onClick={dismiss}>{modal==='export'?text.close:text.cancel}</button><button className="primary" disabled={busy||blocked||(modal==='export'&&!prepared)||(modal==='restore'&&!inspection)||(modal==='reset'&&countdown>0)}>{modal==='reset'?countdown>0?lt('确认删除（')+countdown+lt(' 秒）'):lt('确认删除'):modal==='export'?lt('生成并下载'):lt('确认覆盖并导入')}</button></footer>
  </form>;
  return scrollable?<div className="legacy-backup-scroll">{form}</div>:form;
  }}</Dialog>}
  </section>;
}
function formatBytes(value:number) { return value>=1000000?(value/1000000).toFixed(2)+' MB':(value/1000).toFixed(1)+' KB'; }
function BackupAnalysis({data,totalBytes}:{data:EncodedBackup['data'];totalBytes:number}) {
  const {services}=useWorkspace(),lt=(value:string)=>services.language.text(value) as string,t=(zh:string,en:string)=>services.language.locale.startsWith('zh')?zh:en;
  const size=(value:unknown)=>new TextEncoder().encode(JSON.stringify(value)).length,kb=formatBytes;
  const db=data.indexedDB,settings=data.localStorage;
  const themes=JSON.parse(settings['lexible-custom-themes']||'{}') as Record<string,{dataUrl?:string;thumbnail?:string}>;
  const taskCount=(db.Task?.length||0)+(db.Subtask?.length||0),taskSize=size(db.Task||[])+size(db.Subtask||[]);
  const other=Object.entries(db).filter(([key])=>!['Task','Subtask','Pomodoro'].includes(key)),otherSettings=Object.fromEntries(Object.entries(settings).filter(([key])=>key!=='lexible-custom-themes')),resources=Object.values(themes).flatMap(row=>[row.dataUrl,row.thumbnail]).filter(Boolean);
  return <><table className="legacy-backup-analysis"><caption>{lt('紧凑 JSON 体积分析')}</caption><tbody><tr><th>{t('任务及子任务','Tasks and subtasks')}</th><td>{taskCount}{t(' 条',' records')}</td><td>{kb(taskSize)}</td></tr><tr><th>{t('专注记录','Focus records')}</th><td>{db.Pomodoro?.length||0}{t(' 条',' records')}</td><td>{kb(size(db.Pomodoro||[]))}</td></tr><tr><th>{t('其他数据','Other data')}</th><td>{other.reduce((n,[,rows])=>n+(rows?.length||0),0)}{t(' 条记录 / ',' records / ')}{Object.keys(otherSettings).length}{t(' 项设置',' settings')}</td><td>{kb(size({meta:data.meta,indexedDB:Object.fromEntries(other),localStorage:otherSettings}))}</td></tr><tr><th>{t('壁纸图片','Wallpaper images')}</th><td>{Object.keys(themes).length}{t(' 个主题 / ',' themes / ')}{resources.length}{lt(' 张原图及缩略图')}</td><td>{kb(resources.reduce((n,row)=>n+size(row),0))}</td></tr></tbody></table><p className="legacy-meta">{lt('紧凑 JSON 合计 ')}{kb(totalBytes)}{lt('。分项按字段序列化估算，图片为 data URL 编码体积，含缩略图；不含容器开销，分项不直接相加。')}</p></>;
}
