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

/**
 * Initialize database: Test connection and create users table if it doesn't exist
 */
export async function initializeDatabase() {
	try {
		logger.info('🔍 Testing MySQL connection...');

		// Test basic connection
		await prisma.$connect();
		logger.info('✅ MySQL Database connected successfully');

		// Check if users table exists
		try {
			await prisma.$queryRaw`SELECT 1 FROM users LIMIT 1`;
			logger.info('✅ Users table already exists');
		} catch (error: any) {
			// Table doesn't exist, create only users table
			if (error.code === 'P2021' || error.message?.includes('Table') || error.message?.includes('doesn\'t exist')) {
				logger.warn('⚠️  Users table not found. Creating users table...');

				try {
					// Create users table with raw SQL
					await prisma.$executeRawUnsafe(`
						CREATE TABLE IF NOT EXISTS users (
							id VARCHAR(191) NOT NULL PRIMARY KEY,
							createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
							updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
							walletAddress VARCHAR(191) NULL UNIQUE,
							nonce VARCHAR(191) NULL,
							email VARCHAR(191) NULL UNIQUE,
							passwordHash VARCHAR(191) NULL,
							emailVerified BOOLEAN NOT NULL DEFAULT false,
							username VARCHAR(191) NULL,
							displayName VARCHAR(191) NULL,
							avatarUrl VARCHAR(191) NULL,
							role ENUM('USER', 'ADMIN', 'MODERATOR') NOT NULL DEFAULT 'USER',
							INDEX idx_walletAddress (walletAddress),
							INDEX idx_email (email)
						) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
					`);
					logger.info('✅ Users table created successfully');
				} catch (createError) {
					logger.error('❌ Failed to create users table:', createError);
					throw new Error('Users table creation failed');
				}
			} else {
				throw error;
			}
		}

		// Verify users table is ready
		const userCount = await prisma.user.count();
		logger.info(`✅ Database ready. User count: ${userCount}`);

		return true;
	} catch (error) {
		logger.error('❌ Failed to initialize database:', error);
		throw new Error('Database initialization failed');
	}
}

// DO NOT auto-initialize here - will be called explicitly from server.ts
// This prevents multiple initialization attempts

// Graceful shutdown
process.on('beforeExit', async () => {
	await prisma.$disconnect();
});

export default prisma;
