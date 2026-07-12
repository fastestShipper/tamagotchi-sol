// Devnet donor: funds a throwaway wallet, sends a real transfer to the cat.
// Usage: node donate.mjs <amountSol>
import {
  Connection, Keypair, LAMPORTS_PER_SOL, PublicKey,
  SystemProgram, Transaction, sendAndConfirmTransaction,
} from '@solana/web3.js';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const CAT = new PublicKey('C4t3XdZB36eHU11PK9QGtVgNPrKDDfkwvEHSAGwM64tT');
const amount = parseFloat(process.argv[2] || '0.1');
const DONOR_FILE = new URL('./donor.secret.json', import.meta.url);
const conn = new Connection('https://api.devnet.solana.com', 'confirmed');

// Reuse a funded donor across runs so we don't re-airdrop every time.
let donor;
if (existsSync(DONOR_FILE)) {
  donor = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(DONOR_FILE))));
} else {
  donor = Keypair.generate();
  writeFileSync(DONOR_FILE, JSON.stringify([...donor.secretKey]));
}
console.log('donor:', donor.publicKey.toBase58());

let bal = await conn.getBalance(donor.publicKey);
if (bal < (amount + 0.01) * LAMPORTS_PER_SOL) {
  console.log('airdropping 1 SOL to donor...');
  try {
    const sig = await conn.requestAirdrop(donor.publicKey, LAMPORTS_PER_SOL);
    await conn.confirmTransaction(sig, 'confirmed');
  } catch (e) {
    console.error('airdrop failed:', e.message);
    console.error('fund donor manually at https://faucet.solana.com then rerun');
    process.exit(1);
  }
  bal = await conn.getBalance(donor.publicKey);
}
console.log('donor balance:', (bal / LAMPORTS_PER_SOL).toFixed(3), 'SOL');

const tx = new Transaction().add(SystemProgram.transfer({
  fromPubkey: donor.publicKey,
  toPubkey: CAT,
  lamports: Math.round(amount * LAMPORTS_PER_SOL),
}));
const sig = await sendAndConfirmTransaction(conn, tx, [donor]);
const catBal = await conn.getBalance(CAT);
console.log(JSON.stringify({
  sent: amount, to: CAT.toBase58(), signature: sig,
  catBalance: (catBal / LAMPORTS_PER_SOL).toFixed(3),
  explorer: `https://explorer.solana.com/tx/${sig}?cluster=devnet`,
}, null, 2));
