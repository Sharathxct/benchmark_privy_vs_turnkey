import { Turnkey } from "@turnkey/sdk-server";
import { TurnkeySigner } from "@turnkey/solana";
import {
    PublicKey,
    SystemProgram,    
    VersionedTransaction,
    TransactionMessage,
    Connection,
    clusterApiUrl
} from '@solana/web3.js';
import { createNewSolanaWallet } from "../../utils/createSolanaWallet.js";
import { signMessage as turnkeySignMessage } from "../../utils/signMessage.js";
import dotenv from 'dotenv';

dotenv.config();

export const serviceName = 'Turnkey';

// Initialize the service
export async function initializeService() {
    if (!process.env.TURNKEY_ORGANIZATION_ID || !process.env.TURNKEY_API_PRIVATE_KEY || !process.env.TURNKEY_API_PUBLIC_KEY) {
        throw new Error('TURNKEY_ORGANIZATION_ID, TURNKEY_API_PRIVATE_KEY, and TURNKEY_API_PUBLIC_KEY must be set');
    }
    
    const client = new Turnkey({
        defaultOrganizationId: process.env.TURNKEY_ORGANIZATION_ID,
        apiBaseUrl: "https://api.turnkey.com",
        apiPrivateKey: process.env.TURNKEY_API_PRIVATE_KEY,
        apiPublicKey: process.env.TURNKEY_API_PUBLIC_KEY,
    });

    const signer = new TurnkeySigner({
        organizationId: process.env.TURNKEY_ORGANIZATION_ID,
        client: client.apiClient(),
    });
    
    const connection = new Connection(clusterApiUrl('devnet'));
    
    return { client, signer, connection };
}

// Create a new wallet
export async function createWallet(serviceInstance) {
    const { client, signer } = serviceInstance;
    const address = await createNewSolanaWallet(client.apiClient());
    
    return {
        id: address, // For Turnkey, the address serves as the ID
        address: address,
        serviceInstance
    };
}

// Sign a message
export async function signMessage(wallet, message) {
    const { signer } = wallet.serviceInstance;
    
    const result = await turnkeySignMessage({
        signer: signer,
        fromAddress: wallet.address,
        message: message,
    });
    
    return result;
}

// Sign a transaction
export async function signTransaction(wallet, transactionConfig) {
    const { signer, connection } = wallet.serviceInstance;
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
    const signedTransaction = await signer.signTransaction(transaction, wallet.address);
    
    return { signedTransaction };
}
