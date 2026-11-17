const pad = n => String(n).padStart(2, '0');
export function durationParts(minutes) {
    const total = Math.max(0, Math.round(minutes));
    return { hours: Math.floor(total / 60), minutes: total % 60 };
}
export function formatMinutesDuration(minutes, locale) {
    const {hours, minutes: rest} = durationParts(minutes), zh = locale.startsWith('zh');
    return hours ? (zh ? `${hours}小时` : `${hours}h`) + (rest ? (zh ? `${rest}分钟` : ` ${rest}m`) : '') : (zh ? `${rest}分钟` : `${rest}m`);
}
export function formatSecondsDuration(seconds, locale) {
    return seconds < 60 ? `${Math.round(seconds)}${locale.startsWith('zh') ? '秒' : ' seconds'}` : formatMinutesDuration(seconds / 60, locale);
}
export function formatCompactDuration(seconds) {
    const {hours, minutes} = durationParts(seconds / 60);
    return seconds < 60 ? `${Math.round(seconds)}s` : hours ? `${hours}h${minutes ? minutes+'m' : ''}` : `${minutes}m`;
}
export function formatClock(value) {
    const date = new Date(value);
    return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
/** Moment localDate/localWeekDate used by 1.9.x, without locale-dependent slashes. */
export function formatTaskDate(value, locale, now = new Date()) {
    const zh = locale.startsWith('zh'), date = new Date(value), start = new Date(now);
    start.setHours(0,0,0,0);
    const day = new Date(date); day.setHours(0,0,0,0);
    const tomorrow = new Date(start); tomorrow.setDate(tomorrow.getDate()+1);
    if (+day === +start) return zh ? '今天' : 'Today';
    if (+day === +tomorrow) return zh ? '明天' : 'Tomorrow';
    const sameYear = date.getFullYear() === now.getFullYear();
    if (zh) return `${sameYear ? '' : date.getFullYear()+'年'}${date.getMonth()+1}月${date.getDate()}日`;
    return `${date.getDate()} ${date.toLocaleDateString('en-US',{month:'short'})}${sameYear ? '' : ' '+date.getFullYear()}`;
}
export function formatMonth(value, locale) {
    const date = new Date(value);
    return locale.startsWith('zh') ? `${date.getFullYear()}年${date.getMonth()+1}月` : date.toLocaleDateString('en-US',{month:'long',year:'numeric'});
}
export function formatDateTime(value, locale) {
    const date = new Date(value), hours = date.getHours()%12||12, minutes = pad(date.getMinutes());
    if (!locale.startsWith('zh')) return `${date.getDate()} ${date.toLocaleDateString('en-US',{month:'short'})} ${date.getFullYear()} ${hours}:${minutes} ${date.getHours()<12?'am':'pm'}`;
    const clock = date.getHours()*100+date.getMinutes(), part = clock<600?'凌晨':clock<900?'早上':clock<1130?'上午':clock<1230?'中午':clock<1800?'下午':'晚上';
    return `${date.getFullYear()}年${date.getMonth()+1}月${date.getDate()}日 ${part}${hours}:${minutes}`;
}
