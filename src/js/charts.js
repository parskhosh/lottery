import {hook} from './ui.js';

const charts = {
  pl:setupChart(hook('chart-pl')),
  roi:setupChart(hook('chart-roi')),
  daily:setupChart(hook('chart-daily')),
  hit:setupChart(hook('chart-hit'))
};

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

function drawBars(chart, color){
  const {ctx, canvas, data} = chart;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  const max = Math.max(...data,1);
  const w = canvas.width / (data.length||1);
  ctx.fillStyle = color;
  data.forEach((v,i)=>{
    const h = (v/max)*canvas.height;
    ctx.fillRect(i*w, canvas.height-h, w-2, h);
  });
}

export function pushPL(value){
  if(!charts.pl) return;
  charts.pl.data.push(value);
  if(charts.pl.data.length>400) charts.pl.data.shift();
  drawLine(charts.pl, '#06ffff');
}

export function pushROI(value){
  if(!charts.roi) return;
  charts.roi.data.push(value);
  if(charts.roi.data.length>400) charts.roi.data.shift();
  drawLine(charts.roi, '#6ea9ff');
}

export function pushDaily(value){
  if(!charts.daily) return;
  charts.daily.data.push(value);
  if(charts.daily.data.length>120) charts.daily.data.shift();
  drawBars(charts.daily, 'rgba(110,169,255,0.6)');
}

export function pushHit(index, value){
  if(!charts.hit) return;
  charts.hit.data[index] = value;
  drawBars(charts.hit, 'rgba(6,255,255,0.55)');
}

export function resetCharts(){
  Object.values(charts).forEach(chart=>{ if(chart){ chart.data.length = 0; chart.ctx.clearRect(0,0,chart.canvas.width,chart.canvas.height); }});
}
