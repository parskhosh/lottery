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
export function applyLang(lang){
  const next = T[lang] ? lang : 'fa';
  document.documentElement.lang = next;
  document.documentElement.dir = next==='fa'?'rtl':'ltr';
  document.documentElement.style.setProperty('--font-body', FONTS[next].family);
  document.body.style.fontFamily = FONTS[next].family;
  document.querySelectorAll('[data-i18n]').forEach(el=>{
    const key = el.getAttribute('data-i18n');
    el.textContent = T[next][key] ?? key;
  });
  localStorage.setItem('lang', next);
}
