/**
 * Skin switcher dictionaries. Product copy is Chinese; English mirrors it for
 * the locale fallback.
 */
export const zh = {
  nav: '主题皮肤',
  subtitle: '安装的主题皮肤会出现在这里，选择一个即可切换',
  none: '跟随默认外观',
  noneHint: '不启用任何主题皮肤，使用 DeepSeek Harness 默认外观',
  active: '使用中',
  activate: '启用',
  loading: '正在加载主题皮肤…',
  empty: '还没有安装主题皮肤。安装带 skin.json 的主题包后，刷新本页即可看到。',
  fail: '加载主题皮肤失败',
} as const

export const en = {
  nav: 'Theme skins',
  subtitle: 'Installed theme skins appear here; select one to switch',
  none: 'Default appearance',
  noneHint: 'Disable all theme skins and use the DeepSeek Harness default look',
  active: 'Active',
  activate: 'Activate',
  loading: 'Loading theme skins…',
  empty: 'No theme skins installed yet. Install a theme package with skin.json, then reload this page.',
  fail: 'Failed to load theme skins',
} as const

export type SkinSwitcherKey = keyof typeof zh

export const skins = { zh, en } as const
