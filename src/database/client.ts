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
							id INT AUTO_INCREMENT PRIMARY KEY,
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

		// Check if blogs table exists
		try {
			await prisma.$queryRaw`SELECT 1 FROM blogs LIMIT 1`;
			logger.info('✅ Blogs table already exists');
		} catch (error: any) {
			// Table doesn't exist, create blogs table
			if (error.code === 'P2021' || error.message?.includes('Table') || error.message?.includes('doesn\'t exist')) {
				logger.warn('⚠️  Blogs table not found. Creating blogs table...');

				try {
					// Create blogs table with raw SQL
					await prisma.$executeRawUnsafe(`
						CREATE TABLE IF NOT EXISTS blogs (
							id INT AUTO_INCREMENT PRIMARY KEY,
							platform VARCHAR(191) NOT NULL,
							title VARCHAR(500) NOT NULL,
							description TEXT NULL,
							ai_insight TEXT NULL,
							image VARCHAR(500) NULL,
							link VARCHAR(500) NOT NULL,
							approved TINYINT(1) NOT NULL DEFAULT 0,
							createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
							updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
							INDEX idx_platform (platform),
							INDEX idx_approved (approved),
							INDEX idx_createdAt (createdAt)
						) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
					`);
					logger.info('✅ Blogs table created successfully');
				} catch (createError) {
					logger.error('❌ Failed to create blogs table:', createError);
					throw new Error('Blogs table creation failed');
				}
			} else {
				throw error;
			}
		}

		// Verify tables are ready
		const userCount = await prisma.user.count();
		const blogsCount = await prisma.$queryRaw<any[]>`SELECT COUNT(*) as count FROM blogs`;
		logger.info(`✅ Database ready. Users: ${userCount}, Blogs: ${Number(blogsCount[0].count)}`);

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
