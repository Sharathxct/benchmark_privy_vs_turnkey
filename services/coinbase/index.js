import {
    Connection,
    PublicKey,
    SystemProgram,
    Transaction,
    VersionedTransaction,
    TransactionMessage,
} from "@solana/web3.js";
import { CdpClient } from "@coinbase/cdp-sdk";
import dotenv from "dotenv";

dotenv.config();

export const serviceName = 'Coinbase';

// Initialize the service
export async function initializeService() {
    // Coinbase CDP doesn't require explicit credentials in the same way
    // The SDK handles authentication automatically
    const client = new CdpClient();
    const connection = new Connection("https://api.devnet.solana.com");
    
    return { client, connection };
}

// Create a new wallet
export async function createWallet(serviceInstance) {
    const { client } = serviceInstance;
    
    // Create Coinbase CDP Solana account
    const account = await client.solana.createAccount();
    
    return {
        id: account.address, // Coinbase uses address as ID
        address: account.address,
        serviceInstance
    };
}

// Sign a message
export async function signMessage(wallet, message) {
    const { client } = wallet.serviceInstance;
    
    // Coinbase CDP has message signing capability
    // Note: The exact API might vary, this is based on the pattern
    const result = await client.solana.signMessage({
        address: wallet.address,
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
    
    // Create transaction using legacy Transaction format (as per Coinbase pattern)
    const fromAddress = new PublicKey(wallet.address);
    const toAddress = new PublicKey(destinationAddress);
    
    const transaction = new Transaction();
    transaction.add(
        SystemProgram.transfer({
            fromPubkey: fromAddress,
            toPubkey: toAddress,
            lamports: transferAmount,
        })
    );
    
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = fromAddress;
    
    // Serialize transaction for Coinbase signing
    const serializedTx = Buffer.from(
        transaction.serialize({ requireAllSignatures: false })
    ).toString("base64");
    
    // Sign transaction with Coinbase CDP
    const result = await client.solana.signTransaction({
        address: wallet.address,
        transaction: serializedTx,
    });
    
    return result;
}