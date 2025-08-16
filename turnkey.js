import { Turnkey } from "@turnkey/sdk-server";
import dotenv from 'dotenv';
import { TurnkeySigner } from "@turnkey/solana";
import { createNewSolanaWallet } from "./utils/createSolanaWallet.js";
import { signMessage } from "./utils/signMessage.js";

dotenv.config();

if (!process.env.TURNKEY_ORGANIZATION_ID || !process.env.TURNKEY_API_PRIVATE_KEY || !process.env.TURNKEY_API_PUBLIC_KEY) {
    console.error('TURNKEY_ORGANIZATION_ID, TURNKEY_API_PRIVATE_KEY, and TURNKEY_API_PUBLIC_KEY must be set');
    process.exit(1);
}

const turnkeyClient = new Turnkey({
  defaultOrganizationId: process.env.TURNKEY_ORGANIZATION_ID,
  apiBaseUrl: "https://api.turnkey.com",
  apiPrivateKey: process.env.TURNKEY_API_PRIVATE_KEY,
  apiPublicKey: process.env.TURNKEY_API_PUBLIC_KEY,
});

const turnkeySigner = new TurnkeySigner({
    organizationId: process.env.TURNKEY_ORGANIZATION_ID,
    client: turnkeyClient.apiClient(),
});

const solAddress = await createNewSolanaWallet(turnkeyClient.apiClient());

const message = "Hello, world!";

const t0 = performance.now();

let signature = await signMessage({
      signer: turnkeySigner,
      fromAddress: solAddress,
      message,
});

const t1 = performance.now();
console.log("Signature: ", signature);
console.log("Time taken: ", t1 - t0, "ms");