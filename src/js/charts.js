import {hook} from './ui.js';

const charts = {
  pl:setupChart(hook('chart-pl')),
  roi:setupChart(hook('chart-roi')),
  daily:setupChart(hook('chart-daily')),
  hit:setupChart(hook('chart-hit'))
};

const palette = {
  primary:'#06ffff',
  secondary:'#6ea9ff',
  accent:'#6ea9ff',
  success:'#06ffff'
};

refreshPalette();
document.documentElement.addEventListener('themechange', ()=>{
  refreshPalette();
  redrawAll();
});

function setupChart(canvas){
  if(!canvas) return null;
  const ctx = canvas.getContext('2d');
  const data = [];
  return {canvas, ctx, data};
}

function drawLine(chart, color){
  const {ctx, canvas, data} = chart;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  if(!data.length) return;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max-min || 1;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  data.forEach((v,i)=>{
    const x = (i/(data.length-1||1))*canvas.width;
    const y = canvas.height - ((v-min)/range)*canvas.height;
    i?ctx.lineTo(x,y):ctx.moveTo(x,y);
  });
  ctx.stroke();
}

function drawBars(chart, color, alpha=1){
  const {ctx, canvas, data} = chart;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  const max = Math.max(...data,1);
  const w = canvas.width / (data.length||1);
  ctx.fillStyle = withAlpha(color, alpha);
  data.forEach((v,i)=>{
    const h = (v/max)*canvas.height;
    ctx.fillRect(i*w, canvas.height-h, w-2, h);
  });
}

export function pushPL(value){
  if(!charts.pl) return;
  charts.pl.data.push(value);
  if(charts.pl.data.length>400) charts.pl.data.shift();
  drawLine(charts.pl, palette.primary);
}

export function pushROI(value){
  if(!charts.roi) return;
  charts.roi.data.push(value);
  if(charts.roi.data.length>400) charts.roi.data.shift();
  drawLine(charts.roi, palette.secondary);
}

export function pushDaily(value){
  if(!charts.daily) return;
  charts.daily.data.push(value);
  if(charts.daily.data.length>120) charts.daily.data.shift();
  drawBars(charts.daily, palette.secondary, 0.55);
}

export function pushHit(index, value){
  if(!charts.hit) return;
  if(!Number.isFinite(index)) return;
  while(charts.hit.data.length<=index){
    charts.hit.data.push(0);
  }
  charts.hit.data[index] = value;
  drawBars(charts.hit, palette.primary, 0.5);
}

export function resetCharts(){
  Object.values(charts).forEach(chart=>{
    if(chart){
      chart.data.length = 0;
      chart.ctx.clearRect(0,0,chart.canvas.width,chart.canvas.height);
    }
  });
}

function refreshPalette(){
  palette.primary = readToken('--primary', palette.primary);
  palette.secondary = readToken('--secondary', palette.secondary);
  palette.accent = readToken('--muted', palette.accent);
  palette.success = readToken('--primary', palette.success);
}

function redrawAll(){
  if(charts.pl) drawLine(charts.pl, palette.primary);
  if(charts.roi) drawLine(charts.roi, palette.secondary);
  if(charts.daily) drawBars(charts.daily, palette.secondary, 0.55);
  if(charts.hit) drawBars(charts.hit, palette.primary, 0.5);
}

function readToken(name, fallback){
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function withAlpha(color, alpha){
  const v = color.trim();
  if(v.startsWith('#')){
    const hex = v.replace('#','');
    const normalized = hex.length===3 ? hex.split('').map(c=>c+c).join('') : hex.slice(0,6);
    const r = parseInt(normalized.slice(0,2),16);
    const g = parseInt(normalized.slice(2,4),16);
    const b = parseInt(normalized.slice(4,6),16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  if(v.startsWith('rgba(')){
    return v.replace(/rgba\(([^)]+)\)/, (_,inner)=>{
      const parts = inner.split(',').slice(0,3).map(p=>p.trim());
      return `rgba(${parts.join(',')},${alpha})`;
    });
  }
  if(v.startsWith('rgb(')){
    return v.replace('rgb','rgba').replace(')',`,${alpha})`);
  }
  return v;
}
