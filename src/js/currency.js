const currencyKey = 'lsim.currency';
const defaultCurrency = {code:'USD', minorPerMajor:100, symbol:'$'};

export function loadCurrency(){
  try{ return JSON.parse(localStorage.getItem(currencyKey)) || defaultCurrency; }
  catch(err){ console.error('loadCurrency', err); return defaultCurrency; }
}

export function saveCurrency(cur){
  localStorage.setItem(currencyKey, JSON.stringify(cur));
}

const currency = loadCurrency();

export function fmtBase(minor){
  const {minorPerMajor, symbol} = currency;
  const major = minor / minorPerMajor;
  return `${symbol}${major.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`;
}

export function fmtDual(minor){
  return `${fmtBase(minor)} / ${minor} minor`;
}

export function toMinor(value){
  return Math.round(Number(value||0) * currency.minorPerMajor);
}
