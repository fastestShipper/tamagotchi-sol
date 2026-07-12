# PIXEL PET

A cute pixel-art tamagotchi that lives in the browser and survives on SOL donations. It walks, plays, blinks, sleeps, begs when hungry. Energy drains in ~12 minutes; at zero it dies for real (grave + GAME OVER). Donations trigger stream-style alerts with the donor's address, a thank-you speech bubble, and a chime.

## Run

Static files, no build, no dependencies:

```
python -m http.server 8123 --directory .
```

Open http://localhost:8123. Until you configure a wallet, use the "demo mode" panel at the bottom to test every tier for free.

## The cat's wallet

The pet has its own vanity Solana address (same on every network):

```
C4t3XdZB36eHU11PK9QGtVgNPrKDDfkwvEHSAGwM64tT
```

The private key lives in `cat-wallet.json` (gitignored, NEVER committed). Whoever holds that file controls the donations. Back it up in a password manager. To regrind a different vanity prefix, see the grinder note below.

## Networks

`solana.js` has a one-line switch:

```js
NETWORK: 'devnet',   // free e2e testing with fake SOL
// NETWORK: 'mainnet', // accept real SOL
```

The watcher polls `getSignaturesForAddress` + `getTransaction`, computes the balance delta on the cat's account, and reads the fee payer as the donor. Old transactions are marked seen on the first poll and never replay.

## Testing tools

- `node verify-parse.mjs <address>` — proves the on-chain parse path against real chain data (defaults to a live account; validates amount + sender extraction).
- `node donate.devnet.mjs 0.1` — funds a throwaway donor via devnet airdrop and sends a real transfer to the cat, so you can watch the frontend react. (Devnet faucet is rate-limited per IP; if airdrop 429s, grab test SOL at https://faucet.solana.com and rerun.)

## Verified

- Reaction path (alerts, bubbles, tiers, confetti, permadeath, restart): confirmed in-browser.
- On-chain read/parse path: confirmed against live mainnet transfers — parsed amounts match chain balance deltas exactly, senders are valid pubkeys.
- Wallet keypair: seed cryptographically derives the vanity address (round-trip verified).

## Donation tiers

| SOL | Gift | Effect |
|-----|------|--------|
| 0.01 | Snack (apple) | +25 energy |
| 0.02 | Full meal | +60 energy |
| 0.05 | New ball | +45 energy, plays with it for 30s |
| 0.1 | Cake party | Full energy + confetti |
| 0.5 | Golden crown | Full energy + permanent crown + 50% slower drain for 10 min |

Anything below 0.01 gets a tiny heart and +5. Donations to a dead pet do nothing; the restart button adopts a new one.

## Files

- `sprites.js` — all art as string pixel matrices (edit frames in place)
- `game.js` — pet AI, energy, activities, death, donation reactions
- `solana.js` — RPC donation watcher (config at the top)
- `ui.js` — alerts, bubbles, energy bar, WebAudio chimes, demo buttons
- `style.css` — pastel pixel frame

## Known gotcha

Browsers freeze `requestAnimationFrame` in hidden tabs. Energy therefore drains on uncapped wall-clock time plus a 1s `setInterval` heartbeat, so the pet keeps starving while nobody watches. Do not move logic back into rAF-only.
