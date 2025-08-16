import { PrivyClient } from '@privy-io/server-auth';
import {
    LAMPORTS_PER_SOL,
    PublicKey,
    SystemProgram,    
    VersionedTransaction,
    TransactionMessage,
    Connection,
    clusterApiUrl
} from '@solana/web3.js';
import dotenv from 'dotenv';

dotenv.config();

const { PRIVY_APP_ID, PRIVY_APP_SECRET } = process.env;

if (!PRIVY_APP_ID || !PRIVY_APP_SECRET) {
    console.error('PRIVY_APP_ID and PRIVY_APP_SECRET must be set');
    process.exit(1);
}

const privy = new PrivyClient(PRIVY_APP_ID, PRIVY_APP_SECRET);

// Create a wallet
const wallet = await privy.walletApi.createWallet({chainType: 'solana'});

console.log("Wallet ID: ", wallet.id);
console.log("Wallet Address: ", wallet.address);

// Create connection to get recent blockhash
const connection = new Connection(clusterApiUrl('devnet'));
const { blockhash } = await connection.getLatestBlockhash();

// Create a simple transfer transaction
const walletPublicKey = new PublicKey(wallet.address);
const destinationAddress = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM"; // Random devnet address

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

const { signedTransaction } = await privy.walletApi.solana.signTransaction({
    walletId: wallet.id,
    transaction: transaction
});

const t1 = performance.now();

console.log("Transaction signed successfully");
console.log("Time taken: ", t1 - t0, "ms");