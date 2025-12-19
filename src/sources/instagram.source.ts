import { chromium, Browser, Page } from 'playwright';
import { BaseSocialMediaSource, ScrapedPostData, ScrapingOptions } from './base.source';
import { logger } from '../utils/logger';

/**
 * Instagram scraper using Playwright
 * Note: Instagram doesn't have a public API for posts, so we use web scraping
 */
export class InstagramSource extends BaseSocialMediaSource {
	private browser: Browser | null = null;
	private page: Page | null = null;
	private isInitialized = false;

	constructor() {
		super('INSTAGRAM');
	}

	async initialize(): Promise<void> {
		try {
			// Launch browser
			this.browser = await chromium.launch({
				headless: true,
				args: ['--no-sandbox', '--disable-setuid-sandbox'],
			});

			this.page = await this.browser.newPage();

			// Set user agent
			await this.page.setUserAgent(
				'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
			);

			this.isInitialized = true;
			logger.info('Instagram source initialized successfully');
		} catch (error) {
			logger.error('Instagram initialization failed:', error);
			throw error;
		}
	}

	async scrape(options: ScrapingOptions): Promise<ScrapedPostData[]> {
		if (!this.isInitialized || !this.page) {
			await this.initialize();
		}

		const posts: ScrapedPostData[] = [];
		const maxPosts = options.maxPosts || 50;

		try {
			// Search for hashtags or keywords
			const searchTerms = options.hashtags || ['fashion', 'style', 'ootd'];

			for (const term of searchTerms) {
				if (posts.length >= maxPosts) break;

				const hashtag = term.replace('#', '');
				const url = `https://www.instagram.com/explore/tags/${hashtag}/`;

				logger.info(`Scraping Instagram hashtag: #${hashtag}`);

				await this.page!.goto(url, { waitUntil: 'networkidle' });
				await this.page!.waitForTimeout(2000);

				// Scroll to load more posts
				for (let i = 0; i < 3; i++) {
					await this.page!.evaluate(() => window.scrollBy(0, window.innerHeight));
					await this.page!.waitForTimeout(1000);
				}

				// Extract post data from page
				const pagePosts = await this.page!.evaluate(() => {
					const posts: any[] = [];

					// Instagram stores data in script tags
					const scripts = document.querySelectorAll('script[type="application/ld+json"]');

					scripts.forEach(script => {
						try {
							const data = JSON.parse(script.textContent || '');
							if (data['@type'] === 'ImageObject' || data['@type'] === 'VideoObject') {
								posts.push(data);
							}
						} catch (e) {
							// Ignore parse errors
						}
					});

					return posts;
				});

				// Process scraped posts
				for (const rawPost of pagePosts.slice(0, maxPosts - posts.length)) {
					try {
						const post = await this.parseInstagramPost(rawPost);
						if (post) {
							posts.push(post);
						}
					} catch (error) {
						logger.warn('Failed to parse Instagram post:', error);
					}
				}
			}

			logger.info(`Scraped ${posts.length} posts from Instagram`);
			return posts;
		} catch (error: any) {
			logger.error('Instagram scraping error:', error.message);
			throw error;
		}
	}

	async cleanup(): Promise<void> {
		if (this.browser) {
			await this.browser.close();
			this.browser = null;
			this.page = null;
		}
		this.isInitialized = false;
		logger.info('Instagram source cleaned up');
	}

	async testConnection(): Promise<boolean> {
		try {
			if (!this.isInitialized) {
				await this.initialize();
			}

			await this.page!.goto('https://www.instagram.com/explore/', {
				waitUntil: 'networkidle',
				timeout: 10000,
			});

			return true;
		} catch (error) {
			logger.error('Instagram connection test failed:', error);
			return false;
		}
	}

	/**
	 * Parse Instagram post from raw data
	 */
	private async parseInstagramPost(rawPost: any): Promise<ScrapedPostData | null> {
		try {
			// Extract data from LD+JSON format
			const caption = rawPost.caption || rawPost.description || '';
			const author = rawPost.author?.name || 'Unknown';
			const authorHandle = rawPost.author?.alternateName || author;

			// Parse engagement metrics (Instagram doesn't expose these publicly anymore)
			// We'll use placeholder values or extract from available data
			const interactionStatistic = rawPost.interactionStatistic || [];
			const likes = this.extractEngagementCount(interactionStatistic, 'LikeAction');
			const comments = this.extractEngagementCount(interactionStatistic, 'CommentAction');

			return {
				platformPostId: rawPost.identifier || `ig_${Date.now()}_${Math.random()}`,
				platform: 'INSTAGRAM',
				author,
				authorHandle,
				text: caption,
				mediaUrls: [rawPost.contentUrl || rawPost.url].filter(Boolean),
				postedAt: new Date(rawPost.uploadDate || rawPost.datePublished || Date.now()),
				likes,
				comments,
				shares: 0, // Instagram doesn't show shares publicly
				views: 0,
				sourceUrl: rawPost.url || rawPost.mainEntityOfPage?.['@id'],
				rawContent: rawPost,
			};
		} catch (error) {
			logger.error('Failed to parse Instagram post:', error);
			return null;
		}
	}

	/**
	 * Extract engagement count from interaction statistics
	 */
	private extractEngagementCount(statistics: any[], type: string): number {
		const stat = statistics.find((s: any) => s['@type'] === type);
		return stat ? parseInt(stat.userInteractionCount || '0', 10) : 0;
	}
}
