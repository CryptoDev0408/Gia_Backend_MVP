import cron from 'node-cron';
import { config } from '../config';
import { logger } from '../utils/logger';
import { ScrapingService } from '../services/scraping.service';
import { NormalizationService } from '../services/normalization.service';
import { ClusteringService } from '../services/clustering.service';
import { AIInsightService } from '../services/ai-insight.service';

/**
 * Cron Job Scheduler
 * Manages automated scraping and processing
 */
export class CronScheduler {
	private static jobs: cron.ScheduledTask[] = [];

	/**
	 * Start all scheduled jobs
	 */
	static start() {
		if (!config.scraping.enabled) {
			logger.info('Scraping is disabled, cron jobs will not start');
			return;
		}

		logger.info('Starting cron job scheduler');

		// Main scraping and processing pipeline
		// Runs every 6 hours (or as configured)
		const scrapingJob = cron.schedule(`*/${config.scraping.intervalMinutes} * * * *`, async () => {
			logger.info('🚀 Starting scheduled scraping pipeline');

			try {
				// Step 1: Scrape all platforms
				logger.info('📥 Step 1/4: Scraping posts');
				await ScrapingService.scrapeAll();

				// Step 2: Normalize new posts
				logger.info('🧹 Step 2/4: Normalizing posts');
				await NormalizationService.processAll();

				// Step 3: Cluster posts
				logger.info('🔗 Step 3/4: Clustering posts');
				await ClusteringService.clusterAll();
				await ClusteringService.calculateGrowthRates();

				// Step 4: Generate AI insights
				logger.info('🤖 Step 4/4: Generating AI insights');
				await AIInsightService.generateAllInsights();

				logger.info('✅ Scraping pipeline completed successfully');
			} catch (error) {
				logger.error('❌ Scraping pipeline failed:', error);
			}
		});

		this.jobs.push(scrapingJob);

		// Cleanup old data - runs daily at 2 AM
		const cleanupJob = cron.schedule('0 2 * * *', async () => {
			logger.info('🧹 Running daily cleanup');
			await this.cleanupOldData();
		});

		this.jobs.push(cleanupJob);

		logger.info(`Cron jobs started: ${this.jobs.length} jobs scheduled`);
	}

	/**
	 * Stop all scheduled jobs
	 */
	static stop() {
		logger.info('Stopping cron job scheduler');

		for (const job of this.jobs) {
			job.stop();
		}

		this.jobs = [];
		logger.info('All cron jobs stopped');
	}

	/**
	 * Cleanup old data
	 */
	private static async cleanupOldData() {
		try {
			const { PrismaClient } = await import('@prisma/client');
			const prisma = new PrismaClient();

			// Delete scraped posts older than 30 days that are processed
			const thirtyDaysAgo = new Date();
			thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

			const deleted = await prisma.scrapedPost.deleteMany({
				where: {
					isProcessed: true,
					createdAt: {
						lt: thirtyDaysAgo,
					},
				},
			});

			logger.info(`Cleaned up ${deleted.count} old scraped posts`);

			// Mark inactive clusters
			const sevenDaysAgo = new Date();
			sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

			await prisma.trendCluster.updateMany({
				where: {
					lastSeenAt: {
						lt: sevenDaysAgo,
					},
					isActive: true,
				},
				data: {
					isActive: false,
				},
			});

			logger.info('Marked inactive clusters');

			await prisma.$disconnect();
		} catch (error) {
			logger.error('Cleanup failed:', error);
		}
	}

	/**
	 * Manually trigger scraping pipeline
	 */
	static async runManual() {
		logger.info('🚀 Manually triggering scraping pipeline');

		try {
			await ScrapingService.scrapeAll();
			await NormalizationService.processAll();
			await ClusteringService.clusterAll();
			await ClusteringService.calculateGrowthRates();
			await AIInsightService.generateAllInsights();

			logger.info('✅ Manual pipeline completed');
			return { success: true };
		} catch (error: any) {
			logger.error('❌ Manual pipeline failed:', error);
			return { success: false, error: error.message };
		}
	}
}
