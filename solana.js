// Solana donation watcher. No wallet-adapter, no dependencies: raw JSON-RPC
// polling against a public endpoint. Detects incoming transfers to WALLET_ADDRESS
// and forwards (amount, sender) to Game.onDonation.

// Multiple endpoints per network; the watcher rotates on rate-limit/failure so a
// single flaky public RPC can't make it miss a donation.
const RPC = {
  devnet: ['https://api.devnet.solana.com'],
  mainnet: ['https://solana-rpc.publicnode.com', 'https://api.mainnet-beta.solana.com'],
};

const CONFIG = {
  // The cat's vanity wallet. Same address on every network.
  WALLET_ADDRESS: 'C4t3XdZB36eHU11PK9QGtVgNPrKDDfkwvEHSAGwM64tT',
  // Flip to 'mainnet' to accept real SOL. 'devnet' is for free e2e testing.
  NETWORK: 'mainnet',
  get RPC_URLS() { return RPC[this.NETWORK]; },
  get RPC_URL() { return RPC[this.NETWORK][0]; }, // primary, for display
  POLL_MS: 8000,
  MIN_SOL: 0.001, // ignore dust below this
};

const LAMPORTS_PER_SOL = 1e9;
const SEEN_KEY = 'tamasol_seen_sigs';

let seen = new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'));
let firstPoll = true;

// Try each endpoint in turn; only throw if all of them fail.
async function rpc(method, params) {
  let lastErr;
  for (const url of CONFIG.RPC_URLS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      });
      if (res.status === 429) { lastErr = new Error('RPC 429'); continue; }
      if (!res.ok) { lastErr = new Error(`RPC ${res.status}`); continue; }
      const json = await res.json();
      if (json.error) { lastErr = new Error(json.error.message); continue; }
      return json.result;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('all RPC endpoints failed');
}

function rememberSeen() {
  // Cap stored signatures so localStorage doesn't grow forever.
  localStorage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-200)));
}

async function poll() {
  try {
    const sigs = await rpc('getSignaturesForAddress', [
      CONFIG.WALLET_ADDRESS, { limit: 10 },
    ]);
    const fresh = sigs.filter(s => !seen.has(s.signature) && !s.err);

    // On the very first poll, mark history as seen so old donations don't replay.
    if (firstPoll) {
      firstPoll = false;
      for (const s of sigs) seen.add(s.signature);
      rememberSeen();
      UI.setNetStatus('watching');
      return;
    }

    for (const s of fresh.reverse()) {
      seen.add(s.signature);
      await handleTx(s.signature);
    }
    if (fresh.length) rememberSeen();
    UI.setNetStatus('watching');
  } catch (err) {
    console.warn('[solana] poll failed:', err.message);
    UI.setNetStatus('error');
  }
}

async function handleTx(signature) {
  const tx = await rpc('getTransaction', [
    signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 },
  ]);
  if (!tx || !tx.meta) return;

  const keys = tx.transaction.message.accountKeys;
  const idx = keys.findIndex(k => (k.pubkey || k) === CONFIG.WALLET_ADDRESS);
  if (idx === -1) return;

  const delta = (tx.meta.postBalances[idx] - tx.meta.preBalances[idx]) / LAMPORTS_PER_SOL;
  if (delta < CONFIG.MIN_SOL) return;

  const sender = (keys[0].pubkey || keys[0]) || 'anon';
  console.log(`[solana] donation ${delta} SOL from ${sender}`);
  Game.onDonation(delta, sender);
}

function startWatcher() {
  if (!CONFIG.WALLET_ADDRESS) {
    UI.setNetStatus('off');
    console.warn('[solana] WALLET_ADDRESS empty; watcher disabled, use demo buttons.');
    return;
  }
  UI.setNetStatus('connecting');
  poll();
  setInterval(poll, CONFIG.POLL_MS);
}

window.Solana = { CONFIG, startWatcher };
