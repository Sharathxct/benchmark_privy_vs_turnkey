import { Turnkey } from "@turnkey/sdk-server";
import { TurnkeySigner } from "@turnkey/solana";
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
import { createNewSolanaWallet } from "./utils/createSolanaWallet.js";
import dotenv from 'dotenv';
import fs from 'fs';
import fetch from 'node-fetch';

dotenv.config();

// Configuration
const BENCHMARK_CONFIG = {
    iterations: 50,           // Number of transaction signing operations to test
    warmupIterations: 5,      // Warmup iterations (not counted in results)
    destinationAddress: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM", // Fixed destination
    transferAmount: 10000     // 0.00001 SOL in lamports
};

// Utility functions for statistics
function calculateStats(times) {
    const sorted = [...times].sort((a, b) => a - b);
    const sum = times.reduce((a, b) => a + b, 0);
    const mean = sum / times.length;
    
    const variance = times.reduce((acc, time) => acc + Math.pow(time - mean, 2), 0) / times.length;
    const standardDeviation = Math.sqrt(variance);
    
    const median = sorted.length % 2 === 0
        ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
        : sorted[Math.floor(sorted.length / 2)];
    
    return {
        min: Math.min(...times),
        max: Math.max(...times),
        mean: mean,
        median: median,
        standardDeviation: standardDeviation,
        p95: sorted[Math.floor(sorted.length * 0.95)],
        p99: sorted[Math.floor(sorted.length * 0.99)]
    };
}

// Get geo location information
async function getGeoLocation() {
    try {
        // Using a free IP geolocation service
        const response = await fetch('http://ip-api.com/json/?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp', {
            timeout: 5000 // 5 second timeout
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.status === 'success') {
            return {
                country: data.country,
                countryCode: data.countryCode,
                region: data.regionName,
                city: data.city,
                lat: data.lat,
                lon: data.lon,
                timezone: data.timezone,
                isp: data.isp,
                success: true
            };
        } else {
            console.warn('⚠️  Geo location lookup failed:', data.message);
            return { success: false, error: data.message };
        }
    } catch (error) {
        console.warn('⚠️  Could not fetch geo location:', error.message);
        return { success: false, error: error.message };
    }
}

// Initialize clients
async function initializeClients() {
    // Check environment variables
    if (!process.env.TURNKEY_ORGANIZATION_ID || !process.env.TURNKEY_API_PRIVATE_KEY || !process.env.TURNKEY_API_PUBLIC_KEY) {
        throw new Error('Turnkey environment variables are missing');
    }
    
    if (!process.env.PRIVY_APP_ID || !process.env.PRIVY_APP_SECRET) {
        throw new Error('Privy environment variables are missing');
    }

    // Initialize Turnkey
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

    // Initialize Privy
    const privyClient = new PrivyClient(process.env.PRIVY_APP_ID, process.env.PRIVY_APP_SECRET);

    // Initialize Solana connection
    const connection = new Connection(clusterApiUrl('devnet'));

    return { turnkeyClient, turnkeySigner, privyClient, connection };
}

// Setup wallets
async function setupWallets(turnkeyClient, privyClient) {
    console.log("🔧 Setting up wallets...\n");
    
    // Create Turnkey wallet
    console.log("Creating Turnkey wallet...");
    const turnkeyAddress = await createNewSolanaWallet(turnkeyClient.apiClient());
    
    // Create Privy wallet
    console.log("Creating Privy wallet...");
    const privyWallet = await privyClient.walletApi.createWallet({chainType: 'solana'});
    
    console.log(`✅ Wallets created successfully\n`);
    
    return {
        turnkey: { address: turnkeyAddress },
        privy: { id: privyWallet.id, address: privyWallet.address }
    };
}

// Create transaction for signing
async function createTransaction(fromAddress, connection) {
    const { blockhash } = await connection.getLatestBlockhash();
    
    const walletPublicKey = new PublicKey(fromAddress);
    const destinationPublicKey = new PublicKey(BENCHMARK_CONFIG.destinationAddress);
    
    const instruction = SystemProgram.transfer({
        fromPubkey: walletPublicKey,
        toPubkey: destinationPublicKey,
        lamports: BENCHMARK_CONFIG.transferAmount
    });
    
    const message = new TransactionMessage({
        payerKey: walletPublicKey,
        recentBlockhash: blockhash,
        instructions: [instruction],
    });
    
    return new VersionedTransaction(message.compileToV0Message());
}

// Benchmark Turnkey transaction signing
async function benchmarkTurnkey(signer, address, connection, iterations, warmupIterations) {
    console.log("🚀 Running Turnkey transaction warmup...");
    
    // Warmup
    for (let i = 0; i < warmupIterations; i++) {
        const transaction = await createTransaction(address, connection);
        await signer.signTransaction(transaction, address);
    }
    
    console.log("📊 Running Turnkey transaction benchmark...");
    const times = [];
    
    for (let i = 0; i < iterations; i++) {
        const transaction = await createTransaction(address, connection);
        
        const start = performance.now();
        await signer.signTransaction(transaction, address);
        const end = performance.now();
        
        times.push(end - start);
    }
    
    return times;
}

// Benchmark Privy transaction signing
async function benchmarkPrivy(client, walletId, walletAddress, connection, iterations, warmupIterations) {
    console.log("🚀 Running Privy transaction warmup...");
    
    // Warmup
    for (let i = 0; i < warmupIterations; i++) {
        const transaction = await createTransaction(walletAddress, connection);
        await client.walletApi.solana.signTransaction({
            walletId: walletId,
            transaction: transaction
        });
    }
    
    console.log("📊 Running Privy transaction benchmark...");
    const times = [];
    
    for (let i = 0; i < iterations; i++) {
        const transaction = await createTransaction(walletAddress, connection);
        
        const start = performance.now();
        await client.walletApi.solana.signTransaction({
            walletId: walletId,
            transaction: transaction
        });
        const end = performance.now();
        
        times.push(end - start);
    }
    
    return times;
}

// Format and display results
function displayResults(turnkeyStats, privyStats, config, geoLocation) {
    console.log("\n" + "=".repeat(80));
    console.log("🏆 TRANSACTION SIGNING BENCHMARK RESULTS");
    console.log("=".repeat(80));
    
    // Display timestamp and location info
    const utcTime = new Date().toISOString();
    console.log(`⏰ UTC Time: ${utcTime}`);
    
    if (geoLocation && geoLocation.success) {
        console.log(`🌍 Location: ${geoLocation.city}, ${geoLocation.region}, ${geoLocation.country} (${geoLocation.countryCode})`);
        console.log(`📍 Coordinates: ${geoLocation.lat}, ${geoLocation.lon}`);
        console.log(`🕰️  Timezone: ${geoLocation.timezone}`);
        console.log(`🌐 ISP: ${geoLocation.isp}`);
    } else {
        console.log("🌍 Location: Unable to determine location");
        if (geoLocation && geoLocation.error) {
            console.log(`   Error: ${geoLocation.error}`);
        }
    }
    console.log("");
    
    console.log(`📋 Test Configuration:`);
    console.log(`   • Iterations: ${config.iterations}`);
    console.log(`   • Warmup Iterations: ${config.warmupIterations}`);
    console.log(`   • Transfer Amount: ${config.transferAmount} lamports (${config.transferAmount / LAMPORTS_PER_SOL} SOL)`);
    console.log(`   • Destination: ${config.destinationAddress}`);
    console.log("");
    
    // Turnkey results
    console.log("🔹 TURNKEY TRANSACTION RESULTS:");
    console.log(`   • Min:        ${turnkeyStats.min.toFixed(2)} ms`);
    console.log(`   • Max:        ${turnkeyStats.max.toFixed(2)} ms`);
    console.log(`   • Mean:       ${turnkeyStats.mean.toFixed(2)} ms`);
    console.log(`   • Median:     ${turnkeyStats.median.toFixed(2)} ms`);
    console.log(`   • Std Dev:    ${turnkeyStats.standardDeviation.toFixed(2)} ms`);
    console.log(`   • 95th %ile:  ${turnkeyStats.p95.toFixed(2)} ms`);
    console.log(`   • 99th %ile:  ${turnkeyStats.p99.toFixed(2)} ms`);
    console.log("");
    
    // Privy results
    console.log("🔸 PRIVY TRANSACTION RESULTS:");
    console.log(`   • Min:        ${privyStats.min.toFixed(2)} ms`);
    console.log(`   • Max:        ${privyStats.max.toFixed(2)} ms`);
    console.log(`   • Mean:       ${privyStats.mean.toFixed(2)} ms`);
    console.log(`   • Median:     ${privyStats.median.toFixed(2)} ms`);
    console.log(`   • Std Dev:    ${privyStats.standardDeviation.toFixed(2)} ms`);
    console.log(`   • 95th %ile:  ${privyStats.p95.toFixed(2)} ms`);
    console.log(`   • 99th %ile:  ${privyStats.p99.toFixed(2)} ms`);
    console.log("");
    
    // Comparison
    const turnkeyFaster = turnkeyStats.mean < privyStats.mean;
    const fasterService = turnkeyFaster ? "Turnkey" : "Privy";
    const difference = Math.abs(turnkeyStats.mean - privyStats.mean);
    const percentDifference = ((difference / Math.max(turnkeyStats.mean, privyStats.mean)) * 100);
    
    console.log("🏁 TRANSACTION SIGNING COMPARISON:");
    console.log(`   • ${fasterService} is faster by ${difference.toFixed(2)} ms (${percentDifference.toFixed(1)}%)`);
    console.log(`   • Turnkey Mean: ${turnkeyStats.mean.toFixed(2)} ms`);
    console.log(`   • Privy Mean:   ${privyStats.mean.toFixed(2)} ms`);
    console.log("");
    
    console.log("=".repeat(80));
}

// Save results to JSON
function saveResults(turnkeyTimes, privyTimes, turnkeyStats, privyStats, config, geoLocation) {
    const results = {
        timestamp: new Date().toISOString(),
        geoLocation: geoLocation || { success: false, error: "Location data not available" },
        benchmarkType: "transaction_signing",
        config: config,
        turnkey: {
            rawTimes: turnkeyTimes,
            statistics: turnkeyStats
        },
        privy: {
            rawTimes: privyTimes,
            statistics: privyStats
        },
        comparison: {
            turnkeyFaster: turnkeyStats.mean < privyStats.mean,
            meanDifferenceMs: Math.abs(turnkeyStats.mean - privyStats.mean),
            percentDifference: ((Math.abs(turnkeyStats.mean - privyStats.mean) / Math.max(turnkeyStats.mean, privyStats.mean)) * 100)
        }
    };
    
    const filename = `transaction-benchmark-results-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    fs.writeFileSync(filename, JSON.stringify(results, null, 2));
    console.log(`💾 Results saved to: ${filename}`);
}

// Main benchmark function
async function runTransactionBenchmark() {
    try {
        console.log("🚀 Starting Transaction Signing Performance Benchmark");
        console.log("=".repeat(80));
        
        // Get geo location information
        console.log("🌍 Fetching geo location information...");
        const geoLocation = await getGeoLocation();
        
        // Initialize clients
        const { turnkeyClient, turnkeySigner, privyClient, connection } = await initializeClients();
        
        // Setup wallets
        const wallets = await setupWallets(turnkeyClient, privyClient);
        
        // Run Turnkey benchmark
        console.log("🔹 TURNKEY TRANSACTION BENCHMARK");
        console.log("-".repeat(40));
        const turnkeyTimes = await benchmarkTurnkey(
            turnkeySigner,
            wallets.turnkey.address,
            connection,
            BENCHMARK_CONFIG.iterations,
            BENCHMARK_CONFIG.warmupIterations
        );
        const turnkeyStats = calculateStats(turnkeyTimes);
        
        console.log("\n");
        
        // Run Privy benchmark
        console.log("🔸 PRIVY TRANSACTION BENCHMARK");
        console.log("-".repeat(40));
        const privyTimes = await benchmarkPrivy(
            privyClient,
            wallets.privy.id,
            wallets.privy.address,
            connection,
            BENCHMARK_CONFIG.iterations,
            BENCHMARK_CONFIG.warmupIterations
        );
        const privyStats = calculateStats(privyTimes);
        
        // Display results
        displayResults(turnkeyStats, privyStats, BENCHMARK_CONFIG, geoLocation);
        
        // Save results
        saveResults(turnkeyTimes, privyTimes, turnkeyStats, privyStats, BENCHMARK_CONFIG, geoLocation);
        
    } catch (error) {
        console.error("❌ Transaction benchmark failed:", error.message);
        process.exit(1);
    }
}

// Run the benchmark
runTransactionBenchmark();
