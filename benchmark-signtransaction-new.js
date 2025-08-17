import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { discoverServices, initializeServices, createWalletsForServices } from './utils/serviceLoader.js';

dotenv.config();

// Configuration
const BENCHMARK_CONFIG = {
    iterations: 10,           // Number of transaction signing operations to test
    warmupIterations: 2,      // Warmup iterations (not counted in results)
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

// Benchmark a single service for transaction signing
async function benchmarkService(serviceName, serviceModule, wallet, transactionConfig, iterations, warmupIterations) {
    console.log(`🚀 Running ${serviceName} transaction warmup...`);
    
    // Warmup
    for (let i = 0; i < warmupIterations; i++) {
        await serviceModule.signTransaction(wallet, transactionConfig);
    }
    
    console.log(`📊 Running ${serviceName} transaction benchmark...`);
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
function displayResults(serviceResults, config, geoLocation) {
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
    
    // Display results for each service
    const serviceNames = Object.keys(serviceResults);
    serviceNames.forEach((serviceName, index) => {
        const stats = serviceResults[serviceName];
        const emoji = index === 0 ? "🔹" : index === 1 ? "🔸" : "🔷";
        
        console.log(`${emoji} ${serviceName.toUpperCase()} TRANSACTION RESULTS:`);
        console.log(`   • Min:        ${stats.min.toFixed(2)} ms`);
        console.log(`   • Max:        ${stats.max.toFixed(2)} ms`);
        console.log(`   • Mean:       ${stats.mean.toFixed(2)} ms`);
        console.log(`   • Median:     ${stats.median.toFixed(2)} ms`);
        console.log(`   • Std Dev:    ${stats.standardDeviation.toFixed(2)} ms`);
        console.log(`   • 95th %ile:  ${stats.p95.toFixed(2)} ms`);
        console.log(`   • 99th %ile:  ${stats.p99.toFixed(2)} ms`);
        console.log("");
    });
    
    // Comparison
    if (serviceNames.length >= 2) {
        console.log("🏁 TRANSACTION SIGNING COMPARISON:");
        const sortedServices = serviceNames.sort((a, b) => serviceResults[a].mean - serviceResults[b].mean);
        const fastest = sortedServices[0];
        const slowest = sortedServices[sortedServices.length - 1];
        
        console.log(`   • Fastest: ${fastest} (${serviceResults[fastest].mean.toFixed(2)} ms)`);
        console.log(`   • Slowest: ${slowest} (${serviceResults[slowest].mean.toFixed(2)} ms)`);
        
        if (fastest !== slowest) {
            const difference = serviceResults[slowest].mean - serviceResults[fastest].mean;
            const percentDifference = (difference / serviceResults[slowest].mean) * 100;
            console.log(`   • Difference: ${difference.toFixed(2)} ms (${percentDifference.toFixed(1)}% faster)`);
        }
        
        console.log("");
        sortedServices.forEach(serviceName => {
            console.log(`   • ${serviceName}: ${serviceResults[serviceName].mean.toFixed(2)} ms`);
        });
        console.log("");
    }
    
    console.log("=".repeat(80));
}

// Save results to JSON
function saveResults(serviceResults, rawTimes, config, geoLocation) {
    const results = {
        timestamp: new Date().toISOString(),
        geoLocation: geoLocation || { success: false, error: "Location data not available" },
        benchmarkType: "transaction_signing",
        config: config,
        services: {},
        comparison: {}
    };
    
    // Add service results
    Object.keys(serviceResults).forEach(serviceName => {
        results.services[serviceName] = {
            rawTimes: rawTimes[serviceName],
            statistics: serviceResults[serviceName]
        };
    });
    
    // Add comparison data
    if (Object.keys(serviceResults).length >= 2) {
        const serviceNames = Object.keys(serviceResults);
        const sortedServices = serviceNames.sort((a, b) => serviceResults[a].mean - serviceResults[b].mean);
        
        results.comparison = {
            fastest: sortedServices[0],
            slowest: sortedServices[sortedServices.length - 1],
            rankings: sortedServices.map((serviceName, index) => ({
                rank: index + 1,
                service: serviceName,
                meanTime: serviceResults[serviceName].mean
            }))
        };
    }
    
    // Create results directory if it doesn't exist
    const resultsDir = 'results';
    if (!fs.existsSync(resultsDir)) {
        fs.mkdirSync(resultsDir, { recursive: true });
        console.log(`📁 Created results directory: ${resultsDir}`);
    }
    
    const filename = `transaction-signing-benchmark-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const filepath = path.join(resultsDir, filename);
    fs.writeFileSync(filepath, JSON.stringify(results, null, 2));
    console.log(`💾 Results saved to: ${filepath}`);
}

// Main benchmark function
async function runTransactionSigningBenchmark() {
    try {
        console.log("🚀 Starting Transaction Signing Performance Benchmark");
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
        
        // Run benchmarks for each service
        const serviceResults = {};
        const rawTimes = {};
        
        const transactionConfig = {
            destinationAddress: BENCHMARK_CONFIG.destinationAddress,
            transferAmount: BENCHMARK_CONFIG.transferAmount
        };
        
        for (const [serviceName, service] of Object.entries(initializedServices)) {
            if (wallets[serviceName]) {
                console.log(`🔹 ${service.name.toUpperCase()} TRANSACTION BENCHMARK`);
                console.log("-".repeat(40));
                
                const times = await benchmarkService(
                    service.name,
                    service.module,
                    wallets[serviceName],
                    transactionConfig,
                    BENCHMARK_CONFIG.iterations,
                    BENCHMARK_CONFIG.warmupIterations
                );
                
                serviceResults[service.name] = calculateStats(times);
                rawTimes[service.name] = times;
                
                console.log("");
            }
        }
        
        // Display results
        displayResults(serviceResults, BENCHMARK_CONFIG, geoLocation);
        
        // Save results
        saveResults(serviceResults, rawTimes, BENCHMARK_CONFIG, geoLocation);
        
    } catch (error) {
        console.error("❌ Transaction benchmark failed:", error.message);
        process.exit(1);
    }
}

// Run the benchmark
runTransactionSigningBenchmark();
