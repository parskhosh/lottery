export const T = {
  fa:{
    start:'شروع', pause:'توقف', stop:'ایست', reset:'بازنشانی', export:'خروجی',
    settings:'تنظیمات', tickets:'بلیت‌ها', analytics:'آمار'
  },
  en:{
    start:'Start', pause:'Pause', stop:'Stop', reset:'Reset', export:'Export',
    settings:'Settings', tickets:'Tickets', analytics:'Analytics'
  }
};
const FONTS = {
  fa:{family:"'Peyda','Vazirmatn',Tahoma,sans-serif"},
  en:{family:"'Roboto','Segoe UI',Arial,sans-serif"}
};
const LOCALE_KEY = 'lsim.locale';
const DIR_KEY = 'lsim.dir';

export function applyLang(lang){
  const next = T[lang] ? lang : 'fa';
  const dir = next==='fa'?'rtl':'ltr';
  document.documentElement.lang = next;
  document.documentElement.dir = dir;
  document.documentElement.style.setProperty('--font-body', FONTS[next].family);
  document.body.style.fontFamily = FONTS[next].family;
  document.querySelectorAll('[data-i18n]').forEach(el=>{
    const key = el.getAttribute('data-i18n');
    el.textContent = T[next][key] ?? key;
  });
  localStorage.setItem(LOCALE_KEY, next);
  localStorage.setItem(DIR_KEY, dir);
  document.documentElement.dispatchEvent(new CustomEvent('langchange', {detail:{lang:next, dir}}));
}

export function getStoredLang(){
  return localStorage.getItem(LOCALE_KEY) || 'fa';
}
