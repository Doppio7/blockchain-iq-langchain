/**
 * LangChain tools for the Blockchain IQ x402 API.
 *
 * Two paid tools cover the bounty-qualifying resources (a working paid call
 * to either one qualifies an integration for the Blockchain IQ bounty):
 *  - `blockchain_iq_brief` — Crypto Market Brief for Agents, $0.01/call.
 *  - `blockchain_iq_event_risk` — Event Risk, next 7 days by default, $0.05/call.
 *
 * Plus a free `blockchain_iq_sample` tool (no wallet needed) for dry runs.
 *
 * Payment is in USDC on Base over x402 v2 and is gasless for the payer: the
 * payer wallet only needs a small USDC balance. Use a dedicated wallet with
 * a small balance, never a main wallet.
 */
import { tool, type StructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import {
  createPaidFetch,
  paidGet,
  type PaidFetchOptions,
  type PaidFetch,
} from "./client.js";

export type { PaidFetchOptions } from "./client.js";

export interface BlockchainIQTools {
  /** Crypto Market Brief for Agents — $0.01 per call, parameter-free. */
  briefTool: StructuredTool;
  /** Event Risk, next N days — $0.05 per call. */
  eventRiskTool: StructuredTool;
  /** Free sample (Bitcoin network activity) — no wallet, no payment. */
  sampleTool: StructuredTool;
}

const briefSchema = z.object({});
const eventRiskSchema = z.object({
  days: z
    .number()
    .int()
    .min(1)
    .max(90)
    .optional()
    .describe("How many days ahead to cover (1-90). Default 7."),
  minImportance: z
    .number()
    .int()
    .min(1)
    .max(3)
    .optional()
    .describe("Minimum event importance 1-3 (1 = everything). Default 1."),
});

/**
 * Build the Blockchain IQ tools for a LangChain agent. The returned tools
 * pay for their own calls: each invocation signs a USDC payment on Base
 * (capped by `maxUsdPerPayment`) and retries after the HTTP 402.
 */
export function createBlockchainIQTools(
  options: PaidFetchOptions,
): BlockchainIQTools {
  const paidFetch: PaidFetch = createPaidFetch(options);

  const briefTool = tool(
    async () => {
      const { data, settlement } = await paidGet(paidFetch, "/brief");
      return JSON.stringify({ data, settlement, priceUsd: "0.01" });
    },
    {
      name: "blockchain_iq_brief",
      description:
        "Crypto Market Brief for Agents from Blockchain IQ ($0.01 per call, paid in USDC on Base via x402). " +
        "Parameter-free: BTC, ETH, SOL and XRP prices with 24h, 7d and 30d moves and rank, " +
        "scheduled macro and crypto events in the next 48 hours, and short risk flags. " +
        "Use as the opening call of a trading, portfolio or research agent loop. " +
        "Returns JSON with the brief data plus the on-chain settlement proof (transaction hash).",
      schema: briefSchema,
    },
  );

  const eventRiskTool = tool(
    async (input: { days?: number; minImportance?: number }) => {
      const days = input.days ?? 7;
      const minImportance = input.minImportance ?? 1;
      const { data, settlement } = await paidGet(
        paidFetch,
        `/event-risk?days=${days}&minImportance=${minImportance}`,
      );
      return JSON.stringify({ data, settlement, priceUsd: "0.05" });
    },
    {
      name: "blockchain_iq_event_risk",
      description:
        "Event Risk from Blockchain IQ ($0.05 per call, paid in USDC on Base via x402). " +
        "Scheduled market-moving events for the next N days: US data releases, FOMC/ECB/BoJ decisions, " +
        "Treasury auctions and dated crypto and regulatory milestones, each with importance 1-3 and source. " +
        "Use before any trade or scheduled action to know what is on the calendar. " +
        "Returns JSON with the events plus the on-chain settlement proof (transaction hash).",
      schema: eventRiskSchema,
    },
  );

  const sampleTool = tool(
    async () => {
      const res = await fetch(
        "https://www.blockchainiq.co/api/x402/v1/sample",
      );
      if (!res.ok) {
        throw new Error(
          `Blockchain IQ sample request failed: ${res.status} ${res.statusText}`,
        );
      }
      const json = (await res.json()) as { data: unknown };
      return JSON.stringify({ data: json.data, priceUsd: "0" });
    },
    {
      name: "blockchain_iq_sample",
      description:
        "Free sample from Blockchain IQ (no payment, no wallet): Bitcoin network activity for its latest " +
        "single day — transactions, active addresses and fees. Use to test the integration before paying.",
      schema: z.object({}),
    },
  );

  return { briefTool, eventRiskTool, sampleTool };
}
