/**
 * Paid fetch client for the Blockchain IQ x402 API.
 *
 * Blockchain IQ sells crypto data one request at a time over the open x402
 * standard (v2): an unpaid request returns HTTP 402, the client signs a USDC
 * payment on Base and retries. Settlement is gasless for the payer — the
 * payer wallet only needs a small USDC balance on Base, no ETH.
 *
 * This module is a thin wrapper around @x402/fetch with the exact EVM
 * scheme, following Blockchain IQ's own copy-paste example at
 * https://www.blockchainiq.co/agents
 */
import { privateKeyToAccount, type Account } from "viem/accounts";
import {
  wrapFetchWithPayment,
  x402Client,
  decodePaymentResponseHeader,
} from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import type { ClientEvmSigner } from "@x402/evm";

export const BLOCKCHAIN_IQ_BASE_URL =
  "https://www.blockchainiq.co/api/x402/v1";

export const BLOCKCHAIN_IQ_PAY_TO_BASE =
  "0x617dA9383fbA67e86137BC4924b8b7E400fB7C9e";

export interface PaidFetchOptions {
  /**
   * The payer wallet: either a 0x-prefixed private key or a viem Account.
   * Use a dedicated wallet with a small balance, never a main wallet.
   */
  wallet: `0x${string}` | Account;
  /**
   * Spend control: refuse any single call above this amount in dollars.
   * The dearest Blockchain IQ call is $2.00, so 2 is a safe ceiling;
   * defaults to $0.60 (covers every resource except the $2 analyst pack).
   */
  maxUsdPerPayment?: number;
}

/** Settlement proof decoded from the API's PAYMENT-RESPONSE header. */
export type Settlement = ReturnType<typeof decodePaymentResponseHeader>;

export interface PaidCallResult<T = unknown> {
  /** The `data` field of the API response envelope. */
  data: T;
  /**
   * Settlement proof from the PAYMENT-RESPONSE header, or null when the
   * call was free (no payment was needed). `transaction` is the Base
   * transaction hash of the USDC payment.
   */
  settlement: Settlement | null;
}

export interface PaidFetch {
  /** fetch wrapped with x402 payment handling (402 -> sign -> retry). */
  fetch: typeof fetch;
  /** The payer account address (lowercase). */
  payerAddress: string;
}

/**
 * Adapt a viem account to the signer shape @x402/evm expects. A viem local
 * account's signTypedData is generic, so it is wrapped with a cast; at
 * runtime the call is exactly viem's EIP-712 signing, which is what the
 * x402 exact scheme needs to authorize the USDC payment.
 */
function adaptAccount(account: Account): ClientEvmSigner {
  const signTypedData = account.signTypedData;
  if (typeof signTypedData !== "function") {
    throw new Error("Wallet account must support EIP-712 signTypedData.");
  }
  const sign = signTypedData as (
    args: never,
  ) => Promise<`0x${string}`>;
  return {
    address: account.address,
    signTypedData: (message) => sign(message as never),
  };
}

/**
 * Build a fetch that pays for Blockchain IQ x402 resources automatically.
 * The first request to a paid resource gets HTTP 402; the wrapper signs a
 * USDC payment for the quoted amount and retries with it.
 *
 * Every request carries a 60 s abort timeout: without one, a stalled
 * connection can hang the default undici headers timeout (~300 s) before
 * the caller ever sees an error.
 */
export function createPaidFetch(options: PaidFetchOptions): PaidFetch {
  const account =
    typeof options.wallet === "string"
      ? privateKeyToAccount(options.wallet)
      : options.wallet;

  const fetchWithTimeout: typeof fetch = (input, init) =>
    fetch(input, {
      ...init,
      signal: init?.signal ?? AbortSignal.timeout(60_000),
    });

  const client = x402Client.fromConfig({
    schemes: [
      { network: "eip155:*", client: new ExactEvmScheme(adaptAccount(account)) },
    ],
    spendControls: {
      maxAmountPerPayment: options.maxUsdPerPayment ?? 0.6,
    },
  });

  return {
    fetch: wrapFetchWithPayment(fetchWithTimeout, client),
    payerAddress: account.address.toLowerCase(),
  };
}

/**
 * GET a Blockchain IQ resource through the paid fetch and return its data
 * plus the settlement proof. Throws on non-2xx responses; a 404 or an
 * error response is never charged by the API.
 */
export async function paidGet<T = unknown>(
  paidFetch: PaidFetch,
  path: string,
): Promise<PaidCallResult<T>> {
  const url = path.startsWith("http")
    ? path
    : `${BLOCKCHAIN_IQ_BASE_URL}${path}`;
  const res = await paidFetch.fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Blockchain IQ request failed: ${res.status} ${res.statusText} ${body.slice(0, 500)}`,
    );
  }
  const settlementHeader = res.headers.get("payment-response");
  const settlement = settlementHeader
    ? decodePaymentResponseHeader(settlementHeader)
    : null;
  const json = (await res.json()) as { data: T };
  return { data: json.data, settlement };
}
