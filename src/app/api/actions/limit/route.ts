/**
 * Solana Actions Example
 */

import {
  ActionPostResponse,
  ACTIONS_CORS_HEADERS,
  createPostResponse,
  ActionGetResponse,
  ActionPostRequest,
} from "@solana/actions";
import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { LimitOrderProvider } from "@jup-ag/limit-order-sdk";
import { BN } from "bn.js";

const DEFAULT_SOL_ADDRESS: PublicKey = new PublicKey(
  "GqkJ3UoKTScvXiaJUxrGJ9QD847LAj2DTvMzqjaT2tJm"
);

const DEFAULT_SOL_AMOUNT: number = 1.0;

export const GET = async (req: Request) => {
  try {
    const requestUrl = new URL(req.url);
    const { toPubkey } = validatedQueryParams(requestUrl);

    const baseHref = new URL(
      `/api/actions/limit?to=${toPubkey}`,
      requestUrl.origin
    ).toString();

    const payload: ActionGetResponse = {
      title: "Buy SOL with limit order",
      icon: new URL("/jup.jpeg", requestUrl.origin).toString(),
      description: "Place limit orders to buy SOL",
      label: "Transfer", // this value will be ignored since `links.actions` exists
      links: {
        actions: [
          {
            label: "Limit Order on JUP", // button text
            href: `${baseHref}&amountInUSDC={amountInUSDC}&amountInSOL={amountInSOL}`, // this href will have a text input
            parameters: [
              {
                name: "amountInUSDC", // parameter name in the `href` above
                label: "USDC", // placeholder of the text input
                required: true,
              },
              {
                name: "amountInSOL", // parameter name in the `href` above
                label: "SOL", // placeholder of the text input
                required: true,
              },
            ],
          },
        ],
      },
    };

    return Response.json(payload, {
      headers: ACTIONS_CORS_HEADERS,
    });
  } catch (err) {
    console.log(err);
    let message = "An unknown error occurred";
    if (typeof err == "string") message = err;
    return new Response(message, {
      status: 400,
      headers: ACTIONS_CORS_HEADERS,
    });
  }
};

// DO NOT FORGET TO INCLUDE THE `OPTIONS` HTTP METHOD
// THIS WILL ENSURE CORS WORKS FOR BLINKS
export const OPTIONS = GET;

export const POST = async (req: Request) => {
  try {
    const requestUrl = new URL(req.url);
    const { amountInSOL, amountInUSDC, toPubkey } =
      validatedQueryParams(requestUrl);

    console.log("amountInSOL", amountInSOL);
    console.log("amountInUSDC", amountInUSDC);
    console.log("toPubkey", toPubkey);
    const body: ActionPostRequest = await req.json();

    // validate the client provided input
    let account: PublicKey;
    try {
      account = new PublicKey(body.account);
    } catch (err) {
      return new Response('Invalid "account" provided', {
        status: 400,
        headers: ACTIONS_CORS_HEADERS,
      });
    }

    const connection = new Connection(
      "https://mainnet.helius-rpc.com/?api-key=a0529e8a-e33f-4f66-95ad-b9036bc552e7"
    );

    const transaction = new Transaction();

    const limitOrder = new LimitOrderProvider(
      connection,
      new PublicKey("GqkJ3UoKTScvXiaJUxrGJ9QD847LAj2DTvMzqjaT2tJm"),
      "limitBlink"
    );

    // Base key are used to generate a unique order id
    const base = Keypair.generate();

    const { tx } = await limitOrder.createOrder({
      owner: account,
      inAmount: new BN(Number(amountInUSDC) ?? 5000000), // 1000000 => 1 USDC if inputToken.address is USDC mint
      outAmount: new BN(Number(amountInSOL) ?? 5000000),
      inputMint: new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"),
      outputMint: new PublicKey("So11111111111111111111111111111111111111112"),
      expiredAt: null,
      base: base.publicKey,
    });

    transaction.add(tx);

    // set the end user as the fee payer
    transaction.feePayer = account;

    transaction.recentBlockhash = (
      await connection.getLatestBlockhash()
    ).blockhash;

    const payload: ActionPostResponse = await createPostResponse({
      fields: {
        transaction,
        message: `DCA order`,
      },
      // note: no additional signers are needed
      // signers: [],
    });

    return Response.json(payload, {
      headers: ACTIONS_CORS_HEADERS,
    });
  } catch (err) {
    console.log(err);
    let message = "An unknown error occurred";
    if (typeof err == "string") message = err;
    return new Response(message, {
      status: 400,
      headers: ACTIONS_CORS_HEADERS,
    });
  }
};

function validatedQueryParams(requestUrl: URL) {
  let toPubkey: PublicKey = DEFAULT_SOL_ADDRESS;
  let amountInSOL = "5000000";
  let amountInUSDC = "10000000";

  try {
    if (requestUrl.searchParams.get("to")) {
      toPubkey = new PublicKey(requestUrl.searchParams.get("to")!);
    }
    if (requestUrl.searchParams.get("amountInSOL")) {
      amountInSOL = (
        Number(requestUrl.searchParams.get("amountInSOL")!) *
        Number(1000_000_000)
      ).toString();
    }
    if (requestUrl.searchParams.get("amountInUSDC")) {
      amountInUSDC = (
        Number(requestUrl.searchParams.get("amountInUSDC")!) * Number(1000000)
      ).toString();
    }
  } catch (err) {
    throw "Invalid input query parameter: to";
  }

  return {
    amountInSOL,
    amountInUSDC,
    toPubkey,
  };
}
