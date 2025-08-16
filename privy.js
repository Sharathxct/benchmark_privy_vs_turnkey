import {PrivyClient} from '@privy-io/server-auth';
import dotenv from 'dotenv';

dotenv.config();

const { PRIVY_APP_ID, PRIVY_APP_SECRET } = process.env;

if (!PRIVY_APP_ID || !PRIVY_APP_SECRET) {
    console.error('PRIVY_APP_ID and PRIVY_APP_SECRET must be set');
    process.exit(1);
}

const privy = new PrivyClient(PRIVY_APP_ID, PRIVY_APP_SECRET);

// Create a wallet
const {id, address, chainType} = await privy.walletApi.createWallet({chainType: 'solana'});

console.log("Wallet ID: ", id);
console.log("Wallet Address: ", address);
console.log("Wallet Chain Type: ", chainType);

const t0 = performance.now();
// Get the signature and encoding from the response
const {signature, encoding} = await privy.walletApi.solana.signMessage({
    walletId: id,
    message: 'Hello world'
});
const t1 = performance.now();

console.log("Signature: ", signature);
console.log("Encoding: ", encoding);
console.log("Time taken: ", t1 - t0, "ms");