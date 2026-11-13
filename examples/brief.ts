/**
 * Paid call demo: fetch the Crypto Market Brief ($0.01) through the
 * LangChain tool and print the data plus the settlement proof.
 *
 *   AGENT_PRIVATE_KEY=0x... npm run example:brief
 *
 * The wallet needs a little USDC on Base. Settlement is gasless for the
 * payer, so no ETH is needed. Use a dedicated wallet with a small balance,
 * never a main wallet.
 */
import { createBlockchainIQTools } from "../src/tools.js";

const privateKey = process.env.AGENT_PRIVATE_KEY as `0x${string}` | undefined;
if (!privateKey) {
  console.error("Set AGENT_PRIVATE_KEY to a 0x-prefixed private key.");
  process.exit(1);
}

const { briefTool } = createBlockchainIQTools({ wallet: privateKey });

const raw = await briefTool.invoke({});
const out = JSON.parse(raw) as {
  data: unknown;
  settlement: { transaction?: string; payer?: string } | null;
  priceUsd: string;
};

console.log("priceUsd:", out.priceUsd);
console.log("settlement:", JSON.stringify(out.settlement, null, 2));
console.log("data:", JSON.stringify(out.data, null, 2).slice(0, 2000));

if (!out.settlement?.transaction) {
  console.error("No settlement transaction hash — the paid call did not settle.");
  process.exit(1);
}
console.log(
  "Settlement tx:",
  `https://basescan.org/tx/${out.settlement.transaction}`,
);
