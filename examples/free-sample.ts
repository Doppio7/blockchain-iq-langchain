/**
 * Free dry run: fetch the free Bitcoin sample through the LangChain tool.
 * No wallet, no payment — use this to test the integration before paying.
 *
 *   npm run example:free
 */
import { createBlockchainIQTools } from "../src/tools.js";

// The sample tool needs no wallet; pass a dummy key — it is never used.
const { sampleTool } = createBlockchainIQTools({
  wallet:
    "0x0000000000000000000000000000000000000000000000000000000000000001",
});

const raw = await sampleTool.invoke({});
const out = JSON.parse(raw) as { data: unknown; priceUsd: string };
console.log("priceUsd:", out.priceUsd);
console.log("data:", JSON.stringify(out.data, null, 2).slice(0, 2000));
