import { Turnkey } from "@turnkey/sdk-server";
import { TurnkeySigner } from "@turnkey/solana";
import { PrivyClient } from '@privy-io/server-auth';
import { createNewSolanaWallet } from "./utils/createSolanaWallet.js";
import { signMessage } from "./utils/signMessage.js";
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

// Configuration
const BENCHMARK_CONFIG = {
    iterations: 50,           // Number of signing operations to test
    warmupIterations: 5,      // Warmup iterations (not counted in results)
    message: "Hello, world! This is a benchmark test message."
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

    return { turnkeyClient, turnkeySigner, privyClient };
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

// Benchmark Turnkey signing
async function benchmarkTurnkey(signer, address, message, iterations, warmupIterations) {
    console.log("🚀 Running Turnkey warmup...");
    
    // Warmup
    for (let i = 0; i < warmupIterations; i++) {
        await signMessage({
            signer: signer,
            fromAddress: address,
            message: message,
        });
    }
    
    console.log("📊 Running Turnkey benchmark...");
    const times = [];
    
    for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await signMessage({
            signer: signer,
            fromAddress: address,
            message: message,
        });
        const end = performance.now();
        times.push(end - start);
    }
    
    return times;
}

// Benchmark Privy signing
async function benchmarkPrivy(client, walletId, message, iterations, warmupIterations) {
    console.log("🚀 Running Privy warmup...");
    
    // Warmup
    for (let i = 0; i < warmupIterations; i++) {
        await client.walletApi.solana.signMessage({
            walletId: walletId,
            message: message
        });
    }
    
    console.log("📊 Running Privy benchmark...");
    const times = [];
    
    for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await client.walletApi.solana.signMessage({
            walletId: walletId,
            message: message
        });
        const end = performance.now();
        times.push(end - start);
    }
    
    return times;
}

// Format and display results
function displayResults(turnkeyStats, privyStats, config) {
    console.log("\n" + "=".repeat(80));
    console.log("🏆 BENCHMARK RESULTS");
    console.log("=".repeat(80));
    
    console.log(`📋 Test Configuration:`);
    console.log(`   • Iterations: ${config.iterations}`);
    console.log(`   • Warmup Iterations: ${config.warmupIterations}`);
    console.log(`   • Message: "${config.message}"`);
    console.log("");
    
    // Turnkey results
    console.log("🔹 TURNKEY RESULTS:");
    console.log(`   • Min:        ${turnkeyStats.min.toFixed(2)} ms`);
    console.log(`   • Max:        ${turnkeyStats.max.toFixed(2)} ms`);
    console.log(`   • Mean:       ${turnkeyStats.mean.toFixed(2)} ms`);
    console.log(`   • Median:     ${turnkeyStats.median.toFixed(2)} ms`);
    console.log(`   • Std Dev:    ${turnkeyStats.standardDeviation.toFixed(2)} ms`);
    console.log(`   • 95th %ile:  ${turnkeyStats.p95.toFixed(2)} ms`);
    console.log(`   • 99th %ile:  ${turnkeyStats.p99.toFixed(2)} ms`);
    console.log("");
    
    // Privy results
    console.log("🔸 PRIVY RESULTS:");
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
    
    console.log("🏁 COMPARISON:");
    console.log(`   • ${fasterService} is faster by ${difference.toFixed(2)} ms (${percentDifference.toFixed(1)}%)`);
    console.log(`   • Turnkey Mean: ${turnkeyStats.mean.toFixed(2)} ms`);
    console.log(`   • Privy Mean:   ${privyStats.mean.toFixed(2)} ms`);
    console.log("");
    
    console.log("=".repeat(80));
}

// Save results to JSON
function saveResults(turnkeyTimes, privyTimes, turnkeyStats, privyStats, config) {
    const results = {
        timestamp: new Date().toISOString(),
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
    
    const filename = `benchmark-results-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    fs.writeFileSync(filename, JSON.stringify(results, null, 2));
    console.log(`💾 Results saved to: ${filename}`);
}

// Main benchmark function
async function runBenchmark() {
    try {
        console.log("🚀 Starting Wallet Signing Performance Benchmark");
        console.log("=".repeat(80));
        
        // Initialize clients
        const { turnkeyClient, turnkeySigner, privyClient } = await initializeClients();
        
        // Setup wallets
        const wallets = await setupWallets(turnkeyClient, privyClient);
        
        // Run Turnkey benchmark
        console.log("🔹 TURNKEY BENCHMARK");
        console.log("-".repeat(40));
        const turnkeyTimes = await benchmarkTurnkey(
            turnkeySigner,
            wallets.turnkey.address,
            BENCHMARK_CONFIG.message,
            BENCHMARK_CONFIG.iterations,
            BENCHMARK_CONFIG.warmupIterations
        );
        const turnkeyStats = calculateStats(turnkeyTimes);
        
        console.log("\n");
        
        // Run Privy benchmark
        console.log("🔸 PRIVY BENCHMARK");
        console.log("-".repeat(40));
        const privyTimes = await benchmarkPrivy(
            privyClient,
            wallets.privy.id,
            BENCHMARK_CONFIG.message,
            BENCHMARK_CONFIG.iterations,
            BENCHMARK_CONFIG.warmupIterations
        );
        const privyStats = calculateStats(privyTimes);
        
        // Display results
        displayResults(turnkeyStats, privyStats, BENCHMARK_CONFIG);
        
        // Save results
        saveResults(turnkeyTimes, privyTimes, turnkeyStats, privyStats, BENCHMARK_CONFIG);
        
    } catch (error) {
        console.error("❌ Benchmark failed:", error.message);
        process.exit(1);
    }
}

// Run the benchmark
runBenchmark();
