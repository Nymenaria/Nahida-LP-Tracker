require('dotenv').config();

const REGION_TO_CLUSTER = {
  euw1: 'europe', eun1: 'europe', tr1: 'europe', ru: 'europe',
  na1: 'americas', br1: 'americas', la1: 'americas', la2: 'americas',
  kr: 'asia', jp1: 'asia', oc1: 'sea'
};

const rateLimiter = {
  shortWindow: [],
  longWindow: [],
  SHORT_LIMIT: 20,
  SHORT_MS: 1000,
  LONG_LIMIT: 100,
  LONG_MS: 120000,

  cleanup() {
    const now = Date.now();
    this.shortWindow = this.shortWindow.filter(t => now - t < this.SHORT_MS);
    this.longWindow  = this.longWindow.filter(t => now - t < this.LONG_MS);
  },

  async acquire() {
    while (true) {
      this.cleanup();
      if (this.shortWindow.length < this.SHORT_LIMIT && this.longWindow.length < this.LONG_LIMIT) {
        const now = Date.now();
        this.shortWindow.push(now);
        this.longWindow.push(now);
        return;
      }
      let wait = 50;
      if (this.shortWindow.length >= this.SHORT_LIMIT) {
        wait = Math.max(wait, this.SHORT_MS - (Date.now() - this.shortWindow[0]) + 5);
      }
      if (this.longWindow.length >= this.LONG_LIMIT) {
        wait = Math.max(wait, this.LONG_MS - (Date.now() - this.longWindow[0]) + 5);
      }
      await new Promise(r => setTimeout(r, wait));
    }
  },

  status() {
    this.cleanup();
    return { short: this.shortWindow.length, long: this.longWindow.length };
  }
};

async function fetchRiotWithRateLimit(url) {
  await rateLimiter.acquire();
  const response = await fetch(url, { headers: { 'X-Riot-Token': process.env.RIOT_API_KEY } });

  const s = rateLimiter.status();
  const endpoint = (url.split('.com')[1] || '').substring(0, 80);
  console.log(`📊 Riot API [${s.short}/${rateLimiter.SHORT_LIMIT} req/s | ${s.long}/${rateLimiter.LONG_LIMIT} req/2min] → ${response.status} ${endpoint}`);

  if (!response.ok) throw new Error(`Riot API Error: ${response.status}`);
  return response.json();
}

async function getAccountData(gameName, tagLine, region) {
  const cluster = REGION_TO_CLUSTER[region] || 'europe';
  return await fetchRiotWithRateLimit(`https://${cluster}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`);
}

async function getAccountByPuuid(puuid, region) {
  const cluster = REGION_TO_CLUSTER[region] || 'europe';
  return await fetchRiotWithRateLimit(`https://${cluster}.api.riotgames.com/riot/account/v1/accounts/by-puuid/${puuid}`);
}

async function getSoloQueueData(puuid, region) {
  const leagues = await fetchRiotWithRateLimit(`https://${region}.api.riotgames.com/lol/league/v4/entries/by-puuid/${puuid}`);
  return leagues.find(entry => entry.queueType === 'RANKED_SOLO_5x5') || null;
}

async function getSummonerData(puuid, region) {
  return await fetchRiotWithRateLimit(`https://${region}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`);
}

module.exports = { getAccountData, getAccountByPuuid, getSoloQueueData, getSummonerData };