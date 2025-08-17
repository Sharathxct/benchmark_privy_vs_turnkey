import { PrivyClient } from '@privy-io/server-auth';
import {
    PublicKey,
    SystemProgram,    
    VersionedTransaction,
    TransactionMessage,
    Connection,
    clusterApiUrl
} from '@solana/web3.js';
import dotenv from 'dotenv';

dotenv.config();

export const serviceName = 'Privy';

// Initialize the service
export async function initializeService() {
    const { PRIVY_APP_ID, PRIVY_APP_SECRET } = process.env;
    
    if (!PRIVY_APP_ID || !PRIVY_APP_SECRET) {
        throw new Error('PRIVY_APP_ID and PRIVY_APP_SECRET must be set');
    }
    
    const client = new PrivyClient(PRIVY_APP_ID, PRIVY_APP_SECRET);
    const connection = new Connection(clusterApiUrl('devnet'));
    
    return { client, connection };
}

// Create a new wallet
export async function createWallet(serviceInstance) {
    const { client } = serviceInstance;
    const wallet = await client.walletApi.createWallet({ chainType: 'solana' });
    
    return {
        id: wallet.id,
        address: wallet.address,
        serviceInstance
    };
}

// Sign a message
export async function signMessage(wallet, message) {
    const { client } = wallet.serviceInstance;
    
    const result = await client.walletApi.solana.signMessage({
        walletId: wallet.id,
        message: message
    });
    
    return result;
}

// Sign a transaction
export async function signTransaction(wallet, transactionConfig) {
    const { client, connection } = wallet.serviceInstance;
    const { destinationAddress, transferAmount } = transactionConfig;
    
    // Get latest blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    
    // Create transaction
    const walletPublicKey = new PublicKey(wallet.address);
    const destinationPublicKey = new PublicKey(destinationAddress);
    
    const instruction = SystemProgram.transfer({
        fromPubkey: walletPublicKey,
        toPubkey: destinationPublicKey,
        lamports: transferAmount
    });
    
    const message = new TransactionMessage({
        payerKey: walletPublicKey,
        recentBlockhash: blockhash,
        instructions: [instruction],
    });
    
    const transaction = new VersionedTransaction(message.compileToV0Message());
    
    // Sign transaction
    const result = await client.walletApi.solana.signTransaction({
        walletId: wallet.id,
        transaction: transaction
    });
    
    return result;
}
