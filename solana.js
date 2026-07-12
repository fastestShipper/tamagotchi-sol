// Solana donation watcher. No wallet-adapter, no dependencies: raw JSON-RPC
// polling against a public endpoint. Detects incoming transfers to WALLET_ADDRESS
// and forwards (amount, sender) to Game.onDonation.

const CONFIG = {
  // PUT YOUR RECEIVING ADDRESS HERE. Empty string = watcher stays off (demo mode only).
  WALLET_ADDRESS: '',
  RPC_URL: 'https://api.mainnet-beta.solana.com', // or https://api.devnet.solana.com
  POLL_MS: 15000,
  MIN_SOL: 0.001, // ignore dust below this
};

const LAMPORTS_PER_SOL = 1e9;
const SEEN_KEY = 'tamasol_seen_sigs';

let seen = new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'));
let firstPoll = true;

async function rpc(method, params) {
  const res = await fetch(CONFIG.RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`RPC ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.result;
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
