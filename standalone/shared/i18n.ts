/** Small synchronous fallback for the render boundary, before services can render. */
const english = {
  errorTitle: 'This view could not be displayed',
  errorHelp: 'Reload FocusTodo to try again.',
  reload: 'Reload FocusTodo',
};
type Messages = { [Key in keyof typeof english]: string };
const chinese: Messages = {
  errorTitle: '暂时无法显示此视图',
  errorHelp: '请重新加载 FocusTodo 后重试。',
  reload: '重新加载 FocusTodo',
};
export function messages(locale: 'zh-CN' | 'en'): Messages {
  return locale === 'zh-CN' ? chinese : english;
}
