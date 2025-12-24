import prisma from '../database/client';
import { logger } from '../utils/logger';

/**
 * Test database connection and blogs table
 */
async function testDatabase() {
	try {
		logger.info('🔍 Testing database connection...');

		// Test connection
		await prisma.$connect();
		logger.info('✅ Database connected');

		// Check blogs table structure
		const tableInfo = await prisma.$queryRawUnsafe<any[]>(
			`DESCRIBE blogs`
		);
		logger.info('📋 Blogs table structure:');
		console.table(tableInfo);

		// Count blogs
		const countResult = await prisma.$queryRawUnsafe<any[]>(
			`SELECT 
				COUNT(*) as total,
				SUM(CASE WHEN approved = 1 THEN 1 ELSE 0 END) as approved,
				SUM(CASE WHEN approved = 0 THEN 1 ELSE 0 END) as unapproved
			FROM blogs`
		);
		logger.info('📊 Blogs count:');
		console.table(countResult);

		// Sample recent blogs
		const recentBlogs = await prisma.$queryRawUnsafe<any[]>(
			`SELECT id, platform, title, approved, createdAt 
			FROM blogs 
			ORDER BY createdAt DESC 
			LIMIT 5`
		);
		logger.info('📰 Recent blogs:');
		console.table(recentBlogs);

		// Platform distribution
		const platformStats = await prisma.$queryRawUnsafe<any[]>(
			`SELECT platform, COUNT(*) as count 
			FROM blogs 
			GROUP BY platform`
		);
		logger.info('🏷️  Platform distribution:');
		console.table(platformStats);

		logger.info('✅ Database test completed successfully');

	} catch (error) {
		logger.error('❌ Database test failed:', error);
	} finally {
		await prisma.$disconnect();
	}
}

testDatabase();
