import {logs} from './logs.js';

export async function exportCSVChunked(){
  const rows = logs.toArray();
  if(!rows.length){
    download('tickets.csv', 'idx,matches,bonus,prize,cost,day,time\n');
    return;
  }
  const encoder = new TextEncoder();
  const stream = [];
  stream.push(encoder.encode('idx,matches,bonus,prize,cost,day,time\n'));
  for(const row of rows){
    const line = `${row.idx},${row.matches},${row.bonus||0},${row.prize},${row.cost},${row.day},${row.time}\n`;
    stream.push(encoder.encode(line));
    if(stream.length>500){
      await microtask();
    }
  }
  const blob = new Blob(stream, {type:'text/csv'});
  download('tickets.csv', blob);
}

function download(name, content){
  const blob = content instanceof Blob ? content : new Blob([content],{type:'text/csv'});
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = name;
  link.click();
  setTimeout(()=>URL.revokeObjectURL(link.href), 2000);
}

function microtask(){
  return new Promise(requestAnimationFrame);
}
