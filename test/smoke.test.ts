import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createBlockchainIQTools } from "../src/tools.js";
import { createPaidFetch } from "../src/client.js";

// Dummy key: only the free sample tool is exercised here, so the key is
// never used to sign anything.
const DUMMY_KEY =
  "0x0000000000000000000000000000000000000000000000000000000000000001";

describe("blockchain-iq langchain tools", () => {
  it("builds three tools with the expected names and descriptions", () => {
    const { briefTool, eventRiskTool, sampleTool } = createBlockchainIQTools({
      wallet: DUMMY_KEY,
    });
    assert.equal(briefTool.name, "blockchain_iq_brief");
    assert.equal(eventRiskTool.name, "blockchain_iq_event_risk");
    assert.equal(sampleTool.name, "blockchain_iq_sample");
    for (const t of [briefTool, eventRiskTool, sampleTool]) {
      assert.ok(t.description.length > 20);
    }
  });

  it("paid fetch derives the expected payer address from the key", () => {
    // No network call and no signing here: this only proves the client
    // builds and the payer address is derived correctly. The live paid
    // path (402 -> sign -> retry) is exercised by examples/brief.ts with a
    // funded wallet, not in tests.
    const paidFetch = createPaidFetch({ wallet: DUMMY_KEY });
    assert.equal(
      paidFetch.payerAddress,
      "0x7e5f4552091a69125d5dfcb7b8c2659029395bdf",
    );
  });

  it("free sample tool returns Bitcoin network data without payment", async () => {
    const { sampleTool } = createBlockchainIQTools({ wallet: DUMMY_KEY });
    const raw = await sampleTool.invoke({});
    const out = JSON.parse(raw) as {
      data: { chain?: string; title?: string };
      priceUsd: string;
    };
    assert.equal(out.priceUsd, "0");
    assert.equal(out.data.chain, "btc");
    assert.ok(out.data.title);
  });

  it("unknown resource returns 404 and is never charged", async () => {
    const res = await fetch(
      "https://www.blockchainiq.co/api/x402/v1/no-such-resource",
    );
    assert.equal(res.status, 404);
  });
});
