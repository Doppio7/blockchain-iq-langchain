# blockchain-iq-langchain

LangChain tools for the [Blockchain IQ](https://www.blockchainiq.co) x402 API — pay-per-call crypto data, paid in USDC on Base over the open [x402](https://www.x402.org) standard (v2).

Built for the [Blockchain IQ integration bounty](https://www.blockchainiq.co/blog/x402-build-bounties): a public repository with a working paid call through x402 to `brief` ($0.01) or `event-risk` ($0.05).

## Tools

`createBlockchainIQTools({ wallet, maxUsdPerPayment })` returns three LangChain tools:

| Tool | Price | What it does |
| --- | --- | --- |
| `blockchain_iq_brief` | $0.01 | Crypto Market Brief: BTC, ETH, SOL, XRP prices with 24h/7d/30d moves, events in the next 48h, risk flags. Parameter-free. |
| `blockchain_iq_event_risk` | $0.05 | Scheduled market-moving events for the next N days (`days` 1–90, `minImportance` 1–3). |
| `blockchain_iq_sample` | free | Bitcoin network activity for the latest day. No wallet, no payment — use it to test before paying. |

Each paid tool returns JSON with the response `data` plus the on-chain settlement proof (`transaction` hash, `payer`, `network`, `amount`) decoded from the `PAYMENT-RESPONSE` header.

## How payment works

No account, no API key — a wallet holding USDC on Base is the only credential. An unpaid request returns HTTP 402; the client signs a USDC payment for the quoted amount and retries. Settlement is **gasless for the payer**, so the wallet needs USDC only, no ETH. A spend control refuses any single call above `maxUsdPerPayment` (default $0.60; the dearest Blockchain IQ call is $2.00).

Use a dedicated wallet with a small balance, never a main wallet.

## Usage

```ts
import { createBlockchainIQTools } from "blockchain-iq-langchain";

const { briefTool, eventRiskTool } = createBlockchainIQTools({
  wallet: process.env.AGENT_PRIVATE_KEY as `0x${string}`,
});

// Inside a LangChain agent:
const tools = [briefTool, eventRiskTool];

// Or invoke directly:
const out = JSON.parse(await briefTool.invoke({}));
console.log(out.data); // the market brief
console.log(out.settlement.transaction); // Base tx hash of the $0.01 payment
```

## Examples

```bash
npm install

# Free dry run — no wallet, no payment:
npm run example:free

# Paid call — $0.01 to brief, prints the settlement tx hash:
AGENT_PRIVATE_KEY=0x... npm run example:brief
```

## Verified paid call

A real $0.01 call to `brief` was made through the tool on 2026-11-13 and settled on Base:

- Settlement tx: https://basescan.org/tx/0x47826af46416dc6ab111fd6072dc3913fbd40e7255a2626d3e40dc3a86250686
- Block 56837229, status success
- USDC Transfer: `0xC2296B15b601237B3535D59589e77AD23C925714` → `0x617dA9383fbA67e86137BC4924b8b7E400fB7C9e` (Blockchain IQ payee), value 0.01 USDC

## Development

```bash
npm run build   # tsc
npm test        # node:test smoke tests (free endpoints only, no payment)
```

## Links

- Bounty: https://www.blockchainiq.co/blog/x402-build-bounties
- API catalogue (free): https://www.blockchainiq.co/api/x402/v1
- Agents page with the copy-paste Node example: https://www.blockchainiq.co/agents
- x402 protocol: https://www.x402.org

## License

MIT
