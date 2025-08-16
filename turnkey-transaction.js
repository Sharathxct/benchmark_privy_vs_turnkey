import { Turnkey } from "@turnkey/sdk-server";
import { TurnkeySigner } from "@turnkey/solana";
import {
    LAMPORTS_PER_SOL,
    PublicKey,
    SystemProgram,    
    VersionedTransaction,
    TransactionMessage,
    Connection,
    clusterApiUrl
} from '@solana/web3.js';
import { createNewSolanaWallet } from "./utils/createSolanaWallet.js";
import dotenv from 'dotenv';

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

// Create a wallet
const solAddress = await createNewSolanaWallet(turnkeyClient.apiClient());

console.log("Wallet Address: ", solAddress);

// Create connection to get recent blockhash
const connection = new Connection(clusterApiUrl('devnet'));
const { blockhash } = await connection.getLatestBlockhash();

// Create a simple transfer transaction (same as Privy)
const walletPublicKey = new PublicKey(solAddress);
const destinationAddress = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM"; // Same address as Privy

const instruction = SystemProgram.transfer({
    fromPubkey: walletPublicKey,
    toPubkey: new PublicKey(destinationAddress),
    lamports: 10000 // 0.00001 SOL
});

const message = new TransactionMessage({
    payerKey: walletPublicKey,
    recentBlockhash: blockhash,
    instructions: [instruction],
});

const transaction = new VersionedTransaction(message.compileToV0Message());

console.log("Transaction created, signing...");

const t0 = performance.now();

const signedTransaction = await turnkeySigner.signTransaction(
    transaction,
    solAddress,
);

const t1 = performance.now();

console.log("Transaction signed successfully");
console.log("Time taken: ", t1 - t0, "ms");