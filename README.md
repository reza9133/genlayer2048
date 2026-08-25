# 2048 On-Chain — GenLayer Tournament Platform

A Vite + React + TypeScript + Tailwind frontend for the `Game2048Platform` GenLayer Intelligent Contract: a free-play global leaderboard plus payable, time-boxed tournaments with automated prize distribution.

- **Contract:** `0x5E38c0389DbF553bD54eA962521f11be145c1C3F`
- **Network:** GenLayer Testnet Bradbury (chain ID `4221`, RPC `https://rpc-bradbury.genlayer.com`)
- **SDK:** [`genlayer-js`](https://github.com/genlayerlabs/genlayer-js) (read client for RPC queries, wallet-bound write client for signing transactions)

---

## Architecture & Validator Model

Scores are **never accepted as bare client-supplied numbers**. The contract implements a full **Deterministic Replay Validator**:

1. **Replayable Score Evidence:**
   - The frontend seeds a 32-bit PRNG (`xorshift32`) for all random tile spawns and logs the exact sequence of moves (`U`, `D`, `L`, `R`).
   - When submitting a score, the client only sends the initial `seed` and the `moves` string.
   - The contract independently runs the identical deterministic 2048 engine, replays the move history, and derives the score directly on-chain. GenVM validators reach consensus on the verified replay execution before accepting the transaction.

2. **Strict Deadline Enforcement:**
   - All tournament interactions rely on GenVM's deterministic transaction time (`datetime.datetime.now()`).
   - Joins and score submissions are strictly rejected once the deadline passes.
   - Finalization cannot be triggered before the deadline expires.

3. **Native Fund Transfers:**
   - Prize claims (`claim_prize`) and cancelled tournament refunds (`claim_refund`) execute native GEN transfers via `gl.get_contract_at(player).emit_transfer(value=amount)`.

---

## Features

- **Wallet integration** — Connect MetaMask, detect wrong networks, and switch/add GenLayer Bradbury with one click (`src/hooks/useWallet.ts`).
- **Playable 2048 with Deterministic Engine** — Pure keyboard and touch-swipe controls synced with an on-chain reproducible PRNG (`src/components/Game2048.tsx`).
- **Free Play** — Submit replay evidence via `submit_score` and compete on the live global leaderboard (`get_leaderboard`).
- **Tournaments** — Dashboard of all tournaments (`get_tournament` / `list_tournament_ids`), owner-only creation (`create_tournament`), payable entries (`join_tournament`), deadline-enforced submissions (`submit_tournament_score`), public finalization (`finalize_tournament`), and direct prize/refund claims (`claim_prize` / `claim_refund`).

---

## Project Structure


```

src/
genlayer.ts                 # client setup + typed wrappers for contract methods
types.ts                    # TypeScript types & ReplayEvidence interfaces
lib/format.ts               # wei↔GEN conversion, address & date helpers
hooks/useWallet.ts          # MetaMask connect + Bradbury network switch
components/
Game2048.tsx              # playable 2048 grid with xorshift32 PRNG & move logger
WalletButton.tsx
FreePlay.tsx              # free play mode with evidence submission
Leaderboard.tsx           # global verified high score leaderboard
TournamentDashboard.tsx   # tournament listings & management
TournamentCard.tsx        # tournament card with embedded gameplay & actions
CreateTournamentModal.tsx # tournament creation modal (owner only)
App.tsx

```

---

## Run Locally

Requires Node.js 18+.

```bash
npm install
cp .env.example .env
npm run dev

```

Open `http://localhost:5173` and connect your wallet. Make sure you are connected to the GenLayer Bradbury Testnet. Testnet GEN can be obtained from the [GenLayer Testnet Faucet](https://testnet-faucet.genlayer.foundation).

### Environment Variables

| Variable | Default | Description |
| --- | --- | --- |
| `VITE_CONTRACT_ADDRESS` | `0x5E38c0389DbF553bD54eA962521f11be145c1C3F` | Deployed contract address |

---

## Build & Deploy

```bash
npm run build   # type checks and builds to dist/
npm run preview # serves the production build locally

```

### Deploy to Cloudflare Pages

1. Push the repository to GitHub.
2. In Cloudflare Dashboard: **Workers & Pages → Create → Pages → Connect to Git**.
3. Build Configuration:
* **Framework preset:** Vite
* **Build command:** `npm run build`
* **Build output directory:** `dist`


4. Set the environment variable `VITE_CONTRACT_ADDRESS` to `0x085B438e7A182eaD901931e4735Bb19f329f886A`.
5. Deploy.

---

## Contract Permissions & Lifecycle

* **Finalization:** `finalize_tournament` is callable by anyone once the deadline has passed, ensuring tournaments can be resolved without dependency on the creator.
* **Admin Control:** Tournament creation and cancellation are restricted to the contract `owner`.

```

```
