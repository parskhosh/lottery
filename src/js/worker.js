const RUN = {IDLE:'idle', RUNNING:'running', PAUSED:'paused', STOPPED:'stopped'};
let running = false;
let paused = false;
let hidden = false;
let settings = {
  batchSize:1000,
  uiDelay:10,
  limit:{kind:'none', value:10000},
  eco:{enabled:false, rateCap:2000},
  cfg:{stopOnJackpot:false}
};
let stats = baseStats();
let idx = 0;
let day = 1;
let matchesDist = Array(7).fill(0);

let target = createTarget();

onmessage = async e=>{
  const {t} = e.data||{};
  if(t==='start') start();
  else if(t==='pause') pause();
  else if(t==='stop') stop();
  else if(t==='reset') reset();
  else if(t==='settings'){ settings = {...settings, ...e.data.settings}; }
  else if(t==='target'){ target = e.data.target || createTarget(); }
  else if(t==='cfg'){ hidden = !!e.data.hidden; settings.cfg = {...settings.cfg, ...e.data.cfg}; }
};

function baseStats(){
  return {tickets:0, days:1, jackpots:0, spent:0, paid:0};
}

function createTarget(){
  return generateTicket(5, 40);
}

function start(){
  if(running){ paused=false; postState(); return; }
  running = true;
  paused = false;
  loop();
  postState();
}

function pause(){
  paused = true;
  postState();
}

function stop(){
  running = false;
  paused = false;
  postState();
}

function reset(){
  stats = baseStats();
  idx = 0;
  day = 1;
  matchesDist = Array(7).fill(0);
  postMessage({t:'reset', stats:{...stats, net:0, roi:0}});
}

async function loop(){
  while(running){
    if(paused){
      await sleep(120);
      continue;
    }
    const batch = createBatch();
    if(!batch.rows.length){
      await sleep(settings.uiDelay);
      continue;
    }
    postMessage({t:'tick', ...batch});
    if(checkLimit()){
      running = false;
      postState();
      break;
    }
    await sleep(settings.uiDelay + (hidden && settings.eco.enabled ? 35 : 0));
  }
}

function createBatch(){
  const rows = [];
  const start = performance.now();
  const size = Math.max(1, Math.min(settings.batchSize||1000, 10000));
  for(let i=0;i<size;i++){
    idx++;
    const ticket = generateTicket(5, 40);
    const result = evaluate(ticket);
    rows.push({...result, idx, day, time:Date.now(), type:'ticket', ticket});
    stats.tickets++;
    stats.spent += result.cost;
    stats.paid += result.prize;
    if(result.matches===5 && result.bonus) stats.jackpots++;
    matchesDist[result.matches] = (matchesDist[result.matches]||0)+1;
    if(idx % settings.batchSize === 0){
      day++;
      stats.days = day;
      target = createTarget();
      if(settings.cfg.stopOnJackpot && stats.jackpots>0){
        running = false; break;
      }
    }
  }
  const duration = performance.now()-start;
  const rate = Math.round(rows.length / (duration/1000||1));
  const net = stats.paid - stats.spent;
  const roi = stats.spent? (stats.paid/stats.spent)*100 : 0;
  return {rows, stats:{...stats, net, roi}, delta:{paid:rows.reduce((a,b)=>a+b.prize,0), spent:rows.reduce((a,b)=>a+b.cost,0)}, rate, target:[...target], matches:[...matchesDist]};
}

function evaluate(ticket){
  const matches = ticket.filter(n=>target.includes(n)).length;
  const bonus = Math.random() < 0.1;
  const prize = payout(matches, bonus);
  const cost = 200;
  if(bonus && matches===5 && settings.cfg.stopOnJackpot){ running=false; }
  return {matches, bonus, prize, cost};
}

function payout(matches, bonus){
  if(matches===5 && bonus) return 10000000;
  if(matches===5) return 50000;
  if(matches===4 && bonus) return 5000;
  if(matches===4) return 800;
  if(matches===3 && bonus) return 80;
  if(matches===3) return 20;
  if(matches===2 && bonus) return 10;
  return bonus?5:0;
}

function generateTicket(k, max){
  const pool = new Set();
  while(pool.size<k){
    pool.add(rand(max));
  }
  return [...pool].sort((a,b)=>a-b);
}

function rand(max){
  if(self.crypto?.getRandomValues){
    const arr = new Uint32Array(1);
    self.crypto.getRandomValues(arr);
    return (arr[0] % max)+1;
  }
  return Math.floor(mulberry32(Date.now())()*max)+1;
}

function mulberry32(a){
  return function(){
    var t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

function sleep(ms){
  return new Promise(res=>setTimeout(res, ms));
}

function postState(){
  postMessage({t:'state', running, paused});
}

function checkLimit(){
  if(!settings.limit || settings.limit.kind==='none') return false;
  if(settings.limit.kind==='tickets' && stats.tickets>=settings.limit.value) return true;
  if(settings.limit.kind==='minutes' && stats.tickets>0){
    const minutes = (idx*settings.uiDelay)/(1000*60);
    return minutes >= settings.limit.value;
  }
  if(settings.limit.kind==='days' && stats.days>=settings.limit.value) return true;
  return false;
}
