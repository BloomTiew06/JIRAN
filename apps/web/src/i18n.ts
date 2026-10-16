/** App chrome in the four languages residents can pick. Content written by neighbours stays as written. */
const STRINGS: Record<string, Record<'en' | 'ms' | 'zh' | 'ta', string>> = {
  'tab.map': { en: 'Map', ms: 'Peta', zh: '地图', ta: 'வரைபடம்' },
  'tab.neighbours': { en: 'Neighbours', ms: 'Jiran', zh: '邻居', ta: 'அயலவர்' },
  'tab.share': { en: 'Share', ms: 'Kongsi', zh: '分享', ta: 'பகிர்' },
  'tab.activities': { en: 'Activities', ms: 'Aktiviti', zh: '活动', ta: 'நிகழ்வுகள்' },
  'tab.help': { en: 'Help', ms: 'Bantuan', zh: '帮助', ta: 'உதவி' },
  'tab.me': { en: 'Me', ms: 'Saya', zh: '我', ta: 'நான்' },
  'title.neighbours': { en: 'Meet your neighbours', ms: 'Kenali jiran anda', zh: '认识邻居', ta: 'அயலவர்களைச் சந்தியுங்கள்' },
  'title.share': { en: 'Share, always free', ms: 'Kongsi, sentiasa percuma', zh: '分享，永远免费', ta: 'பகிர்வு, எப்போதும் இலவசம்' },
  'title.activities': { en: 'Community activities', ms: 'Aktiviti komuniti', zh: '社区活动', ta: 'சமூக நிகழ்வுகள்' },
  'title.help': { en: 'Neighbour help', ms: 'Bantuan jiran', zh: '邻里互助', ta: 'அயலவர் உதவி' },
  'title.me': { en: 'My profile', ms: 'Profil saya', zh: '我的资料', ta: 'என் சுயவிவரம்' },
  'call999': { en: 'Call 999', ms: 'Hubungi 999', zh: '拨打 999', ta: '999 அழைக்கவும்' },
  'notifications': { en: 'Notifications', ms: 'Pemberitahuan', zh: '通知', ta: 'அறிவிப்புகள்' },
};

export function translator(lang: string) {
  const l = (['en', 'ms', 'zh', 'ta'].includes(lang) ? lang : 'en') as 'en' | 'ms' | 'zh' | 'ta';
  return (key: string) => STRINGS[key]?.[l] ?? STRINGS[key]?.en ?? key;
}
