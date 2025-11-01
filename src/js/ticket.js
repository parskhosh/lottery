import {hook, toast, pulseTicket} from './ui.js';

const sets = { pinned:new Set(), preferred:new Set(), excluded:new Set() };
const grid = hook('ticket-grid');
const TICKET_SIZE = 5;
const maxN = 40;

function ensureGrid(){
  if(!grid || grid.childElementCount) return;
  for(let i=1;i<=maxN;i++){
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = i;
    btn.dataset.n = String(i);
    btn.addEventListener('click', e=>{
      e.preventDefault();
      cycle(btn);
    });
    grid.appendChild(btn);
  }
}

function cycle(btn){
  const n = Number(btn.dataset.n);
  if(sets.pinned.has(n)) toggle('preferred', n, TICKET_SIZE);
  else if(sets.preferred.has(n)) toggle('excluded', n, TICKET_SIZE);
  else if(sets.excluded.has(n)) clearNumber(n);
  else toggle('pinned', n, TICKET_SIZE);
}

function clearNumber(n){
  sets.pinned.delete(n);
  sets.preferred.delete(n);
  sets.excluded.delete(n);
  renderGridStates();
}

export function renderGridStates(){
  grid?.querySelectorAll('button').forEach(btn=>{
    const n = Number(btn.dataset.n);
    btn.classList.toggle('pinned', sets.pinned.has(n));
    btn.classList.toggle('preferred', sets.preferred.has(n));
    btn.classList.toggle('excluded', sets.excluded.has(n));
  });
}

export function toggle(kind, n, k=TICKET_SIZE){
  sets.pinned.delete(n); sets.preferred.delete(n); sets.excluded.delete(n);
  if(kind==='pinned'){
    if(sets.pinned.size>=k){
      toast(`You can pin at most k (${k}).`, {variant:'error', icon:'fa-triangle-exclamation'});
      return;
    }
    sets.pinned.add(n);
  }else if(kind==='preferred'){
    sets.preferred.add(n);
  }else if(kind==='excluded'){
    sets.excluded.add(n);
  }
  renderGridStates();
}

export function buildTicket(k=TICKET_SIZE){
  const {pinned, preferred, excluded} = sets;
  if(pinned.size>k) throw new Error('Pinned exceeds k');
  const ticket = [...pinned];
  const r = k - ticket.length;
  const universe = new Set(Array.from({length:maxN}, (_,i)=>i+1));
  excluded.forEach(x=>universe.delete(x));
  ticket.forEach(x=>universe.delete(x));
  const pool1 = [...preferred].filter(x=>universe.has(x));
  const pool2 = [...universe].filter(x=>!preferred.has(x));
  takeRandom(ticket, pool1, Math.min(r, pool1.length));
  if(ticket.length<k) takeRandom(ticket, pool2, k-ticket.length);
  return ticket.sort((a,b)=>a-b);
}

function takeRandom(out, arr, m){
  for(let i=0;i<m;i++){
    const j = i + Math.floor(Math.random()*(arr.length-i));
    [arr[i], arr[j]] = [arr[j], arr[i]];
    out.push(arr[i]);
  }
}

export function hydrateTicket(ticket){
  const label = hook('current-ticket');
  if(label) label.textContent = ticket.join(', ');
  ticket.forEach(n=>{
    const btn = grid?.querySelector(`button[data-n="${n}"]`);
    pulseTicket(btn);
  });
}

export function resetTicketPrefs(){
  sets.pinned.clear(); sets.preferred.clear(); sets.excluded.clear();
  renderGridStates();
}

export function exportSets(){
  return { pinned:[...sets.pinned], preferred:[...sets.preferred], excluded:[...sets.excluded] };
}

export function importSets(data){
  sets.pinned = new Set(data.pinned||[]);
  sets.preferred = new Set(data.preferred||[]);
  sets.excluded = new Set(data.excluded||[]);
  renderGridStates();
}

ensureGrid();
renderGridStates();
