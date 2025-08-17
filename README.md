# MPC Key Storage Service Benchmarking

A standardized benchmarking framework for comparing performance across multiple MPC (Multi-Party Computation) key storage services.

## 🏗️ Architecture

This repository uses a modular architecture that makes it easy to add new MPC services without rewriting benchmarking code.

### Directory Structure

```
├── services/              # Individual service implementations
│   ├── privy/            # Privy service implementation
│   │   └── index.js      # Standard interface implementation
│   ├── turnkey/          # Turnkey service implementation
│   │   └── index.js      # Standard interface implementation
│   └── [new-service]/    # Add new services here
├── utils/                # Utility functions
│   ├── serviceLoader.js  # Service discovery and loading
│   ├── createSolanaWallet.js
│   └── signMessage.js
├── results/              # Benchmark results (auto-created)
└── benchmark scripts...  # Main benchmark files
```

## 🚀 Quick Start

### Available Benchmarks

1. **Comprehensive Benchmark** - Tests both message and transaction signing
   ```bash
   npm run benchmark
   ```

2. **Message Signing Only**
   ```bash
   npm run benchmark-message
   ```

3. **Transaction Signing Only**
   ```bash
   npm run benchmark-transaction
   ```

### Prerequisites

1. Create a `.env` file with your service credentials:
   ```env
   # Privy
   PRIVY_APP_ID=your_app_id
   PRIVY_APP_SECRET=your_app_secret
   
   # Turnkey
   TURNKEY_ORGANIZATION_ID=your_org_id
   TURNKEY_API_PRIVATE_KEY=your_private_key
   TURNKEY_API_PUBLIC_KEY=your_public_key
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

## 📊 Features

- **Automatic Service Discovery**: Automatically finds and tests all services in the `services/` directory
- **Standardized Interface**: All services implement the same interface for fair comparison
- **Comprehensive Metrics**: Min, max, mean, median, standard deviation, 95th and 99th percentiles
- **Geographic Tracking**: Logs location and timezone for regional performance analysis
- **Fair Benchmarking**: Only measures the actual signing operation, excluding setup time
- **Structured Results**: Results saved as JSON in the `results/` directory

## 🔧 Adding a New Service

To add a new MPC service (e.g., Coinbase, AWS KMS, etc.):

1. **Create Service Directory**:
   ```bash
   mkdir services/your-service-name
   ```

2. **Implement Standard Interface** (`services/your-service-name/index.js`):
   ```javascript
   export const serviceName = 'YourServiceName';
   
   export async function initializeService() {
       // Initialize your service client
       // Return service instance
   }
   
   export async function createWallet(serviceInstance) {
       // Create a new wallet
       // Return { id, address, serviceInstance }
   }
   
   export async function signMessage(wallet, message) {
       // Sign a message
       // Return signature result
   }
   
   export async function signTransaction(wallet, transactionConfig) {
       // Sign a transaction with { destinationAddress, transferAmount }
       // Return signed transaction
   }
   ```

3. **Add Environment Variables** (if needed) to `.env`

4. **Run Benchmarks** - Your service will be automatically discovered and included!

## 📈 Benchmark Results

Results include:

- **Timestamps**: Precise UTC timing
- **Geographic Data**: Location, timezone, ISP for regional analysis
- **Performance Metrics**: Comprehensive statistical analysis
- **Service Rankings**: Automatic comparison and ranking
- **Raw Data**: All individual timing measurements for detailed analysis

### Sample Output

```
🏆 COMPREHENSIVE BENCHMARK RESULTS
================================================================================
⏰ UTC Time: 2025-08-16T19:30:00.000Z
🌍 Location: San Francisco, California, United States (US)
📍 Coordinates: 37.7749, -122.4194
🕰️ Timezone: America/Los_Angeles
🌐 ISP: Cloudflare Inc

📝 MESSAGE SIGNING RESULTS:
🔹 PRIVY: Mean: 245.67 ms | Median: 234.12 ms | 95th: 298.45 ms
🔸 TURNKEY: Mean: 189.34 ms | Median: 178.56 ms | 95th: 234.67 ms

💸 TRANSACTION SIGNING RESULTS:
🔹 PRIVY: Mean: 378.92 ms | Median: 367.45 ms | 95th: 445.23 ms
🔸 TURNKEY: Mean: 312.67 ms | Median: 301.89 ms | 95th: 378.45 ms

🏁 MESSAGE SIGNING COMPARISON:
🥇 TURNKEY: 189.34 ms
🥈 PRIVY: 245.67 ms

🏁 TRANSACTION SIGNING COMPARISON:
🥇 TURNKEY: 312.67 ms
🥈 PRIVY: 378.92 ms
```

## 🎯 Benchmarking Methodology

- **Warmup Runs**: Each service gets warmup iterations to eliminate cold start effects
- **Isolated Timing**: Only the actual signing operation is measured
- **Statistical Analysis**: Multiple iterations with comprehensive statistical analysis
- **Fair Comparison**: All services use identical test conditions and data

## 📁 Results Storage

All benchmark results are automatically saved to the `results/` directory with timestamps and comprehensive metadata for historical analysis and comparison.

## 🤝 Contributing

To contribute a new service implementation:

1. Follow the standard interface pattern
2. Ensure proper error handling
3. Add appropriate environment variable documentation
4. Test your implementation thoroughly

The modular architecture ensures that adding new services is straightforward and doesn't affect existing implementations.
