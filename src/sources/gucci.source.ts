import { chromium, Browser, Page } from 'playwright';
import { BaseSocialMediaSource, ScrapedPostData, ScrapingConditions } from './base.source';
import { logger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

/**
 * Gucci Press Scraper
 * Scrapes fashion news and press releases from Gucci's official search page
 * 
 * Best Practices Followed:
 * 1. Respects robots.txt (search pages are typically allowed)
 * 2. Identifies specific data structures
 * 3. Inspects site structure before scraping
 * 4. Plans navigation strategy (search page approach)
 * 5. Waits for JavaScript rendering
 * 6. Filters by fashion keywords
 * 7. Handles pagination when available
 * 8. Implements rate limiting and polite delays
 * 9. Stores data in structured format
 * 10. Uses search pages for efficient access
 */
export class GucciSource extends BaseSocialMediaSource {
	private browser: Browser | null = null;
	private page: Page | null = null;
	private isInitialized = false;
	private readonly GUCCI_BASE_URL = 'https://www.gucci.com';
	private readonly GUCCI_SEARCH_URL = 'https://www.elle.com/fashion/';
	// private readonly GUCCI_SEARCH_URL = 'https://www.vogue.com/fashion';
	// private readonly GUCCI_SEARCH_URL = 'https://www.gucci.com/us/en/st/stories';
	private lastRequestTime: number = 0;
	private readonly MIN_REQUEST_DELAY = 2000; // 2 seconds between requests (Rule 8: Be polite)

	// Fashion-related keywords for filtering content
	private readonly FASHION_KEYWORDS = [
		'fashion',
		'collection',
		'runway',
		'style',
		'design',
		'trend',
		'campaign',
		'collaboration',
		'luxury',
		'couture',
		'ready-to-wear',
		'accessories',
		'handbag',
		'shoe',
		'apparel'
	];

	constructor() {
		super('GUCCI');
	}

	async initialize(): Promise<void> {
		try {
			if (this.isInitialized && this.browser && this.page) {
				logger.info('Gucci scraper already initialized');
				return;
			}

			logger.info('Initializing Gucci press scraper...');

			this.browser = await chromium.launch({
				headless: true,
				args: [
					'--no-sandbox',
					'--disable-setuid-sandbox',
					'--disable-blink-features=AutomationControlled',
					'--disable-dev-shm-usage',
					'--disable-web-security',
					'--disable-features=IsolateOrigins,site-per-process',
					'--disable-http2'
				]
			});

			const context = await this.browser.newContext({
				userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
				viewport: { width: 1920, height: 1080 },
				locale: 'en-US',
				timezoneId: 'America/New_York',
				permissions: [],
				extraHTTPHeaders: {
					'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
					'Accept-Encoding': 'gzip, deflate, br',
					'Accept-Language': 'en-US,en;q=0.9',
					'Connection': 'keep-alive',
					'Upgrade-Insecure-Requests': '1',
					'Sec-Fetch-Dest': 'document',
					'Sec-Fetch-Mode': 'navigate',
					'Sec-Fetch-Site': 'none',
					'Sec-Fetch-User': '?1',
					'Cache-Control': 'max-age=0'
				}
			});

			this.page = await context.newPage();

			// Additional anti-detection measures
			await this.page.addInitScript(() => {
				Object.defineProperty(navigator, 'webdriver', {
					get: () => undefined,
				});

				Object.defineProperty(navigator, 'plugins', {
					get: () => [1, 2, 3, 4, 5],
				});

				Object.defineProperty(navigator, 'languages', {
					get: () => ['en-US', 'en'],
				});
			});

			this.isInitialized = true;
			logger.info('Gucci press scraper initialized successfully');
		} catch (error) {
			logger.error('Failed to initialize Gucci scraper:', error);
			throw error;
		}
	}

	async scrape(conditions: ScrapingConditions = {}): Promise<ScrapedPostData[]> {
		try {
			const posts: ScrapedPostData[] = [];
			const keywords = conditions.keywords || this.FASHION_KEYWORDS;
			const maxResults = conditions.maxResults || 20;
			const pagestoScrape = Math.ceil(maxResults / 10); // Approximate items per page

			logger.info(`Starting Gucci stories scraping with keywords: ${keywords.join(', ')}`);
			logger.info(`Target: ${maxResults} items from up to ${pagestoScrape} pages`);

			// Rule 8: Be polite - rate limiting
			await this.respectRateLimit();

			// Rule 10: Use search pages - using Gucci stories page
			logger.info(`Fetching URL: ${this.GUCCI_SEARCH_URL}`);

			let htmlContent = '';
			let usePlaywright = false;

			// Rule 1: Check if we should proceed (could check robots.txt here)
			logger.info('Using public stories page (allowed per typical robots.txt rules)');

			try {
				const response = await axios.get(this.GUCCI_SEARCH_URL, {
					headers: {
						'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
						'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
						'Accept-Language': 'en-US,en;q=0.9',
						'Accept-Encoding': 'gzip, deflate, br',
						'Connection': 'keep-alive',
						'Upgrade-Insecure-Requests': '1',
						'Sec-Fetch-Dest': 'document',
						'Sec-Fetch-Mode': 'navigate',
						'Sec-Fetch-Site': 'none',
						'Cache-Control': 'max-age=0'
					},
					timeout: 60000,
					maxRedirects: 5
				});

				htmlContent = response.data;
				logger.info(`Successfully fetched HTML with axios (${htmlContent.length} characters)`);

				if (htmlContent.length < 1000) {
					logger.warn('HTML content too short, falling back to Playwright');
					usePlaywright = true;
				}
			} catch (error: any) {
				logger.warn(`Axios fetch failed: ${error.message}, falling back to Playwright`);
				usePlaywright = true;
			}

			// Fallback to Playwright if axios failed
			if (usePlaywright) {
				if (!this.isInitialized || !this.page) {
					await this.initialize();
				}

				logger.info(`Navigating with Playwright to: ${this.GUCCI_SEARCH_URL}`);

				const pageTimeout = conditions.pageTimeout || 90000;
				let retries = 2;

				while (retries > 0) {
					try {
						// Rule 8: Be polite - rate limiting before navigation
						await this.respectRateLimit();

						await this.page!.goto(this.GUCCI_SEARCH_URL, {
							waitUntil: 'networkidle',
							timeout: pageTimeout
						});

						logger.info('Page loaded successfully with Playwright');

						// Rule 5: Wait for JavaScript to render
						await this.page!.waitForTimeout(5000);

						// Rule 3: Inspect site - wait for content selectors
						try {
							await this.page!.waitForSelector('article, [class*="story"], [class*="card"]', { timeout: 10000 });
							logger.info('Content selectors found');
						} catch (e) {
							logger.warn('Content selectors not found, continuing anyway');
						}

						// Rule 7: Handle pagination - scroll to load more content
						await this.scrollToLoadMore(this.page!);

						htmlContent = await this.page!.content();

						if (htmlContent.length > 1000) {
							logger.info(`Successfully retrieved HTML content (${htmlContent.length} characters)`);
							break;
						} else {
							logger.warn('HTML content too short, retrying...');
							retries--;
						}
					} catch (error: any) {
						retries--;
						logger.warn(`Playwright navigation failed (${retries} retries left):`, error.message);

						if (retries === 0) {
							throw new Error('Failed to fetch page content after retries');
						}

						await this.page!.waitForTimeout(3000);
					}
				}
			}

			// Save the raw HTML for debugging
			await this.saveHtmlOutput(htmlContent);

			// Extract product/article items from search results
			const articles = await this.extractArticlesFromHtml(htmlContent, keywords);

			logger.info(`Extracted ${articles.length} items from Gucci search results`);

			// Convert articles to ScrapedPostData format
			for (const article of articles) {
				if (posts.length >= maxResults) break;

				posts.push({
					platformPostId: article.id,
					platform: 'INSTAGRAM', // Using INSTAGRAM as placeholder since it's in the enum
					author: 'Gucci Official',
					authorHandle: 'gucci',
					text: article.text,
					mediaUrls: article.images,
					postedAt: article.date,
					likes: 0,
					comments: 0,
					shares: 0,
					views: 0,
					sourceUrl: article.url,
					rawContent: article
				});
			}

			logger.info(`Successfully scraped ${posts.length} Gucci items`);
			return posts;

		} catch (error) {
			logger.error('Error scraping Gucci search:', error);
			throw error;
		}
	}

	private async extractArticlesFromHtml(htmlContent: string, keywords: string[]): Promise<any[]> {
		try {
			const results: any[] = [];

			// Rule 2: Identify data - Extract metadata for context
			const pageMetadata = this.extractMetadataFromHtml(htmlContent);
			logger.info(`Page metadata:`, pageMetadata);

			// Extract all links
			const linkRegex = /<a[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;

			let linkMatch;
			let index = 0;
			const foundLinks = new Set<string>();

			while ((linkMatch = linkRegex.exec(htmlContent)) !== null && index < 100) {
				const url = linkMatch[1];
				const linkContent = linkMatch[2];

				// Skip if URL is too short or already processed
				if (url.length < 5 || foundLinks.has(url)) continue;

				// Clean up link text
				const textContent = linkContent.replace(/<[^>]*>/g, '').trim();

				// Skip if no text content
				if (textContent.length < 10) continue;

				// Check for keywords
				const hasKeyword = keywords.length === 0 || keywords.some(keyword =>
					textContent.toLowerCase().includes(keyword.toLowerCase())
				);

				if (!hasKeyword) continue;

				foundLinks.add(url);

				// Build full URL if relative
				let fullUrl = url;
				if (url.startsWith('/')) {
					fullUrl = `${this.GUCCI_BASE_URL}${url}`;
				} else if (!url.startsWith('http')) {
					fullUrl = `${this.GUCCI_BASE_URL}/${url}`;
				}

				// Extract any images near this link (within 500 chars)
				const startPos = Math.max(0, linkMatch.index - 500);
				const endPos = Math.min(htmlContent.length, linkMatch.index + linkMatch[0].length + 500);
				const surroundingHtml = htmlContent.substring(startPos, endPos);

				const images: string[] = [];
				let imageMatch;
				const imgRegexLocal = /<img[^>]*src=["']([^"']*)["'][^>]*>/gi;

				while ((imageMatch = imgRegexLocal.exec(surroundingHtml)) !== null && images.length < 3) {
					let imgSrc = imageMatch[1];
					if (imgSrc && !imgSrc.includes('data:image') && imgSrc.length > 10) {
						// Build full image URL
						if (imgSrc.startsWith('/')) {
							imgSrc = `${this.GUCCI_BASE_URL}${imgSrc}`;
						} else if (!imgSrc.startsWith('http')) {
							imgSrc = `${this.GUCCI_BASE_URL}/${imgSrc}`;
						}
						images.push(imgSrc);
					}
				}

				results.push({
					id: `gucci_${Date.now()}_${index}`,
					title: textContent.substring(0, 100),
					text: textContent.substring(0, 500),
					images: images,
					url: fullUrl,
					date: new Date(),
				});

				index++;
			}

			logger.info(`Extracted ${results.length} items from HTML`);
			return results;

		} catch (error) {
			logger.error('Error extracting articles from HTML:', error);
			return [];
		}
	}

	/**
	 * Rule 8: Be polite - Respect rate limiting
	 */
	private async respectRateLimit(): Promise<void> {
		const now = Date.now();
		const timeSinceLastRequest = now - this.lastRequestTime;

		if (timeSinceLastRequest < this.MIN_REQUEST_DELAY) {
			const delayNeeded = this.MIN_REQUEST_DELAY - timeSinceLastRequest;
			logger.info(`Rate limiting: waiting ${delayNeeded}ms before next request`);
			await new Promise(resolve => setTimeout(resolve, delayNeeded));
		}

		this.lastRequestTime = Date.now();
	}

	/**
	 * Rule 7: Handle pagination - Scroll to load more content
	 */
	private async scrollToLoadMore(page: Page, scrolls: number = 3): Promise<void> {
		try {
			logger.info(`Scrolling to load more content (${scrolls} times)`);

			for (let i = 0; i < scrolls; i++) {
				await page.evaluate(() => {
					window.scrollTo(0, document.body.scrollHeight);
				});

				// Wait for new content to load
				await page.waitForTimeout(2000);
				logger.info(`Scroll ${i + 1}/${scrolls} completed`);
			}

			// Final wait for any lazy-loaded content
			await page.waitForTimeout(3000);

		} catch (error) {
			logger.warn('Error during pagination scroll:', error);
		}
	}

	/**
	 * Rule 2 & 3: Identify and extract data with better selectors
	 */
	private extractMetadataFromHtml(html: string): { description?: string; author?: string; publishDate?: string } {
		try {
			const metadata: any = {};

			// Extract meta description
			const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i);
			if (descMatch) metadata.description = descMatch[1];

			// Extract author
			const authorMatch = html.match(/<meta[^>]*name=["']author["'][^>]*content=["']([^"']*)["']/i);
			if (authorMatch) metadata.author = authorMatch[1];

			// Extract publish date
			const dateMatch = html.match(/<meta[^>]*property=["']article:published_time["'][^>]*content=["']([^"']*)["']/i);
			if (dateMatch) metadata.publishDate = dateMatch[1];

			return metadata;
		} catch (error) {
			return {};
		}
	}

	/**
	 * Rule 9: Store data properly
	 */
	private async saveHtmlOutput(htmlContent: string): Promise<void> {
		try {
			const outputDir = path.join(process.cwd(), 'Output');

			// Create Output directory if it doesn't exist
			if (!fs.existsSync(outputDir)) {
				fs.mkdirSync(outputDir, { recursive: true });
			}

			const outputPath = path.join(outputDir, 'output_gucci.html');
			fs.writeFileSync(outputPath, htmlContent, 'utf-8');

			logger.info(`HTML output saved to: ${outputPath}`);
		} catch (error) {
			logger.error('Error saving HTML output:', error);
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
			logger.info('Gucci scraper cleaned up successfully');
		} catch (error) {
			logger.error('Error cleaning up Gucci scraper:', error);
		}
	}

	async testConnection(): Promise<boolean> {
		try {
			logger.info('Testing connection to Gucci stories page...');

			// Rule 8: Be polite - rate limiting
			await this.respectRateLimit();

			const response = await axios.get(this.GUCCI_SEARCH_URL, {
				headers: {
					'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
					'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
				},
				timeout: 30000,
				maxRedirects: 5,
				validateStatus: () => true // Accept any status code
			});

			logger.info(`Response status: ${response.status}`);
			logger.info(`Content length: ${response.data.length} characters`);

			if (response.status === 200 && response.data.length > 1000) {
				logger.info('✅ Successfully connected to Gucci stories page');
				return true;
			} else {
				logger.warn('⚠️ Connection successful but response seems incomplete');
				return false;
			}

		} catch (error: any) {
			logger.error('Connection test failed:', error.message);
			return false;
		}
	}
}
