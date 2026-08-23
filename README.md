# 2048 On-Chain — GenLayer Tournament Platform

A Vite + React + TypeScript + Tailwind frontend for the `Game2048Platform` GenLayer
Intelligent Contract: a free-play global leaderboard plus payable, time-boxed
tournaments with pull-payment prize claims.

- **Contract:** `0x63dd126CEE689771597c855552D44376E52cD8D8`
- **Network:** GenLayer Testnet Bradbury (chain ID `4221`, RPC `https://rpc-bradbury.genlayer.com`)
- **SDK:** [`genlayer-js`](https://github.com/genlayerlabs/genlayer-js) (a read client for queries, a wallet-bound write client for transactions)

## Features

- **Wallet integration** — connect MetaMask, auto-detect the wrong network, and switch/add
  GenLayer Bradbury with one click (`src/hooks/useWallet.ts`).
- **Playable 2048** — full keyboard + swipe-controlled game (`src/components/Game2048.tsx`),
  no game-engine dependency.
- **Free play** — submit your score any time via `submit_score`; live global leaderboard via
  `get_leaderboard`.
- **Tournaments** — dashboard of all tournaments (`get_tournament` / `list_tournament_ids`),
  owner-only creation, `join_tournament` (payable), `submit_tournament_score`,
  `finalize_tournament` (callable by anyone once the deadline passes), and pull-payment
  `claim_prize` / `claim_refund`.

## Project structure

```
src/
  genlayer.ts               # client setup + typed wrapper for every contract method
  types.ts                  # TS types mirroring the contract's view dataclasses
  lib/format.ts              # wei↔GEN conversion, address/date formatting
  hooks/useWallet.ts          # MetaMask connect + Bradbury network switch
  components/
    Game2048.tsx             # the playable game grid
    WalletButton.tsx
    FreePlay.tsx
    Leaderboard.tsx
    TournamentDashboard.tsx
    TournamentCard.tsx
    CreateTournamentModal.tsx
  App.tsx
```

## Run locally

Requires Node.js 18+.

```bash
npm install
cp .env.example .env      # optional — defaults to the address above if you skip this
npm run dev
```

Open `http://localhost:5173`, then click **Connect Wallet**. If MetaMask isn't already on
GenLayer Bradbury, you'll be prompted to switch (or add the network automatically).

You'll need testnet GEN to pay entry fees or gas — get some from the
[GenLayer testnet faucet](https://testnet-faucet.genlayer.foundation).

### Environment variables

| Variable                | Default                                     | Description                    |
| ------------------------ | -------------------------------------------- | ------------------------------- |
| `VITE_CONTRACT_ADDRESS`  | `0x63dd126CEE689771597c855552D44376E52cD8D8` | Deployed contract address       |

## Build

```bash
npm run build   # runs a type check, then builds to dist/
npm run preview # serve the production build locally
```

## Deploy to Cloudflare Pages

**Option A — Git integration (recommended)**

1. Push this project to a GitHub repository.
2. In the Cloudflare dashboard: **Workers & Pages → Create → Pages → Connect to Git**, and
   select the repo.
3. Build settings:
   - **Framework preset:** Vite
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
4. Add an environment variable if you want to point at a different contract:
   `VITE_CONTRACT_ADDRESS`.
5. Save and deploy. Cloudflare will rebuild automatically on every push.

**Option B — Direct upload with Wrangler**

```bash
npm install -g wrangler
npm run build
wrangler pages deploy dist --project-name genlayer-2048
```

The included `public/_redirects` file (`/* /index.html 200`) is copied into `dist/` on build
so client-side routing/deep links don't 404 on Cloudflare Pages.

## Notes on the contract's data types

The contract's `u256`/`u32` fields are read with `jsonSafeReturn: true`, so they arrive in the
frontend as plain strings — normalized everywhere via `toBigInt()` / `toNumber()` in
`src/lib/format.ts` rather than assumed to be JS numbers (some values, like `entry_fee` in wei,
exceed `Number.MAX_SAFE_INTEGER`). Wei amounts are converted to/from human GEN amounts with
`parseGenToWei()` / `formatWeiToGen()`.

## Caveats (matches the contract's own design)

- Scores are **self-reported** — `submit_score` / `submit_tournament_score` just enforce a
  sanity ceiling (`get_max_plausible_score`), not verified gameplay. This is a casual
  leaderboard/tournament system, not an anti-cheat one — the footer in the app says so.
- `finalize_tournament` is callable by *anyone* once the deadline passes (by design, so
  tournaments don't get stuck waiting on the owner) — the "Finalize" button appears for any
  connected wallet once a tournament's countdown hits zero.
- Tournament creation and cancellation are gated by the contract's `owner` — the "Create
  tournament" button and each card's "Cancel" action only render for the connected address
  that matches `get_owner()`.
