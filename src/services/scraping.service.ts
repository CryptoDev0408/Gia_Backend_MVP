import { InstagramFashionSource } from '../sources/instagram.source';
import { ScrapingConditions, ScrapedPostData } from '../sources/base.source';
import { logger } from '../utils/logger';

/**
 * Scraping Service
 * Manages the lifecycle of Instagram fashion scraping
 * Starts async when server runs and can be stopped/restarted
 */
export class ScrapingService {
	private instagramSource: InstagramFashionSource;
	private isRunning: boolean = false;
	private scrapingInterval: NodeJS.Timeout | null = null;
	private defaultConditions: ScrapingConditions;

	constructor() {
		this.instagramSource = new InstagramFashionSource();

		// Default fashion-focused scraping conditions
		this.defaultConditions = {
			hashtags: ['fashion'],
			keywords: ['runway', 'designer', 'style', 'outfit', 'trend'],
			maxResults: 30,
			maxPostsPerHashtag: 5,
			pageTimeout: 30000,
			scrollTimeout: 2000,
			navigationTimeout: 15000,
			minLikes: 100,
		};
	}

	/**
	 * Start scraping service (runs async)
	 * Called when server starts
	 */
	async start(conditions?: ScrapingConditions, intervalMinutes: number = 60): Promise<void> {
		try {
			if (this.isRunning) {
				logger.warn('Scraping service is already running');
				return;
			}

			this.isRunning = true;
			const scrapingConditions = { ...this.defaultConditions, ...conditions };

			logger.info('Starting scraping service...', {
				interval: `${intervalMinutes} minutes`,
				conditions: scrapingConditions
			});

			// Initialize the Instagram scraper
			await this.instagramSource.initialize();

			// Run first scrape immediately (async)
			this.runScrapeAsync(scrapingConditions);

			// Schedule periodic scraping
			this.scrapingInterval = setInterval(() => {
				this.runScrapeAsync(scrapingConditions);
			}, intervalMinutes * 60 * 1000);

			logger.info(`Scraping service started successfully. Will run every ${intervalMinutes} minutes`);

		} catch (error) {
			logger.error('Failed to start scraping service:', error);
			this.isRunning = false;
			throw error;
		}
	}

	/**
	 * Stop scraping service
	 */
	async stop(): Promise<void> {
		try {
			if (!this.isRunning) {
				logger.warn('Scraping service is not running');
				return;
			}

			logger.info('Stopping scraping service...');

			// Clear interval
			if (this.scrapingInterval) {
				clearInterval(this.scrapingInterval);
				this.scrapingInterval = null;
			}

			// Cleanup scraper
			await this.instagramSource.cleanup();

			this.isRunning = false;
			logger.info('Scraping service stopped successfully');

		} catch (error) {
			logger.error('Error stopping scraping service:', error);
			throw error;
		}
	}

	/**
	 * Run a single scrape operation (async, non-blocking)
	 */
	private runScrapeAsync(conditions: ScrapingConditions): void {
		// Run async without blocking
		this.scrape(conditions)
			.then(posts => {
				logger.info(`Scraping completed successfully. Found ${posts.length} posts`);
				// Here you would normally save to database
				// For now, just log the summary
				this.logScrapingSummary(posts);
			})
			.catch(error => {
				logger.error('Scraping failed:', error);
			});
	}

	/**
	 * Perform a manual scrape operation
	 */
	async scrape(conditions?: ScrapingConditions): Promise<ScrapedPostData[]> {
		try {
			const scrapingConditions = { ...this.defaultConditions, ...conditions };

			logger.info('Running manual scrape...', { conditions: scrapingConditions });

			// Ensure scraper is initialized
			await this.instagramSource.initialize();

			// Scrape Instagram
			const posts = await this.instagramSource.scrape(scrapingConditions);

			logger.info(`Manual scrape completed. Found ${posts.length} posts`);

			return posts;

		} catch (error) {
			logger.error('Manual scrape failed:', error);
			throw error;
		}
	}

	/**
	 * Test scraper connection
	 */
	async testConnection(): Promise<boolean> {
		try {
			await this.instagramSource.initialize();
			return await this.instagramSource.testConnection();
		} catch (error) {
			logger.error('Connection test failed:', error);
			return false;
		}
	}

	/**
	 * Get service status
	 */
	getStatus(): { isRunning: boolean; conditions: ScrapingConditions } {
		return {
			isRunning: this.isRunning,
			conditions: this.defaultConditions
		};
	}

	/**
	 * Log scraping summary
	 */
	private logScrapingSummary(posts: ScrapedPostData[]): void {
		if (posts.length === 0) {
			logger.info('No posts found in this scraping cycle');
			return;
		}

		const totalLikes = posts.reduce((sum, post) => sum + (post.likes || 0), 0);
		const avgLikes = Math.round(totalLikes / posts.length);

		logger.info('Scraping Summary:', {
			totalPosts: posts.length,
			totalLikes,
			avgLikes,
			topPost: posts[0] ? {
				author: posts[0].author,
				likes: posts[0].likes,
				url: posts[0].sourceUrl
			} : null
		});
	}
}

// Export singleton instance
export const scrapingService = new ScrapingService();
