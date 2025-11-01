import {bind, hook, setupTabs, updateStatusUI, toast, syncToggle} from './ui.js';
import {applyLang} from './i18n.js';
import {loadSettings, saveSettings, loadSessions, saveSession, fmtDate} from './state.js';
import {buildTicket, hydrateTicket, resetTicketPrefs, exportSets} from './ticket.js';
import {pushPL, pushROI, pushDaily, pushHit, resetCharts} from './charts.js';
import {wins, pushLog, renderLogs, bindLogFilters, clearLogs} from './logs.js';
import {exportCSVChunked} from './csv.js';
import {fmtBase, fmtDual} from './currency.js';

window.diag = (label, detail)=>console.log('%c[APP]','color:#6EA9FF', label, detail||'');
window.onerror = (m,src,ln,col,err)=>console.error('GlobalError:',m,src,ln,col,err);
window.onunhandledrejection = e=>console.error('UnhandledPromise:', e.reason);

const RUN = { IDLE:'idle', RUNNING:'running', PAUSED:'paused', STOPPED:'stopped' };
let runState = RUN.IDLE, worker=null;
let lastStats = {tickets:0, days:1, jackpots:0, spent:0, paid:0, net:0, roi:0};
let settings = loadSettings();
let lastTicket = [];

function setState(s){ runState=s; updateStatusUI(s); }

async function ensureWorker(){
  if(worker && runState!==RUN.STOPPED) return worker;
  const res = await fetch('./js/worker.js');
  const blob = new Blob([await res.text()], {type:'text/javascript'});
  worker = new Worker(URL.createObjectURL(blob));
  worker.onmessage = ({data})=>{
    if(data?.t==='state') setState(data.running?RUN.RUNNING:(data.paused?RUN.PAUSED:RUN.IDLE));
    if(data?.t==='tick')  applyBatch(data);
    if(data?.t==='reset') hydrateStats(data.stats);
  };
  worker.onerror = err=>console.error('Worker error', err);
  return worker;
}

function hydrateStats(stats){
  const net = stats.paid - stats.spent;
  const roi = stats.spent? (stats.paid/stats.spent)*100 : 0;
  const computed = {...stats, net, roi};
  lastStats = {...lastStats, ...computed};
  hook('stat-tickets').textContent = computed.tickets;
  hook('stat-days').textContent = computed.days;
  hook('stat-jackpots').textContent = computed.jackpots;
  hook('stat-spent').textContent = fmtBase(computed.spent);
  hook('stat-paid').textContent = fmtBase(computed.paid);
  hook('stat-net').textContent = fmtDual(net);
  hook('stat-roi').textContent = `${roi.toFixed(2)}%`;
  hook('stat-rate').textContent = computed.rate?`${computed.rate}/s`:'0/s';
  hook('stat-hit').textContent = wins.toArray().length;
}

function applyBatch(batch){
  hydrateStats({...batch.stats, rate:batch.rate});
  batch.rows.forEach(row=>{
    pushLog(row);
    if(row.prize>0){
      pushHit(Math.min(row.matches,6), row.prize);
    }
    if(row.ticket){
      hook('current-ticket').textContent = row.ticket.join(', ');
    }
  });
  renderLogs();
  if(batch.target){
    hook('current-draw').textContent = batch.target.join(', ');
  }
  const net = batch.stats.paid - batch.stats.spent;
  pushPL(net/100);
  const roi = batch.stats.spent? (batch.stats.paid/batch.stats.spent)*100 : 0;
  pushROI(roi);
  pushDaily(batch.delta.paid - batch.delta.spent);
}

function clearStatsAndLogs(){
  lastStats = {tickets:0, days:1, jackpots:0, spent:0, paid:0, net:0, roi:0};
  hydrateStats(lastStats);
  clearLogs();
  resetCharts();
}

bind('btn-start','click', async e=>{
  e.preventDefault();
  if(settings.limit.kind==='none' && lastStats.tickets===0){
    const proceed = confirm('No limit set. Continue?');
    if(!proceed) return;
  }
  try{
    const w = await ensureWorker();
    w.postMessage({t:'settings', settings});
    w.postMessage({t:'start'});
    setState(RUN.RUNNING);
    toast('Simulation started',{variant:'success',icon:'fa-circle-check'});
  }catch(err){ console.error(err); toast('Start failed',{variant:'error'}); }
});

bind('btn-pause','click', e=>{
  e.preventDefault();
  if(runState!==RUN.RUNNING) return;
  worker?.postMessage({t:'pause'}); setState(RUN.PAUSED);
});

bind('btn-stop','click', e=>{
  e.preventDefault();
  if(!worker) return;
  worker?.postMessage({t:'stop'}); setState(RUN.STOPPED);
  finalizeSession();
});

bind('btn-reset','click', e=>{
  e.preventDefault();
  worker?.postMessage({t:'reset'});
  clearStatsAndLogs();
  toast('Stats reset');
});

bind('btn-export','click', e=>{ e.preventDefault(); exportCSVChunked(); });

bind('quick-pick','click', e=>{
  e.preventDefault();
  try{
    lastTicket = buildTicket();
    hydrateTicket(lastTicket);
  }catch(err){ toast(err.message, {variant:'error'}); }
});

bind('clear-prefs','click', e=>{ e.preventDefault(); resetTicketPrefs(); });

const ecoToggle = hook('toggle-eco');
if(ecoToggle){
  ecoToggle.addEventListener('click', ()=>{
    settings.eco.enabled = !settings.eco.enabled;
    syncToggle(ecoToggle, settings.eco.enabled);
    saveSettings(settings);
    worker?.postMessage({t:'cfg', cfg:{stopOnJackpot:settings.cfg.stopOnJackpot}, hidden:document.hidden});
  });
}

document.addEventListener('visibilitychange', ()=>{
  worker?.postMessage({t:'cfg', hidden:document.hidden, cfg:{}});
});

const inputs = {
  batch: hook('input-batch'),
  delay: hook('input-delay'),
  limitKind: hook('select-limit-kind'),
  limitValue: hook('input-limit-value')
};

if(inputs.batch){
  inputs.batch.value = settings.batchSize;
  inputs.batch.addEventListener('change', ()=>{
    settings.batchSize = clamp(Number(inputs.batch.value),100,10000);
    inputs.batch.value = settings.batchSize;
    saveSettings(settings);
  });
}
if(inputs.delay){
  inputs.delay.value = settings.uiDelay;
  inputs.delay.addEventListener('change', ()=>{
    settings.uiDelay = clamp(Number(inputs.delay.value),1,100);
    inputs.delay.value = settings.uiDelay;
    saveSettings(settings);
  });
}
if(inputs.limitKind){
  inputs.limitKind.value = settings.limit.kind || 'none';
  inputs.limitKind.addEventListener('change', ()=>{
    settings.limit.kind = inputs.limitKind.value;
    saveSettings(settings);
  });
}
if(inputs.limitValue){
  inputs.limitValue.value = settings.limit.value;
  inputs.limitValue.addEventListener('change', ()=>{
    settings.limit.value = Number(inputs.limitValue.value)||0;
    saveSettings(settings);
  });
}

syncToggle(ecoToggle, settings.eco.enabled);

function clamp(v,min,max){
  if(!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

function finalizeSession(){
  saveSession({stats:lastStats, ticket:lastTicket, sets:exportSets()});
  renderSessions();
}

function renderSessions(){
  const list = hook('session-list');
  if(!list) return;
  const sessions = loadSessions();
  list.innerHTML = sessions.map(s=>`<li class="card" style="padding:12px"><div><strong>${fmtDate(s.ts)}</strong></div><div>Tickets: ${s.stats?.tickets||0}</div><div>Net: ${fmtBase((s.stats?.paid||0)-(s.stats?.spent||0))}</div></li>`).join('');
}

function bootstrap(){
  document.documentElement.setAttribute('data-theme', localStorage.getItem('theme')||'dark');
  applyLang(localStorage.getItem('lang')||'fa');
  setupTabs();
  bindLogFilters();
  renderLogs();
  renderSessions();
  clearStatsAndLogs();
}

window.addEventListener('beforeunload', ()=>{
  if(runState===RUN.RUNNING) finalizeSession();
});

bootstrap();

export {ensureWorker, setState, RUN};
