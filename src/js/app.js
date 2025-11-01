import {bind, hook, setupTabs, updateStatusUI, toast, syncToggle} from './ui.js';
import {applyLang, getStoredLang} from './i18n.js';
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
let runState = RUN.IDLE;
let worker = null;
let workerBlobUrl = null;
document.documentElement.addEventListener('langchange', ()=>updateStatusUI(runState));
document.documentElement.addEventListener('ticketsetschange', e=>{
  if(e?.detail) postTicketSets(e.detail);
});
let lastStats = {tickets:0, days:1, jackpots:0, spent:0, paid:0, net:0, roi:0};
let settings = loadSettings();
let lastTicket = [];

function setState(s){ runState=s; updateStatusUI(s); }

function terminateWorker(){
  if(worker){
    try{ worker.terminate(); }
    catch(err){ console.warn('terminateWorker failed', err); }
  }
  worker = null;
  if(workerBlobUrl){
    URL.revokeObjectURL(workerBlobUrl);
    workerBlobUrl = null;
  }
}

async function ensureWorker(){
  if(worker && runState!==RUN.STOPPED) return worker;
  if(worker) terminateWorker();
  const scriptUrl = new URL('./worker.js', import.meta.url);
  let instance = null;
  try{
    const res = await fetch(scriptUrl);
    if(!res.ok) throw new Error(`Worker fetch failed: ${res.status}`);
    const blob = new Blob([await res.text()], {type:'text/javascript'});
    workerBlobUrl = URL.createObjectURL(blob);
    instance = new Worker(workerBlobUrl);
  }catch(err){
    console.warn('Falling back to module worker', err);
    try{
      instance = new Worker(scriptUrl, {type:'module'});
    }catch(inner){
      console.error('Module worker fallback failed', inner);
      throw inner;
    }
  }
  worker = instance;
  worker.onmessage = ({data})=>{
    if(data?.t==='state'){
      const next = data.running?RUN.RUNNING:(data.paused?RUN.PAUSED:RUN.IDLE);
      const prev = runState;
      setState(next);
      if(prev===RUN.RUNNING && (next===RUN.IDLE || next===RUN.STOPPED)){
        finalizeSession();
        terminateWorker();
      }
    }
    if(data?.t==='tick')  applyBatch(data);
    if(data?.t==='reset') hydrateStats(data.stats);
  };
  worker.onerror = err=>console.error('Worker error', err);
  worker.onmessageerror = err=>console.error('Worker message error', err);
  postSettings();
  postCfg();
  postTicketSets();
  return worker;
}

function postSettings(){
  worker?.postMessage({t:'settings', settings});
}

function postCfg(){
  worker?.postMessage({t:'cfg', cfg:{...settings.cfg}, eco:{...settings.eco}, hidden:document.hidden});
}

function postTicketSets(payload){
  const data = payload || exportSets();
  worker?.postMessage({t:'ticket-sets', sets:data});
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
      pushHit(Math.min(row.matches,6), row.prize/100);
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
  pushDaily((batch.delta.paid - batch.delta.spent)/100);
}

function clearStatsAndLogs(){
  lastStats = {tickets:0, days:1, jackpots:0, spent:0, paid:0, net:0, roi:0};
  clearLogs();
  hydrateStats(lastStats);
  resetCharts();
  const ticketLabel = hook('current-ticket');
  const drawLabel = hook('current-draw');
  if(ticketLabel) ticketLabel.textContent = '—';
  if(drawLabel) drawLabel.textContent = '—';
}

bind('btn-start','click', async e=>{
  e.preventDefault();
  if(settings.limit.kind==='none' && lastStats.tickets===0){
    const proceed = typeof confirm==='function' ? confirm('No limit set. Continue?') : true;
    if(!proceed) return;
  }
  try{
    const w = await ensureWorker();
    postSettings();
    postCfg();
    postTicketSets();
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
  terminateWorker();
});

bind('btn-reset','click', e=>{
  e.preventDefault();
  worker?.postMessage({t:'reset'});
  clearStatsAndLogs();
  lastTicket = [];
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
    postSettings();
    postCfg();
  });
  ecoToggle.addEventListener('keydown', evt=>{
    if(evt.key===' ' || evt.key==='Spacebar' || evt.key==='Enter'){
      evt.preventDefault();
      ecoToggle.click();
    }
  });
}

document.addEventListener('visibilitychange', ()=>{
  postCfg();
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
    postSettings();
  });
}
if(inputs.delay){
  inputs.delay.value = settings.uiDelay;
  inputs.delay.addEventListener('change', ()=>{
    settings.uiDelay = clamp(Number(inputs.delay.value),1,100);
    inputs.delay.value = settings.uiDelay;
    saveSettings(settings);
    postSettings();
  });
}
if(inputs.limitKind){
  inputs.limitKind.value = settings.limit.kind || 'none';
  inputs.limitKind.addEventListener('change', ()=>{
    settings.limit.kind = inputs.limitKind.value;
    saveSettings(settings);
    postSettings();
  });
}
if(inputs.limitValue){
  inputs.limitValue.value = settings.limit.value;
  inputs.limitValue.addEventListener('change', ()=>{
    settings.limit.value = Number(inputs.limitValue.value)||0;
    saveSettings(settings);
    postSettings();
  });
}

syncToggle(ecoToggle, settings.eco.enabled);

function clamp(v,min,max){
  if(!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

function finalizeSession(){
  if(!lastStats.tickets) return;
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
  const initialTheme = localStorage.getItem('theme')||'dark';
  document.documentElement.setAttribute('data-theme', initialTheme);
  document.documentElement.dispatchEvent(new CustomEvent('themechange', {detail:{theme:initialTheme}}));
  applyLang(getStoredLang());
  setupTabs();
  bindLogFilters();
  renderLogs();
  renderSessions();
  clearStatsAndLogs();
  updateStatusUI(runState);
}

window.addEventListener('beforeunload', ()=>{
  if(runState===RUN.RUNNING) finalizeSession();
  terminateWorker();
});

bootstrap();

export {ensureWorker, setState, RUN};
