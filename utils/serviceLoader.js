import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Discover all services in the services directory
export async function discoverServices() {
    const servicesDir = path.join(__dirname, '../services');
    const services = {};
    
    try {
        const serviceDirs = fs.readdirSync(servicesDir, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);
        
        for (const serviceDir of serviceDirs) {
            const servicePath = path.join(servicesDir, serviceDir, 'index.js');
            
            if (fs.existsSync(servicePath)) {
                try {
                    const serviceModule = await import(`../services/${serviceDir}/index.js`);
                    services[serviceDir] = serviceModule;
                } catch (error) {
                    console.warn(`⚠️  Failed to load service ${serviceDir}:`, error.message);
                }
            }
        }
        
        return services;
    } catch (error) {
        console.error('❌ Failed to discover services:', error.message);
        return {};
    }
}

// Initialize all discovered services
export async function initializeServices(services) {
    const initializedServices = {};
    
    for (const [serviceName, serviceModule] of Object.entries(services)) {
        try {
            console.log(`🔧 Initializing ${serviceModule.serviceName || serviceName}...`);
            const serviceInstance = await serviceModule.initializeService();
            initializedServices[serviceName] = {
                name: serviceModule.serviceName || serviceName,
                module: serviceModule,
                instance: serviceInstance
            };
        } catch (error) {
            console.warn(`⚠️  Failed to initialize ${serviceName}:`, error.message);
        }
    }
    
    return initializedServices;
}

// Create wallets for all services
export async function createWalletsForServices(initializedServices) {
    const wallets = {};
    
    for (const [serviceName, service] of Object.entries(initializedServices)) {
        try {
            console.log(`Creating wallet for ${service.name}...`);
            const wallet = await service.module.createWallet(service.instance);
            wallets[serviceName] = {
                ...wallet,
                serviceName: service.name
            };
        } catch (error) {
            console.error(`❌ Failed to create wallet for ${service.name}:`, error.message);
        }
    }
    
    return wallets;
}
