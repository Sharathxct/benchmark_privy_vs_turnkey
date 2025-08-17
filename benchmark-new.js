import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { discoverServices, initializeServices, createWalletsForServices } from './utils/serviceLoader.js';

dotenv.config();

// Configuration
const BENCHMARK_CONFIG = {
    message: {
        iterations: 50,
        warmupIterations: 5,
        testMessage: "Hello, world! This is a benchmark test message."
    },
    transaction: {
        iterations: 50,
        warmupIterations: 5,
        destinationAddress: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
        transferAmount: 10000
    }
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
        const response = await fetch('http://ip-api.com/json/?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp', {
            timeout: 5000
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

// Benchmark message signing for a service
async function benchmarkMessageSigning(serviceName, serviceModule, wallet, message, iterations, warmupIterations) {
    console.log(`🚀 Running ${serviceName} message signing warmup...`);
    
    // Warmup
    for (let i = 0; i < warmupIterations; i++) {
        await serviceModule.signMessage(wallet, message);
    }
    
    console.log(`📊 Running ${serviceName} message signing benchmark...`);
    const times = [];
    
    for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await serviceModule.signMessage(wallet, message);
        const end = performance.now();
        times.push(end - start);
    }
    
    return times;
}

// Benchmark transaction signing for a service
async function benchmarkTransactionSigning(serviceName, serviceModule, wallet, transactionConfig, iterations, warmupIterations) {
    console.log(`🚀 Running ${serviceName} transaction signing warmup...`);
    
    // Warmup
    for (let i = 0; i < warmupIterations; i++) {
        await serviceModule.signTransaction(wallet, transactionConfig);
    }
    
    console.log(`📊 Running ${serviceName} transaction signing benchmark...`);
    const times = [];
    
    for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await serviceModule.signTransaction(wallet, transactionConfig);
        const end = performance.now();
        times.push(end - start);
    }
    
    return times;
}

// Format and display results
function displayResults(messageResults, transactionResults, config, geoLocation) {
    console.log("\n" + "=".repeat(80));
    console.log("🏆 COMPREHENSIVE BENCHMARK RESULTS");
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
    console.log(`   📝 Message Signing:`);
    console.log(`      • Iterations: ${config.message.iterations}`);
    console.log(`      • Warmup: ${config.message.warmupIterations}`);
    console.log(`      • Message: "${config.message.testMessage}"`);
    console.log(`   💸 Transaction Signing:`);
    console.log(`      • Iterations: ${config.transaction.iterations}`);
    console.log(`      • Warmup: ${config.transaction.warmupIterations}`);
    console.log(`      • Amount: ${config.transaction.transferAmount} lamports (${config.transaction.transferAmount / LAMPORTS_PER_SOL} SOL)`);
    console.log(`      • Destination: ${config.transaction.destinationAddress}`);
    console.log("");
    
    // Display message signing results
    console.log("📝 MESSAGE SIGNING RESULTS:");
    console.log("-".repeat(40));
    const messageServiceNames = Object.keys(messageResults);
    messageServiceNames.forEach((serviceName, index) => {
        const stats = messageResults[serviceName];
        const emoji = index === 0 ? "🔹" : index === 1 ? "🔸" : "🔷";
        
        console.log(`${emoji} ${serviceName.toUpperCase()}:`);
        console.log(`   • Mean: ${stats.mean.toFixed(2)} ms | Median: ${stats.median.toFixed(2)} ms | 95th: ${stats.p95.toFixed(2)} ms`);
    });
    console.log("");
    
    // Display transaction signing results
    console.log("💸 TRANSACTION SIGNING RESULTS:");
    console.log("-".repeat(40));
    const transactionServiceNames = Object.keys(transactionResults);
    transactionServiceNames.forEach((serviceName, index) => {
        const stats = transactionResults[serviceName];
        const emoji = index === 0 ? "🔹" : index === 1 ? "🔸" : "🔷";
        
        console.log(`${emoji} ${serviceName.toUpperCase()}:`);
        console.log(`   • Mean: ${stats.mean.toFixed(2)} ms | Median: ${stats.median.toFixed(2)} ms | 95th: ${stats.p95.toFixed(2)} ms`);
    });
    console.log("");
    
    // Comparisons
    if (messageServiceNames.length >= 2) {
        console.log("🏁 MESSAGE SIGNING COMPARISON:");
        const sortedMessageServices = messageServiceNames.sort((a, b) => messageResults[a].mean - messageResults[b].mean);
        sortedMessageServices.forEach((serviceName, index) => {
            const rank = index + 1;
            const emoji = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `${rank}.`;
            console.log(`   ${emoji} ${serviceName}: ${messageResults[serviceName].mean.toFixed(2)} ms`);
        });
        console.log("");
    }
    
    if (transactionServiceNames.length >= 2) {
        console.log("🏁 TRANSACTION SIGNING COMPARISON:");
        const sortedTransactionServices = transactionServiceNames.sort((a, b) => transactionResults[a].mean - transactionResults[b].mean);
        sortedTransactionServices.forEach((serviceName, index) => {
            const rank = index + 1;
            const emoji = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `${rank}.`;
            console.log(`   ${emoji} ${serviceName}: ${transactionResults[serviceName].mean.toFixed(2)} ms`);
        });
        console.log("");
    }
    
    console.log("=".repeat(80));
}

// Save results to JSON
function saveResults(messageResults, transactionResults, rawTimes, config, geoLocation) {
    const results = {
        timestamp: new Date().toISOString(),
        geoLocation: geoLocation || { success: false, error: "Location data not available" },
        benchmarkType: "comprehensive",
        config: config,
        messageSigning: {
            services: {},
            comparison: {}
        },
        transactionSigning: {
            services: {},
            comparison: {}
        }
    };
    
    // Add message signing results
    Object.keys(messageResults).forEach(serviceName => {
        results.messageSigning.services[serviceName] = {
            rawTimes: rawTimes.message[serviceName],
            statistics: messageResults[serviceName]
        };
    });
    
    // Add transaction signing results
    Object.keys(transactionResults).forEach(serviceName => {
        results.transactionSigning.services[serviceName] = {
            rawTimes: rawTimes.transaction[serviceName],
            statistics: transactionResults[serviceName]
        };
    });
    
    // Add comparison data for message signing
    if (Object.keys(messageResults).length >= 2) {
        const messageServiceNames = Object.keys(messageResults);
        const sortedMessageServices = messageServiceNames.sort((a, b) => messageResults[a].mean - messageResults[b].mean);
        
        results.messageSigning.comparison = {
            fastest: sortedMessageServices[0],
            slowest: sortedMessageServices[sortedMessageServices.length - 1],
            rankings: sortedMessageServices.map((serviceName, index) => ({
                rank: index + 1,
                service: serviceName,
                meanTime: messageResults[serviceName].mean
            }))
        };
    }
    
    // Add comparison data for transaction signing
    if (Object.keys(transactionResults).length >= 2) {
        const transactionServiceNames = Object.keys(transactionResults);
        const sortedTransactionServices = transactionServiceNames.sort((a, b) => transactionResults[a].mean - transactionResults[b].mean);
        
        results.transactionSigning.comparison = {
            fastest: sortedTransactionServices[0],
            slowest: sortedTransactionServices[sortedTransactionServices.length - 1],
            rankings: sortedTransactionServices.map((serviceName, index) => ({
                rank: index + 1,
                service: serviceName,
                meanTime: transactionResults[serviceName].mean
            }))
        };
    }
    
    // Create results directory if it doesn't exist
    const resultsDir = 'results';
    if (!fs.existsSync(resultsDir)) {
        fs.mkdirSync(resultsDir, { recursive: true });
        console.log(`📁 Created results directory: ${resultsDir}`);
    }
    
    const filename = `comprehensive-benchmark-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const filepath = path.join(resultsDir, filename);
    fs.writeFileSync(filepath, JSON.stringify(results, null, 2));
    console.log(`💾 Results saved to: ${filepath}`);
}

// Main benchmark function
async function runComprehensiveBenchmark() {
    try {
        console.log("🚀 Starting Comprehensive Performance Benchmark");
        console.log("=".repeat(80));
        
        // Get geo location information
        console.log("🌍 Fetching geo location information...");
        const geoLocation = await getGeoLocation();
        
        // Discover and initialize services
        console.log("🔍 Discovering services...");
        const services = await discoverServices();
        const serviceNames = Object.keys(services);
        
        if (serviceNames.length === 0) {
            throw new Error('No services found in the services directory');
        }
        
        console.log(`Found ${serviceNames.length} service(s): ${serviceNames.join(', ')}`);
        
        const initializedServices = await initializeServices(services);
        const wallets = await createWalletsForServices(initializedServices);
        
        console.log(`✅ Successfully initialized ${Object.keys(initializedServices).length} service(s)\n`);
        
        // Run message signing benchmarks
        console.log("📝 RUNNING MESSAGE SIGNING BENCHMARKS");
        console.log("=".repeat(80));
        const messageResults = {};
        const messageRawTimes = {};
        
        for (const [serviceName, service] of Object.entries(initializedServices)) {
            if (wallets[serviceName]) {
                console.log(`🔹 ${service.name.toUpperCase()} MESSAGE SIGNING`);
                console.log("-".repeat(40));
                
                const times = await benchmarkMessageSigning(
                    service.name,
                    service.module,
                    wallets[serviceName],
                    BENCHMARK_CONFIG.message.testMessage,
                    BENCHMARK_CONFIG.message.iterations,
                    BENCHMARK_CONFIG.message.warmupIterations
                );
                
                messageResults[service.name] = calculateStats(times);
                messageRawTimes[service.name] = times;
                
                console.log("");
            }
        }
        
        // Run transaction signing benchmarks
        console.log("💸 RUNNING TRANSACTION SIGNING BENCHMARKS");
        console.log("=".repeat(80));
        const transactionResults = {};
        const transactionRawTimes = {};
        
        const transactionConfig = {
            destinationAddress: BENCHMARK_CONFIG.transaction.destinationAddress,
            transferAmount: BENCHMARK_CONFIG.transaction.transferAmount
        };
        
        for (const [serviceName, service] of Object.entries(initializedServices)) {
            if (wallets[serviceName]) {
                console.log(`🔹 ${service.name.toUpperCase()} TRANSACTION SIGNING`);
                console.log("-".repeat(40));
                
                const times = await benchmarkTransactionSigning(
                    service.name,
                    service.module,
                    wallets[serviceName],
                    transactionConfig,
                    BENCHMARK_CONFIG.transaction.iterations,
                    BENCHMARK_CONFIG.transaction.warmupIterations
                );
                
                transactionResults[service.name] = calculateStats(times);
                transactionRawTimes[service.name] = times;
                
                console.log("");
            }
        }
        
        // Display results
        displayResults(messageResults, transactionResults, BENCHMARK_CONFIG, geoLocation);
        
        // Save results
        saveResults(messageResults, transactionResults, {
            message: messageRawTimes,
            transaction: transactionRawTimes
        }, BENCHMARK_CONFIG, geoLocation);
        
    } catch (error) {
        console.error("❌ Comprehensive benchmark failed:", error.message);
        process.exit(1);
    }
}

// Run the benchmark
runComprehensiveBenchmark();
