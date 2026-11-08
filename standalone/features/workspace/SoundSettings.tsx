import { useEffect, useSyncExternalStore } from 'react';
import { Dialog } from './Dialog';
import { useWorkspace } from './Context';

const files = Object.keys(import.meta.glob('../../../public/audio/*')).map(path => path.split('/').pop()!);
export function SoundSettings({ close }: {close(): void}) {
  const { services, text, run, busy, blocked } = useWorkspace();
  const preferences = useSyncExternalStore(services.settings.subscribe, services.settings.getSnapshot);
  useEffect(() => () => services.audio?.stopAudition(), [services]);
  return <Dialog title={text.audio} close={close}>
    {!navigator.locks && <p>{services.language.text('当前浏览器不支持多标签页背景音协调，已暂停自动背景音。计时、完成铃声和手动试听仍可使用。') as string}</p>}
    {(['bgMusic', 'workAlarm', 'breakAlarm'] as const).map(field => {
      const background = field === 'bgMusic', key = background ? 'bgm' : field === 'workAlarm' ? 'alm_work' : 'alm_break';
      const options = files.filter(file => background ? file.startsWith('bgm_') : file.startsWith('alm_')).map(file => file.replace(/\.[^.]+$/, ''));
      return <div key={field}><label>{services.language.legacyText(key)}<select aria-label={services.language.legacyText(key)} disabled={busy || blocked} value={preferences[field]} onChange={event => { void run(() => services.settings.set(field, event.target.value)); }}>
        {!background && <option value="alm_None">{text.none}</option>}{options.map(file => <option key={file} value={file}>{services.language.legacyText(file)}</option>)}</select></label>
        <button type="button" disabled={!services.audio || preferences[field] === 'alm_None' || busy} onClick={() => { void run(async () => { services.audio?.audition(preferences[field] + (background ? '.m4a' : '.mp3'), (background ? preferences.whiteNoiseVolume : preferences.ringtoneVolume) / 100); }); }}>{text.previewSound}</button></div>;
    })}
    {(['whiteNoiseVolume', 'ringtoneVolume'] as const).map(field => <label key={field}>{services.language.legacyText(field === 'whiteNoiseVolume' ? 'bgm' : 'alm')} (%)<input type="range" min={0} max={100} value={preferences[field]} disabled={busy || blocked}
      onChange={event => { const value = event.target.valueAsNumber; void run(async () => { await services.settings.set(field, value); services.audio?.auditionVolume(value / 100); }); }} /></label>)}
    <label className="workspace-check"><input type="checkbox" checked={preferences.completeSoundEnabled} disabled={busy || blocked} onChange={event => { void run(() => services.settings.set('completeSoundEnabled', event.target.checked)); }} />{services.language.legacyText('gen_play_complete_sound')}</label>
    <footer><button onClick={() => services.audio?.stopAudition()}>{text.stopSound}</button><button onClick={close}>{text.close}</button></footer>
  </Dialog>;
}
