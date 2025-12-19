import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient({
	log: [
		{ level: 'query', emit: 'event' },
		{ level: 'error', emit: 'stdout' },
		{ level: 'warn', emit: 'stdout' },
	],
});

// Log queries in development
if (process.env.NODE_ENV === 'development') {
	prisma.$on('query' as never, (e: any) => {
		logger.debug('Query: ' + e.query);
		logger.debug('Duration: ' + e.duration + 'ms');
	});
}

// Test database connection
async function testConnection() {
	try {
		await prisma.$connect();
		logger.info('✅ MySQL Database connected successfully');
	} catch (error) {
		logger.error('❌ Failed to connect to MySQL Database:', error);
		throw new Error('Database connection failed');
	}
}

// Test connection on startup
testConnection();

// Graceful shutdown
process.on('beforeExit', async () => {
	await prisma.$disconnect();
});

export default prisma;
