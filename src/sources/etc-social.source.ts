import { chromium, Browser, Page } from 'playwright';
import { BaseSocialMediaSource, ScrapedPostData, ScrapingConditions } from './base.source';
import { logger } from '../utils/logger';

/**
 * EtcSocial Scraper
 * Generic scraper for any URL/website that doesn't have a dedicated source
 * Fetches and parses raw HTML content from any given URL
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

					// Parse HTML for articles, links, and content
					const parsedContent = this.parseHtmlContent(htmlContent, url);

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
					logger.info(`  Articles found: ${parsedContent.articles.length}`);
					logger.info(`  Images found: ${parsedContent.images.length}`);
					logger.info(`  Links found: ${parsedContent.links.length}`);

					// Create a normalized post data entry
					posts.push({
						platformPostId: `etc-${Date.now()}-${Buffer.from(url).toString('base64').substring(0, 10)}`,
						platform: 'ETC',
						author: parsedContent.author || metadata.author || 'Unknown',
						authorHandle: new URL(url).hostname,
						text: metadata.description || metadata.title || 'No description available',
						mediaUrls: parsedContent.images.length > 0 ? parsedContent.images.slice(0, 5) : undefined,
						postedAt: new Date(),
						likes: 0,
						comments: 0,
						shares: 0,
						views: 0,
						sourceUrl: url,
						rawContent: {
							html: htmlContent,
							metadata: metadata,
							parsedContent: parsedContent,
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

	/**
	 * Parse HTML content to extract meaningful information
	 */
	private parseHtmlContent(html: string, sourceUrl: string): {
		author: string | null;
		articles: any[];
		images: string[];
		links: string[];
	} {
		const result = {
			author: null as string | null,
			articles: [] as any[],
			images: [] as string[],
			links: [] as string[]
		};

		try {
			// Extract author from common patterns
			const authorPatterns = [
				/<meta\s+name=["']author["']\s+content=["']([^"']+)["']/i,
				/<span[^>]*class=["'][^"']*author[^"']*["'][^>]*>([^<]+)<\/span>/i,
				/<div[^>]*class=["'][^"']*byline[^"']*["'][^>]*>.*?<a[^>]*>([^<]+)<\/a>/i,
				/by\s+<a[^>]*>([^<]+)<\/a>/i
			];

			for (const pattern of authorPatterns) {
				const match = html.match(pattern);
				if (match) {
					result.author = this.cleanText(match[1]);
					break;
				}
			}

			// Extract article elements
			const articlePattern = /<article[^>]*>([\s\S]*?)<\/article>/gi;
			const articleMatches = html.matchAll(articlePattern);

			for (const match of articleMatches) {
				const articleHtml = match[1];

				// Extract title
				const titleMatch = articleHtml.match(/<h[1-6][^>]*>([^<]+)<\/h[1-6]>/i) ||
					articleHtml.match(/<[^>]*class=["'][^"']*title[^"']*["'][^>]*>([^<]+)</i);

				// Extract text content
				const textMatch = articleHtml.match(/<p[^>]*>([^<]+)<\/p>/i);

				// Extract link
				const linkMatch = articleHtml.match(/<a[^>]*href=["']([^"']+)["']/i);

				if (titleMatch || textMatch) {
					result.articles.push({
						title: titleMatch ? this.cleanText(titleMatch[1]) : null,
						text: textMatch ? this.cleanText(textMatch[1]) : null,
						link: linkMatch ? this.normalizeUrl(linkMatch[1], sourceUrl) : null
					});
				}
			}

			// Extract all images
			const imgPattern = /<img[^>]*src=["']([^"']+)["'][^>]*>/gi;
			const imgMatches = html.matchAll(imgPattern);

			for (const match of imgMatches) {
				const imgUrl = this.normalizeUrl(match[1], sourceUrl);
				if (imgUrl && !imgUrl.includes('data:image')) {
					result.images.push(imgUrl);
				}
			}

			// Extract meaningful links (not navigation, footer, etc.)
			const linkPattern = /<a[^>]*href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/gi;
			const linkMatches = html.matchAll(linkPattern);

			for (const match of linkMatches) {
				const url = match[1];
				const linkText = this.cleanText(match[2]);

				// Filter out navigation and short links
				if (linkText.length > 10 && !url.includes('#') && !url.includes('javascript:')) {
					const normalizedUrl = this.normalizeUrl(url, sourceUrl);
					if (normalizedUrl) {
						result.links.push(normalizedUrl);
					}
				}
			}

		} catch (error) {
			logger.error('Error parsing HTML content:', error);
		}

		return result;
	}

	/**
	 * Normalize URL to absolute path
	 */
	private normalizeUrl(url: string, baseUrl: string): string {
		try {
			if (url.startsWith('http://') || url.startsWith('https://')) {
				return url;
			}
			if (url.startsWith('//')) {
				return 'https:' + url;
			}
			if (url.startsWith('/')) {
				const base = new URL(baseUrl);
				return `${base.protocol}//${base.host}${url}`;
			}
			return new URL(url, baseUrl).href;
		} catch (error) {
			return url;
		}
	}
}
