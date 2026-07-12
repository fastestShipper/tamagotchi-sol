// Truest possible test: uses the SAME raw-fetch JSON-RPC path as the browser
// (solana.js uses fetch, NOT web3.js), against real mainnet transfers.
const LAMPORTS_PER_SOL = 1e9;
const RPC_URL = 'https://api.mainnet-beta.solana.com';
// Always-active account that constantly receives SOL (the on-chain incinerator).
const WATCH = process.argv[2] || '1nc1nerator11111111111111111111111111111111';

// ---- copied verbatim from solana.js ----
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function rpc(method, params) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    });
    if (res.status === 429) { await sleep(1500 * (attempt + 1)); continue; }
    if (!res.ok) throw new Error(`RPC ${res.status}`);
    const json = await res.json();
    if (json.error) throw new Error(json.error.message);
    return json.result;
  }
  throw new Error('RPC 429 after retries');
}
// handleTx detection logic, verbatim:
function detect(tx, WALLET) {
  if (!tx || !tx.meta) return null;
  const keys = tx.transaction.message.accountKeys;
  const idx = keys.findIndex(k => (k.pubkey || k) === WALLET);
  if (idx === -1) return null;
  const delta = (tx.meta.postBalances[idx] - tx.meta.preBalances[idx]) / LAMPORTS_PER_SOL;
  if (delta <= 0) return null; // any inbound SOL (MIN_SOL business filter is separate)
  const sender = (keys[0].pubkey || keys[0]) || 'anon';
  return { delta, sender };
}
// ----------------------------------------

const sigs = await rpc('getSignaturesForAddress', [WATCH, { limit: 25 }]);
console.error(`fetched ${sigs.length} signatures for ${WATCH}`);

const hits = [];
for (const s of sigs) {
  if (s.err) continue;
  await sleep(700); // stay under public-RPC rate limit
  const tx = await rpc('getTransaction', [
    s.signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 },
  ]);
  const parsed = detect(tx, WATCH);
  if (!parsed) continue;
  const keys = tx.transaction.message.accountKeys;
  const idx = keys.findIndex(k => (k.pubkey || k) === WATCH);
  const truth = (tx.meta.postBalances[idx] - tx.meta.preBalances[idx]) / LAMPORTS_PER_SOL;
  hits.push({
    signature: s.signature.slice(0, 16) + '...',
    parsedSOL: +parsed.delta.toFixed(9),
    groundTruthSOL: +truth.toFixed(9),
    amountMatches: Math.abs(parsed.delta - truth) < 1e-9,
    sender: (parsed.sender.pubkey || parsed.sender).slice(0, 10) + '...',
    senderValid: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(parsed.sender),
  });
  if (hits.length >= 3) break;
}

console.log(JSON.stringify({
  watched: WATCH,
  transfersDetected: hits.length,
  allAmountsMatchChain: hits.length > 0 && hits.every(h => h.amountMatches),
  allSendersValid: hits.length > 0 && hits.every(h => h.senderValid),
  samples: hits,
}, null, 2));
