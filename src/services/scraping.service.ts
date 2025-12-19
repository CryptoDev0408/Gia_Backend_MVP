import prisma from '../database/client';
import { SourceFactory } from '../sources';
import { logger } from '../utils/logger';
import { ScrapingOptions } from '../sources/base.source';

/**
 * Scraping Service
 * Coordinates scraping from all social media sources
 */
export class ScrapingService {
	/**
	 * Scrape all platforms
	 */
	static async scrapeAll(options: ScrapingOptions = {}) {
		const platforms: ('TWITTER' | 'INSTAGRAM')[] = ['TWITTER', 'INSTAGRAM'];
		const results: any = {};

		for (const platform of platforms) {
			try {
				logger.info(`Starting scrape for ${platform}`);

				// Create job record
				const job = await prisma.scrapingJob.create({
					data: {
						platform,
						status: 'RUNNING',
						startedAt: new Date(),
					},
				});

				try {
					const posts = await this.scrapePlatform(platform, options);

					// Update job success
					await prisma.scrapingJob.update({
						where: { id: job.id },
						data: {
							status: 'COMPLETED',
							completedAt: new Date(),
							postsScraped: posts.length,
						},
					});

					results[platform] = {
						success: true,
						count: posts.length,
					};
				} catch (error: any) {
					// Update job failure
					await prisma.scrapingJob.update({
						where: { id: job.id },
						data: {
							status: 'FAILED',
							completedAt: new Date(),
							errorMessage: error.message,
						},
					});

					results[platform] = {
						success: false,
						error: error.message,
					};
				}
			} catch (error: any) {
				logger.error(`Scraping failed for ${platform}:`, error);
				results[platform] = {
					success: false,
					error: error.message,
				};
			}
		}

		return results;
	}

	/**
	 * Scrape single platform
	 */
	static async scrapePlatform(
		platform: 'TWITTER' | 'INSTAGRAM',
		options: ScrapingOptions = {}
	) {
		const source = SourceFactory.getSource(platform);

		// Initialize if needed
		await source.initialize();

		// Scrape posts
		const scrapedPosts = await source.scrape({
			maxPosts: options.maxPosts || 100,
			keywords: options.keywords || ['fashion', 'style', 'outfit', 'streetwear'],
			hashtags: options.hashtags || ['fashion', 'style', 'ootd', 'streetwear'],
		});

		// Save to database
		const savedPosts = [];
		for (const post of scrapedPosts) {
			try {
				// Check if post already exists
				const existing = await prisma.scrapedPost.findUnique({
					where: { platformPostId: post.platformPostId },
				});

				if (existing) {
					logger.debug(`Post ${post.platformPostId} already exists, skipping`);
					continue;
				}

				// Save new post
				const saved = await prisma.scrapedPost.create({
					data: {
						platform: post.platform,
						platformPostId: post.platformPostId,
						sourceUrl: post.sourceUrl,
						rawContent: post.rawContent,
						author: post.author,
						authorHandle: post.authorHandle,
						text: post.text,
						mediaUrls: post.mediaUrls || [],
						postedAt: post.postedAt,
						likes: post.likes,
						comments: post.comments,
						shares: post.shares,
						views: post.views,
						isProcessed: false,
					},
				});

				savedPosts.push(saved);
			} catch (error) {
				logger.error(`Failed to save post ${post.platformPostId}:`, error);
			}
		}

		logger.info(`Saved ${savedPosts.length} new posts from ${platform}`);
		return savedPosts;
	}
}
