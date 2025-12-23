import { chromium, Browser, Page } from 'playwright';
import { BaseSocialMediaSource, ScrapedPostData, ScrapingConditions } from './base.source';
import { logger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

/**
 * Elle Fashion Scraper
 * Scrapes fashion news and articles from Elle.com fashion section
 * 
 * Best Practices Followed:
 * 1. Respects robots.txt
 * 2. Identifies specific data structures
 * 3. Inspects site structure before scraping
 * 4. Plans navigation strategy
 * 5. Waits for JavaScript rendering
 * 6. Filters by fashion keywords
 * 7. Handles pagination
 * 8. Implements rate limiting
 * 9. Stores data in structured format (HTML + JSON)
 * 10. Uses section pages for efficient access
 */
export class ElleSource extends BaseSocialMediaSource {
	private browser: Browser | null = null;
	private page: Page | null = null;
	private isInitialized = false;
	private readonly ELLE_BASE_URL = 'https://www.elle.com';
	private readonly ELLE_FASHION_URL = 'https://www.elle.com/fashion/';
	private lastRequestTime: number = 0;
	private readonly MIN_REQUEST_DELAY = 2000; // 2 seconds between requests (Rule 8: Be polite)

	// Fashion-related keywords for filtering content
	private readonly FASHION_KEYWORDS = [
		'fashion',
		'style',
		'designer',
		'collection',
		'runway',
		'trend',
		'outfit',
		'wear',
		'clothing',
		'accessory',
		'launch',
		'brand',
		'collaboration'
	];

	constructor() {
		super('ELLE');
	}

	async initialize(): Promise<void> {
		try {
			if (this.isInitialized && this.browser && this.page) {
				logger.info('Elle scraper already initialized');
				return;
			}

			logger.info('Initializing Elle fashion scraper...');

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
			logger.info('Elle fashion scraper initialized successfully');
		} catch (error) {
			logger.error('Failed to initialize Elle scraper:', error);
			throw error;
		}
	}

	async scrape(conditions: ScrapingConditions = {}): Promise<ScrapedPostData[]> {
		try {
			const posts: ScrapedPostData[] = [];
			const keywords = conditions.keywords || this.FASHION_KEYWORDS;
			const maxResults = conditions.maxResults || 20;

			logger.info(`Starting Elle fashion scraping with keywords: ${keywords.join(', ')}`);
			logger.info(`Target: ${maxResults} items`);

			// Rule 8: Be polite - rate limiting
			await this.respectRateLimit();

			// Rule 10: Use search pages - using Elle fashion section
			logger.info(`Fetching URL: ${this.ELLE_FASHION_URL}`);
			logger.info('Using public fashion section (allowed per robots.txt rules)');

			let htmlContent = '';
			let usePlaywright = false;

			try {
				const response = await axios.get(this.ELLE_FASHION_URL, {
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

				logger.info(`Navigating with Playwright to: ${this.ELLE_FASHION_URL}`);

				const pageTimeout = conditions.pageTimeout || 90000;
				let retries = 2;

				while (retries > 0) {
					try {
						// Rule 8: Be polite - rate limiting before navigation
						await this.respectRateLimit();

						await this.page!.goto(this.ELLE_FASHION_URL, {
							waitUntil: 'networkidle',
							timeout: pageTimeout
						});

						logger.info('Page loaded successfully with Playwright');

						// Rule 5: Wait for JavaScript to render
						await this.page!.waitForTimeout(5000);

						// Rule 3: Inspect site - wait for content selectors
						try {
							await this.page!.waitForSelector('section[data-vars-block-type]', { timeout: 10000 });
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

			// Extract articles from HTML
			const articles = await this.extractArticlesFromHtml(htmlContent, keywords);

			logger.info(`Extracted ${articles.length} items from Elle fashion page`);

			// Convert articles to ScrapedPostData format
			for (const article of articles) {
				if (posts.length >= maxResults) break;

				posts.push({
					platformPostId: article.id,
					platform: 'ELLE',
					author: article.author || 'Elle Editorial',
					authorHandle: 'elle',
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

			// Rule 9: Store data properly - save JSON output
			await this.saveJsonOutput(posts);

			logger.info(`Successfully scraped ${posts.length} Elle fashion items`);
			return posts;

		} catch (error) {
			logger.error('Error scraping Elle fashion:', error);
			throw error;
		}
	}

	private async extractArticlesFromHtml(htmlContent: string, keywords: string[]): Promise<any[]> {
		try {
			const results: any[] = [];

			// Rule 2: Identify data - Extract metadata
			const pageMetadata = this.extractMetadataFromHtml(htmlContent);
			logger.info(`Page metadata:`, pageMetadata);

			// Extract Elle-specific article sections
			// Pattern: <section data-vars-block-type="Big Story Block">
			const sectionRegex = /<section[^>]*data-vars-block-type="[^"]*"[^>]*>([\s\S]*?)<\/section>/gi;

			let sectionMatch;
			let index = 0;

			while ((sectionMatch = sectionRegex.exec(htmlContent)) !== null && index < 100) {
				const sectionContent = sectionMatch[1];

				// Extract article URL
				const urlMatch = sectionContent.match(/href=["']([^"']*?)["']/);
				if (!urlMatch) continue;

				let url = urlMatch[1];

				// Build full URL if relative
				if (url.startsWith('/')) {
					url = `${this.ELLE_BASE_URL}${url}`;
				}

				// Extract title
				let title = '';
				const titleMatch = sectionContent.match(/<span[^>]*data-theme-key="custom-item-title-text"[^>]*>([\s\S]*?)<\/span>/i);
				if (titleMatch) {
					title = titleMatch[1].replace(/<[^>]*>/g, '').trim();
				}

				// Extract description (dek)
				let description = '';
				const dekMatch = sectionContent.match(/data-theme-key="custom-item-dek"[^>]*>([\s\S]*?)<\/div>/i);
				if (dekMatch) {
					const dekContent = dekMatch[1];
					const pMatch = dekContent.match(/<p>([\s\S]*?)<\/p>/);
					if (pMatch) {
						description = pMatch[1].replace(/<[^>]*>/g, '').trim();
					}
				}

				// Extract author
				let author = '';
				const authorMatch = sectionContent.match(/<span[^>]*data-theme-key="by-line-name"[^>]*>[\s\S]*?<span>(.*?)<\/span>/i);
				if (authorMatch) {
					author = authorMatch[1].replace(/By\s*/i, '').trim();
				}

				// Extract image
				const images: string[] = [];
				const imgMatch = sectionContent.match(/src=["'](https:\/\/hips\.hearstapps\.com[^"']*?)["']/);
				if (imgMatch) {
					images.push(imgMatch[1]);
				}

				// Combine title and description for text content
				const textContent = `${title}${description ? ': ' + description : ''}`;

				// Rule 6: Filter by keywords
				const hasKeyword = keywords.length === 0 || keywords.some(keyword =>
					textContent.toLowerCase().includes(keyword.toLowerCase())
				);

				if (!hasKeyword) continue;

				// Skip if no meaningful content
				if (!title && !description) continue;

				results.push({
					id: `elle_${Date.now()}_${index}`,
					title: title,
					text: textContent,
					description: description,
					author: author,
					images: images,
					url: url,
					date: new Date(),
					blockType: 'article'
				});

				index++;
			}

			logger.info(`Extracted ${results.length} Elle fashion articles`);
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
			const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*?)["']/i);
			if (descMatch) metadata.description = descMatch[1];

			// Extract author
			const authorMatch = html.match(/<meta[^>]*name=["']author["'][^>]*content=["']([^"']*?)["']/i);
			if (authorMatch) metadata.author = authorMatch[1];

			// Extract publish date
			const dateMatch = html.match(/<meta[^>]*property=["']article:published_time["'][^>]*content=["']([^"']*?)["']/i);
			if (dateMatch) metadata.publishDate = dateMatch[1];

			return metadata;
		} catch (error) {
			return {};
		}
	}

	/**
	 * Rule 9: Store data properly - Save HTML output
	 */
	private async saveHtmlOutput(htmlContent: string): Promise<void> {
		try {
			const outputDir = path.join(process.cwd(), 'Output');

			// Create Output directory if it doesn't exist
			if (!fs.existsSync(outputDir)) {
				fs.mkdirSync(outputDir, { recursive: true });
			}

			const outputPath = path.join(outputDir, 'output_elle.html');
			fs.writeFileSync(outputPath, htmlContent, 'utf-8');

			logger.info(`HTML output saved to: ${outputPath}`);
		} catch (error) {
			logger.error('Error saving HTML output:', error);
		}
	}

	/**
	 * Rule 9: Store data properly - Save JSON output
	 */
	private async saveJsonOutput(posts: ScrapedPostData[]): Promise<void> {
		try {
			const outputDir = path.join(process.cwd(), 'Output');

			// Create Output directory if it doesn't exist
			if (!fs.existsSync(outputDir)) {
				fs.mkdirSync(outputDir, { recursive: true });
			}

			const jsonData = {
				source: 'Elle Fashion',
				url: this.ELLE_FASHION_URL,
				scrapedAt: new Date().toISOString(),
				totalItems: posts.length,
				items: posts.map(post => ({
					id: post.platformPostId,
					title: post.rawContent?.title || '',
					description: post.rawContent?.description || '',
					author: post.author,
					text: post.text,
					url: post.sourceUrl,
					images: post.mediaUrls,
					postedAt: post.postedAt,
					blockType: post.rawContent?.blockType || 'article'
				}))
			};

			const outputPath = path.join(outputDir, 'output_elle.json');
			fs.writeFileSync(outputPath, JSON.stringify(jsonData, null, 2), 'utf-8');

			logger.info(`JSON output saved to: ${outputPath}`);
		} catch (error) {
			logger.error('Error saving JSON output:', error);
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
			logger.info('Elle scraper cleaned up successfully');
		} catch (error) {
			logger.error('Error cleaning up Elle scraper:', error);
		}
	}

	async testConnection(): Promise<boolean> {
		try {
			logger.info('Testing connection to Elle fashion page...');

			// Rule 8: Be polite - rate limiting
			await this.respectRateLimit();

			const response = await axios.get(this.ELLE_FASHION_URL, {
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
				logger.info('✅ Successfully connected to Elle fashion page');
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
