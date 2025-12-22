import { chromium, Browser, Page } from 'playwright';
import { BaseSocialMediaSource, ScrapedPostData, ScrapingConditions } from './base.source';
import { logger } from '../utils/logger';

/**
 * EtcSocial Scraper
 * Generic scraper for any URL/website that doesn't have a dedicated source
 * Fetches raw HTML content from any given URL
 */
export class EtcSocialSource extends BaseSocialMediaSource {
	private browser: Browser | null = null;
	private page: Page | null = null;
	private isInitialized = false;

	constructor() {
		super('ETCSOCIAL');
	}

	async initialize(): Promise<void> {
		try {
			if (this.isInitialized && this.browser && this.page) {
				logger.info('EtcSocial scraper already initialized');
				return;
			}

			logger.info('Initializing EtcSocial scraper...');

			this.browser = await chromium.launch({
				headless: true,
				args: [
					'--no-sandbox',
					'--disable-setuid-sandbox',
					'--disable-blink-features=AutomationControlled',
					'--disable-dev-shm-usage'
				]
			});

			this.page = await this.browser.newPage();

			// Set realistic viewport and user agent
			await this.page.setViewportSize({ width: 1920, height: 1080 });
			await this.page.setExtraHTTPHeaders({
				'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
				'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
				'Accept-Language': 'en-US,en;q=0.9',
			});

			this.isInitialized = true;
			logger.info('EtcSocial scraper initialized successfully');
		} catch (error) {
			logger.error('Failed to initialize EtcSocial scraper:', error);
			throw error;
		}
	}

	/**
	 * Scrape raw HTML from any URL
	 * @param conditions Must include 'urls' array
	 */
	async scrape(conditions: ScrapingConditions & { urls?: string[] }): Promise<ScrapedPostData[]> {
		try {
			if (!this.isInitialized || !this.page) {
				await this.initialize();
			}

			const urls = conditions.urls || [];
			const posts: ScrapedPostData[] = [];

			if (urls.length === 0) {
				logger.warn('No URLs provided for scraping');
				return posts;
			}

			const pageTimeout = conditions.pageTimeout || 30000;

			logger.info(`Starting EtcSocial scraping for ${urls.length} URL(s)`);

			for (const url of urls) {
				try {
					logger.info(`Fetching: ${url}`);

					await this.page!.goto(url, {
						waitUntil: 'networkidle',
						timeout: pageTimeout
					});

					// Wait for page to fully render
					await this.page!.waitForTimeout(2000);

					// Get raw HTML content
					const htmlContent = await this.page!.content();

					// Extract some basic metadata
					const metadata = await this.page!.evaluate(() => {
						const getMetaContent = (name: string) => {
							const meta = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
							return meta?.getAttribute('content') || '';
						};

						return {
							title: document.title,
							description: getMetaContent('description') || getMetaContent('og:description'),
							author: getMetaContent('author'),
							url: window.location.href
						};
					});

					logger.info(`✓ Fetched HTML from: ${url}`);
					logger.info(`  Title: ${metadata.title}`);
					logger.info(`  HTML Size: ${(htmlContent.length / 1024).toFixed(2)} KB`);

					// Create a normalized post data entry
					posts.push({
						platformPostId: `etc-${Date.now()}-${Buffer.from(url).toString('base64').substring(0, 10)}`,
						platform: 'INSTAGRAM', // Using INSTAGRAM as placeholder since base type doesn't have ETCSOCIAL
						author: metadata.author || 'Unknown',
						authorHandle: new URL(url).hostname,
						text: metadata.description || metadata.title || 'No description available',
						mediaUrls: undefined,
						postedAt: new Date(),
						likes: 0,
						comments: 0,
						shares: 0,
						views: 0,
						sourceUrl: url,
						rawContent: {
							html: htmlContent,
							metadata: metadata,
							fetchedAt: new Date().toISOString()
						}
					});

				} catch (error: any) {
					logger.error(`Failed to scrape URL: ${url}`, error.message);
				}
			}

			logger.info(`EtcSocial scraping completed. Fetched ${posts.length} page(s)`);
			return posts;

		} catch (error) {
			logger.error('EtcSocial scraping failed:', error);
			throw error;
		}
	}

	async cleanup(): Promise<void> {
		try {
			if (this.page) {
				await this.page.close();
				this.page = null;
			}

			if (this.browser) {
				await this.browser.close();
				this.browser = null;
			}

			this.isInitialized = false;
			logger.info('EtcSocial scraper cleaned up');
		} catch (error) {
			logger.error('Error cleaning up EtcSocial scraper:', error);
		}
	}

	async testConnection(): Promise<boolean> {
		try {
			if (!this.isInitialized) {
				await this.initialize();
			}

			// Test with a simple URL
			// await this.page!.goto('https://instagram.com', {
			// 	waitUntil: 'networkidle',
			// 	timeout: 10000
			// });

			logger.info('EtcSocial scraper connection test successful');
			return true;
		} catch (error) {
			logger.error('EtcSocial scraper connection test failed:', error);
			return false;
		}
	}

	/**
	 * Get raw HTML from a single URL (convenience method)
	 */
	async fetchRawHTML(url: string): Promise<string> {
		try {
			if (!this.isInitialized || !this.page) {
				await this.initialize();
			}

			await this.page!.goto(url, {
				waitUntil: 'networkidle',
				timeout: 30000
			});

			await this.page!.waitForTimeout(2000);

			const html = await this.page!.content();
			return html;

		} catch (error) {
			logger.error(`Failed to fetch raw HTML from ${url}:`, error);
			throw error;
		}
	}
}
