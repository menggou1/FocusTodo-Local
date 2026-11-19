/** Small synchronous fallback for the render boundary, before services can render. */
const english = {
  errorTitle: 'This view could not be displayed',
  errorHelp: 'Reload FocusTodo to try again.',
  reload: 'Reload FocusTodo',
  errorDetails: 'Error details',
  copyDetails: 'Copy details',
  copied: 'Copied',
  copyFailed: 'Copy failed. Copy the selected text manually.',
};
type Messages = { [Key in keyof typeof english]: string };
const chinese: Messages = {
  errorTitle: '暂时无法显示此视图',
  errorHelp: '请重新加载 FocusTodo 后重试。',
  reload: '重新加载 FocusTodo',
  errorDetails: '错误详情',
  copyDetails: '复制详情',
  copied: '已复制',
  copyFailed: '无法自动复制，请手动复制已选内容。',
};
export function messages(locale: 'zh-CN' | 'en'): Messages {
  return locale === 'zh-CN' ? chinese : english;
}
