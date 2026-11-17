export type PrototypeLocale = 'zh-CN' | 'en';
export type LanguagePreference = 'auto' | PrototypeLocale;

// Match the existing preference boundary: explicit choices are Chinese/English;
// auto uses the browser language and English is the fallback for other languages.
export function resolveLocale(preference: LanguagePreference, languages: readonly string[] = navigator.languages): PrototypeLocale {
  if (preference !== 'auto') return preference;
  const known = new Set(['bn', 'cs', 'de', 'el', 'en', 'es', 'fil', 'fr', 'hi', 'hu', 'id', 'it', 'ja', 'ko', 'nb', 'nl', 'pl', 'pt', 'ro', 'ru', 'sk', 'sv', 'te', 'th', 'tr', 'uk', 'vi', 'zh']);
  const language = languages.map(value => value.replace(/_/g, '-').toLowerCase().split('-')[0]).find(value => known.has(value));
  return language === 'zh' ? 'zh-CN' : 'en';
}

const english = {
  prototype: 'Independent app preview',
  notice: 'This preview uses synthetic data. Continue using the existing app for your tasks and timer.',
  navigation: 'Preview navigation',
  tasks: 'Tasks',
  timer: 'Timer',
  calendar: 'Calendar',
  reports: 'Reports',
  forest: 'Forest',
  settings: 'Settings',
  sample: 'Synthetic data',
  taskList: 'Sample task list',
  readOnly: 'Read-only preview',
  taskHelp: 'This task comes from the injected sample service. It is kept in memory for this preview.',
  noTasks: 'No sample tasks',
  pending: 'This view will be rebuilt in a later phase.',
  pendingHelp: 'Its existing functionality remains available in the current app.',
  timerPreview: 'Timer layout preview',
  timerIdle: 'Timer is not running',
  timerHelp: 'Timer and recovery services are not connected in this skeleton.',
  language: 'Language',
  theme: 'Theme',
  automatic: 'System default',
  light: 'Light',
  dark: 'Dark',
  settingsHelp: 'These preferences apply only to this isolated preview.',
  saveError: 'The preference could not be saved. Please try again.',
  optionalTitle: 'Optional resources',
  optionalLoading: 'Loading optional resources…',
  optionalReady: 'Optional resources loaded',
  optionalFailed: 'Optional resources are unavailable. The preview remains usable.',
  retry: 'Retry',
  previewFooter: 'Phase B · isolated preview',
  version: 'App metadata version',
  errorTitle: 'This view could not be displayed',
  errorHelp: 'Reload the preview to try again.',
  reload: 'Reload preview',
  skip: 'Skip to content',
};

type Messages = { [Key in keyof typeof english]: string };
const chinese: Messages = {
  prototype: '独立应用预览',
  notice: '此预览使用合成数据。日常任务和计时请继续使用现有应用。',
  navigation: '预览导航',
  tasks: '任务',
  timer: '计时',
  calendar: '日程',
  reports: '报表',
  forest: '森林',
  settings: '设置',
  sample: '合成数据',
  taskList: '示例任务清单',
  readOnly: '只读预览',
  taskHelp: '此任务来自注入的示例服务，仅保存在本次预览的内存中。',
  noTasks: '暂无示例任务',
  pending: '此视图将在后续阶段重建。',
  pendingHelp: '现有功能仍可在当前应用中使用。',
  timerPreview: '计时布局预览',
  timerIdle: '计时尚未启动',
  timerHelp: '此骨架尚未接入计时与恢复服务。',
  language: '语言',
  theme: '主题',
  automatic: '跟随系统',
  light: '浅色',
  dark: '深色',
  settingsHelp: '这些偏好仅应用于当前隔离预览。',
  saveError: '偏好未能保存，请重试。',
  optionalTitle: '可选资源',
  optionalLoading: '正在加载可选资源…',
  optionalReady: '可选资源已加载',
  optionalFailed: '可选资源暂不可用，仍可使用预览。',
  retry: '重试',
  previewFooter: 'Phase B · 隔离预览',
  version: '应用元信息版本',
  errorTitle: '暂时无法显示此视图',
  errorHelp: '请重新加载预览后重试。',
  reload: '重新加载预览',
  skip: '跳至内容',
};

export function messages(locale: PrototypeLocale): Messages {
  return locale === 'zh-CN' ? chinese : english;
}
