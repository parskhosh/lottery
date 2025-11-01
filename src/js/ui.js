import {applyLang, getStoredLang} from './i18n.js';

export const $ = s => document.querySelector(s);
export const hook = k => document.querySelector(`[data-hook="${k}"]`);
export function bind(k, evt, fn){
  const el = hook(k);
  console.assert(!!el, 'Missing hook:', k);
  if(!el) return;
  el.addEventListener(evt, fn, {passive:false});
  window.diag?.(`bind:${k}`, evt);
}

const TAB_KEY = 'lsim.tab';
const toastContainer = hook('toast-container');
let toastId = 0;
export function toast(message, opts={}){
  if(!toastContainer) return;
  const id = ++toastId;
  const el = document.createElement('div');
  el.className = `toast ${opts.variant||''}`.trim();
  el.dataset.id = id;
  el.innerHTML = `<span class="icon"><i class="fa fa-solid ${opts.icon||'fa-circle-info'}"></i></span><span>${message}</span>`;
  toastContainer.appendChild(el);
  setTimeout(()=>{
    el.classList.add('fade-out');
    el.style.opacity = '0';
    setTimeout(()=>el.remove(), 320);
  }, opts.duration||3200);
}

export function toggleTheme(){
  const html = document.documentElement;
  const next = html.getAttribute('data-theme')==='dark'?'light':'dark';
  html.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  html.dispatchEvent(new CustomEvent('themechange', {detail:{theme:next}}));
}

bind('toggle-theme','click', e=>{e.preventDefault();toggleTheme();});
bind('toggle-lang','click', e=>{
  e.preventDefault();
  const current = getStoredLang();
  const next = current==='fa'?'en':'fa';
  applyLang(next);
});

export function setupTabs(){
  const buttons = Array.from(document.querySelectorAll('[data-tab]'));
  if(!buttons.length) return;
  const saved = localStorage.getItem(TAB_KEY);
  const initial = buttons.find(btn=>btn.getAttribute('data-tab')===saved) || buttons[0];
  activateTab(initial.getAttribute('data-tab'));
  buttons.forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const to = btn.getAttribute('data-tab');
      activateTab(to);
    }, {once:false});
  });
}

function activateTab(name){
  if(!name) return;
  document.querySelectorAll('[data-panel]').forEach(p=>{
    p.hidden = p.getAttribute('data-panel')!==name;
  });
  document.querySelectorAll('[data-tab]').forEach(t=>{
    t.classList.toggle('active', t.getAttribute('data-tab')===name);
  });
  localStorage.setItem(TAB_KEY, name);
}

export function updateStatusUI(state){
  const label = hook('status-label');
  if(!label) return;
  const lang = getStoredLang();
  const map = {
    idle:{fa:'آماده', en:'Idle'},
    running:{fa:'در حال اجرا', en:'Running'},
    paused:{fa:'مکث', en:'Paused'},
    stopped:{fa:'متوقف', en:'Stopped'}
  };
  label.textContent = map[state]?.[lang] || state;
}

export function pulseTicket(el){
  if(!el) return;
  el.classList.remove('ticket-active');
  void el.offsetWidth;
  el.classList.add('ticket-active');
}

export function tooltip(target, text){
  const tip = document.createElement('div');
  tip.className = 'tooltip';
  tip.textContent = text;
  document.body.appendChild(tip);
  const rect = target.getBoundingClientRect();
  tip.style.left = `${rect.left + rect.width/2 - tip.offsetWidth/2}px`;
  tip.style.top = `${rect.top - rect.height}px`;
  requestAnimationFrame(()=>tip.setAttribute('data-show',''));
  setTimeout(()=>{
    tip.removeAttribute('data-show');
    setTimeout(()=>tip.remove(),200);
  }, 2600);
}

export function syncToggle(el, value){
  if(!el) return;
  el.dataset.on = value?'true':'false';
  el.setAttribute('aria-checked', value?'true':'false');
}
