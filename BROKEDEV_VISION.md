# BROKEDEV.games — Master Blueprint

_Compiled 2026-07-12 from `BrokeDev_Propuesta_Completa.md` + `BrokeDev_games_concept.md`,
reconciled with the working MVP in this repo and the "SOL-native, no fiat" decision._

---

## 0. One line

> **Fund the build. Watch the agent ship. Keep the dev alive, or watch him burn out — either way the game ships.**

A persistent pixel developer, financed by onchain SOL activity, who must survive,
build, and publish **real games** in front of an audience that can help him or
wreck his day. Every real product = a season. The precarity is the content.

---

## 1. What already exists (the seed — BrokeDev v0.00)

Not starting from zero. Live, mainnet-verified, zero-dependency browser client:

- Pixel dev at a battlestation, 6 states (coding / drinking / stressed / sleeping / burnout / shipping).
- **Two SOL-fed meters**: volatile STAMINA (burnout at zero, funds safe) + permanent SHIP GOAL (cumulative SOL, never resets).
- Real onchain donation watcher (raw JSON-RPC, no wallet-adapter) — **verified end to end on mainnet** with a real 0.01 SOL tip.
- Tiered tips (coffee/redbull/pizza/rent/sponsor), stream-style alerts, thank-you bubbles, chimes.
- Milestone "SHIPPED" overlay + roadmap advance. Persistence + offline drain.
- Vanity wallet `C4t3XdZB36eHU11PK9QGtVgNPrKDDfkwvEHSAGwM64tT`.

This is the streamable frontend. Everything below extends it.

---

## 2. The core loop

```
Onchain SOL activity (tips / $BROKE trades / chat)
        -> deterministic sim updates the dev's state
        -> dev reacts on screen (+ LLM voice later)
        -> visible progress toward shipping a real game
        -> game ships -> season closes -> next season, better room
```

Two audience powers, both real:
- **Help** — accelerate, protect, feed, fund.
- **Sabotage** — delay, stress, distract, break the build (bounded — see §5).

---

## 3. The character & the room that grows (precarity-as-content)

Starts deliberately poor: 16–32px dev, one bare room, a toaster PC, few frames.
Money visibly upgrades the world, not just a number:

> **META 01 — Replace the toaster PC** → fewer crashes, better sprite, faster ticks, hosting, domain, first build.

The dev, the game, and the creator level up together. "New engine" can be a
*narrative* upgrade event without an actual rewrite. The arc, long-term:

```
broke developer -> struggling solo founder -> unstable studio
-> chaotic publisher -> agent-run game company
```

Brand stops meaning "no money," starts meaning **"always one build away from disaster."**

---

## 4. Deterministic sim is the truth. LLM only talks. (NON-NEGOTIABLE)

```
Authoritative sim -> character state -> action planner -> animation/gameplay
                                                       -> LLM verbalizes what happened
```

The deterministic backend owns: needs, timing, economy, progress, consequences,
cooldowns, limits. The LLM only: thanks, insults, complains, reads donor names,
narrates. **The model never invents progress, money, builds, or spend the backend
didn't confirm.** Context in, personality out.

---

## 5. Sabotage — the mechanic that makes it a reality show (with hard rules)

This is the biggest new idea vs our current tip-jar. It creates drama, clips,
"community saves the dev" moments. But it must be bounded or it becomes harassment:

Every negative action requires: **cooldown · max duration · accumulation cap ·
a known counter-measure · anti-lock protection · max progress impact.**

> Rule: sabotage can *delay*, but never erase more than ~5–10% of accumulated progress.

Examples — positive: coffee, food, internet, meds, RAM/SSD, better chair, antivirus,
QA agent, pay a bill, unlock rest. Negative: insert a bug, virus, cut internet,
insomnia, toxic client, break a build, tech debt, doomscroll, bad review.

---

## 6. Guaranteed progress + hard deadline + emergency MVP

The product ships **even with zero money**. Audience changes the *pace*, never buys
the ending outright and never destroys it.

```
No intervention:  ~30–35 in-game days
Positive crowd:   ~20–25
Balanced:         ~27–35
Destructive:      ~35–45 (capped)
```

At the hard time limit → emergency mode: cut features, ship a defective-but-working
MVP. **Every season closes.**

---

## 7. Visible shipping (the dev dashboard is content)

Don't just show a guy at a PC. Expose the work:

```
FEATURE: Auto-save   ██████████████░░░░ 68%
Build: BROKEN   Critical bugs: 2   Stamina: 14%   ETA: "no idea"
Changelog · roadmap · tech debt · hours awake · daily burn
```

---

## 8. Token & treasury (SOL-native)

- **One persistent token: `$BROKE`.** NOT one-token-per-game (that reads as serial
  liquidity extraction / rug). Games ship as real products; contribution is rewarded
  with badges / NFTs / season passes / credits / early access — not new tokens.
- **Pump.fun** as the initial launch + discovery + streaming + creator-fees layer.
- Onchain activity → gameplay via an **aggregated `activity_score`** computed every
  10–15 min (unique wallets, normalized volume, valid messages, minus concentration
  and suspicious activity) — **not** per-transaction, to resist bots/wash trading.
- **Public, transparent treasury**, shown on stream, in SOL:

```
BROKEDEV TREASURY
Balance: 4.82 SOL   Runway: 19 days   Daily burn: 0.06 SOL
Game revenue: 0.9 SOL   Next bill: hosting (4 days)
Split: 50% dev · 20% infra/APIs · 15% art/music · 10% reserve · 5% community
```

Rules public, simple, auditable, **separate from the personal wallet.** The token
coordinates attention/community/gameplay. It promises **no** returns, dividends,
buybacks, or revenue share. (Legal review before anything that smells like investment.)

---

## 9. Seasons & snowball

Each real game = a season (`Season 001: ship a microgame` → 002 commercial → 003 hire
help → 004 studio → …). Real sales outcome sets the *next* season's starting
conditions (sells well = better gear/scope; sells badly = back to freelance, worse start).

Four flywheels reinforce: **content** (stream→drama→clips→CT→audience), **product**
(ship→players→attention→funding→next game), **economic** (activity→fees→upgrades→quality),
**narrative** (outcome→consequences→attachment).

---

## 10. Engine decision — my recommendation: stay web (for now)

Both source docs recommend **Godot 4 + separate backend**. Godot buys richer animation
tooling and heavier simulation. **But** our client already exists, is live,
mainnet-verified, zero-dependency, and OBS can capture a browser tab as easily as a
Godot window. My call:

- **Keep the web canvas client** as the streamable frontend. Don't eat a rewrite and
  lose momentum for animation polish we don't need yet.
- **Add the missing half** the docs are really pointing at: an authoritative backend,
  onchain listener, LLM voice layer, admin panel.
- Revisit Godot only if animation/sim complexity actually demands it — and remember
  the doc's own point: a "new engine" can be a *narrative* event, not a real port.

Trade-off to accept: pixel animation in canvas is more manual than Godot's AnimationTree.
For a one-room pixel sim, that's a fine price for keeping what works.

---

## 11. Target architecture (web-client variant)

```
Pump.fun / SOL transfers / chat
        -> Backend (authoritative): TS + Node (Fastify/Nest) · Postgres · Redis
           · WebSockets · workers · cooldown engine · onchain listener · LLM layer
        -> Web client (this repo): canvas render · state machine · WS · local cache
           · auto-recovery · progress UI
        -> OBS / FFmpeg -> 24/7 stream
Admin panel: pause/cancel effects, force sleep/food/heal, kill virus, disable LLM,
             change pace, revert events, review txs, control TTS.
```

Ops: TTS, moderation, logging, alerts, backups every few minutes, auto-restart,
prerecorded-line fallback when the LLM is down. **A 24/7 stream without an admin
panel is operationally fragile.**

---

## 12. Guardrails (non-negotiable)

- **Content warnings** (breakup, financial ruin, burnout) + help resources. Arc must be
  resilience + community support, not glorified toxic coping.
- **No financial promises** anywhere. Token ≠ investment.
- **Never mix** project treasury and personal wallet.
- **No fake progress**, no faked autonomy — the sim must be real.
- Sabotage bounded (§5); active moderation; block/ban tools.
- Legal review before token mechanics, giveaways, or anything return-like.

---

## 13. Phased path (from what we have)

- **Phase 0 — DONE.** Web MVP: dev, states, burnout, SOL watcher (mainnet-verified),
  stamina + ship-goal, milestone, roadmap, persistence.
- **Phase 1 — the sim gets real.** Authoritative backend + persistence + event queue +
  cooldowns; onchain listener; visible dev dashboard (feature % / bugs / build / ETA /
  changelog); transparent SOL treasury; first sabotage actions (bounded).
- **Phase 2 — the agent talks.** LLM verbalization (thanks/insults/complaints, reads
  names) + TTS + prerecorded fallback. Sim stays authoritative.
- **Phase 3 — the stream.** 24/7 web client in OBS on a VPS; admin panel; moderation;
  backups + auto-restart.
- **Phase 4 — token & season.** `$BROKE` on pump.fun; `activity_score`; public treasury;
  **Season 001 = ship one real microgame**; close the season.

---

## 14. Cut list (what NOT to do)

- ❌ One token per game. ❌ Promise an engine migration as a reward. ❌ Let the LLM own
  state/money/progress. ❌ Any return/dividend/revenue-share promise. ❌ Sabotage that can
  destroy the project. ❌ Fiat anywhere. ❌ 24/7 without an admin panel. ❌ Over-polish before
  shipping — publishing beats perfecting.

---

## 15. Open decisions (need your call)

1. **Season 001 microgame** — which finished/near-finished game ships first?
2. **SOL goal(s)** — real target for the first "replace the toaster PC" / ship meta.
3. **Client**: stay web (my rec) or commit to Godot now?
4. **Sabotage in v1**, or positive-only until the stream is stable?
5. **`$BROKE` timing** — launch now as distribution, or after the sim is stream-ready?

---

## Taglines (best of)

- Fund the build. Watch the agent ship.
- Keep the dev alive. Get the game shipped.
- Ship or starve.
- One build away from disaster.
- Watch him code. Pay to help. Pay to ruin him.
- Built live. Broken live. Shipped anyway.

## Season names (best of)

Day Zero · Ship or Starve · No Runway · Burnout Protocol · Last Commit · Still Shipping
