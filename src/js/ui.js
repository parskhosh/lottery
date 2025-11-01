import {applyLang} from './i18n.js';

export const $ = s => document.querySelector(s);
export const hook = k => document.querySelector(`[data-hook="${k}"]`);
export function bind(k, evt, fn){
  const el = hook(k);
  console.assert(!!el, 'Missing hook:', k);
  if(!el) return;
  el.addEventListener(evt, fn, {passive:false});
  window.diag?.(`bind:${k}`, evt);
}

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
}

bind('toggle-theme','click', e=>{e.preventDefault();toggleTheme();});
bind('toggle-lang','click', e=>{
  e.preventDefault();
  const current = localStorage.getItem('lang') || 'fa';
  const next = current==='fa'?'en':'fa';
  applyLang(next);
});

export function setupTabs(){
  document.querySelectorAll('[data-tab]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const to = btn.getAttribute('data-tab');
      document.querySelectorAll('[data-panel]').forEach(p=>{
        p.hidden = p.getAttribute('data-panel')!==to;
      });
      document.querySelectorAll('[data-tab]').forEach(t=>{
        t.classList.toggle('active', t===btn);
      });
    }, {once:false});
  });
}

export function updateStatusUI(state){
  const label = hook('status-label');
  if(label) label.textContent = state;
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
}
