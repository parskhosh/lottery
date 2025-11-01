import {hook} from './ui.js';
import {fmtBase} from './currency.js';

class RingBuffer{
  constructor(cap){
    this.cap = cap;
    this.data = [];
    this.start = 0;
  }
  push(item){
    if(this.data.length < this.cap){
      this.data.push(item);
    }else{
      this.data[this.start] = item;
      this.start = (this.start + 1) % this.cap;
    }
  }
  toArray(){
    if(this.data.length < this.cap) return [...this.data];
    return [...this.data.slice(this.start), ...this.data.slice(0, this.start)];
  }
  clear(){
    this.data = [];
    this.start = 0;
  }
}

const viewport = hook('log-viewport');
const virtual = hook('log-virtual');
const winsViewport = hook('wins-viewport');
const winsVirtual = hook('wins-virtual');

export const logs = new RingBuffer(5000);
export const wins = new RingBuffer(1000);

let filter = {search:'', min:null, max:null, winsOnly:false};

export function setFilter(partial){
  filter = {...filter, ...partial};
  renderLogs();
}

function passes(row){
  if(filter.winsOnly && !(row.prize>0)) return false;
  if(filter.min!=null && row.prize<filter.min) return false;
  if(filter.max!=null && row.prize>filter.max) return false;
  if(filter.search){
    const str = `${row.matches}-${row.bonus}-${row.prize}-${row.idx}`;
    if(!str.toLowerCase().includes(filter.search.toLowerCase())) return false;
  }
  return true;
}

export function pushLog(row){
  logs.push(row);
  if(row.prize>0) wins.push(row);
}

export function clearLogs(){
  logs.clear();
  wins.clear();
  renderLogs();
}

function renderVirtual(list, container){
  if(!container) return;
  const data = list.toArray().filter(passes);
  const chunk = data.slice(-400); // virtual window
  container.innerHTML = chunk.map(row=>{
    const prize = fmtBase(row.prize||0);
    const cost = fmtBase(row.cost||0);
    return `<div class="log-row" data-idx="${row.idx}"><strong>#${row.idx}</strong> — matches ${row.matches}${row.bonus?'+B':''} — prize ${prize} — cost ${cost}</div>`;
  }).join('');
}

export function renderLogs(){
  renderVirtual(logs, virtual);
  renderVirtual(wins, winsVirtual);
}

export function bindLogFilters(){
  const search = hook('log-search');
  const min = hook('log-min');
  const max = hook('log-max');
  const winsOnly = hook('log-wins-only');
  search?.addEventListener('input', ()=>setFilter({search:search.value}));
  min?.addEventListener('input', ()=>setFilter({min:searchNumber(min.value)}));
  max?.addEventListener('input', ()=>setFilter({max:searchNumber(max.value)}));
  winsOnly?.addEventListener('change', ()=>setFilter({winsOnly:winsOnly.checked}));
}

function searchNumber(v){
  const n = Number(v);
  return Number.isFinite(n)?n:null;
}
