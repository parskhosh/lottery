const SETTINGS_KEY = 'lsim.settings';
const SESSION_KEY = 'lsim.sessions';

const defaultSettings = {
  batchSize:1000,
  uiDelay:10,
  limit:{kind:'none', value:1000},
  eco:{enabled:false, rateCap:2000},
  maxLogRows:50000,
  chartCap:2000,
  miniLogCap:800,
  cfg:{stopOnJackpot:false}
};

export function loadSettings(){
  try{
    const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY))||{};
    return {
      ...defaultSettings,
      ...stored,
      limit:{...defaultSettings.limit, ...(stored.limit||{})},
      eco:{...defaultSettings.eco, ...(stored.eco||{})},
      cfg:{...defaultSettings.cfg, ...(stored.cfg||{})}
    };
  }catch(err){
    console.error('loadSettings failed', err);
    return {...defaultSettings};
  }
}

export function saveSettings(settings){
  try{
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }catch(err){
    console.error('saveSettings failed', err);
  }
}

export function loadSessions(){
  try{
    return JSON.parse(localStorage.getItem(SESSION_KEY))||[];
  }catch(err){
    console.error('loadSessions failed', err);
    return [];
  }
}

export function saveSession(session){
  const sessions = loadSessions();
  sessions.unshift({...session, ts:Date.now()});
  localStorage.setItem(SESSION_KEY, JSON.stringify(sessions.slice(0,25)));
}

export function fmtDate(ts){
  return new Date(ts).toLocaleString();
}
