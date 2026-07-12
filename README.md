# PIXEL PET

A cute pixel-art tamagotchi that lives in the browser and survives on SOL donations. It walks, plays, blinks, sleeps, begs when hungry. Energy drains in ~12 minutes; at zero it dies for real (grave + GAME OVER). Donations trigger stream-style alerts with the donor's address, a thank-you speech bubble, and a chime.

## Run

Static files, no build, no dependencies:

```
python -m http.server 8123 --directory .
```

Open http://localhost:8123. Until you configure a wallet, use the "demo mode" panel at the bottom to test every tier for free.

## Go live with real SOL

Edit `solana.js` and set `CONFIG.WALLET_ADDRESS` to your receiving address. The page polls the public mainnet RPC every 15s (`getSignaturesForAddress` + balance delta), so donations from any wallet app count. Old transactions are marked seen on the first poll and never replay. Switch `RPC_URL` to devnet for testing.

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
