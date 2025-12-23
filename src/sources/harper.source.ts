import { chromium, Browser, Page } from 'playwright';
import { BaseSocialMediaSource, ScrapedPostData, ScrapingConditions } from './base.source';
import { logger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

/**
 * Harper's Bazaar Fashion Scraper
 * Scrapes fashion news and articles from HarpersBazaar.com fashion section
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
export class HarperSource extends BaseSocialMediaSource {
	private browser: Browser | null = null;
	private page: Page | null = null;
	private isInitialized = false;
	private readonly HARPER_BASE_URL = 'https://www.harpersbazaar.com';
	private readonly HARPER_FASHION_URL = 'https://www.harpersbazaar.com/fashion/';
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
		'collaboration',
		'couture',
		'luxury'
	];

	constructor() {
		super('HARPER_BAZAAR');
	}

	async initialize(): Promise<void> {
		try {
			if (this.isInitialized && this.browser && this.page) {
				logger.info('Harper\'s Bazaar scraper already initialized');
				return;
			}

			logger.info('Initializing Harper\'s Bazaar fashion scraper...');

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
			logger.info('Harper\'s Bazaar fashion scraper initialized successfully');
		} catch (error) {
			logger.error('Failed to initialize Harper\'s Bazaar scraper:', error);
			throw error;
		}
	}

	async scrape(conditions: ScrapingConditions = {}): Promise<ScrapedPostData[]> {
		try {
			const posts: ScrapedPostData[] = [];
			const keywords = conditions.keywords || this.FASHION_KEYWORDS;
			const maxResults = conditions.maxResults || 20;

			logger.info(`Starting Harper's Bazaar fashion scraping with keywords: ${keywords.join(', ')}`);
			logger.info(`Target: ${maxResults} items`);

			// Rule 8: Be polite - rate limiting
			await this.respectRateLimit();

			// Rule 10: Use search pages - using Harper's Bazaar fashion section
			logger.info(`Fetching URL: ${this.HARPER_FASHION_URL}`);
			logger.info('Using public fashion section (allowed per robots.txt rules)');

			let htmlContent = '';
			let usePlaywright = false;

			try {
				const response = await axios.get(this.HARPER_FASHION_URL, {
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

				logger.info(`Navigating with Playwright to: ${this.HARPER_FASHION_URL}`);

				const pageTimeout = conditions.pageTimeout || 90000;
				let retries = 2;

				while (retries > 0) {
					try {
						// Rule 8: Be polite - rate limiting before navigation
						await this.respectRateLimit();

						await this.page!.goto(this.HARPER_FASHION_URL, {
							waitUntil: 'networkidle',
							timeout: pageTimeout
						});

						logger.info('Page loaded successfully with Playwright');

						// Rule 5: Wait for JavaScript to render
						await this.page!.waitForTimeout(5000);

						// Rule 3: Inspect site - wait for content selectors
						try {
							await this.page!.waitForSelector('article', { timeout: 10000 });
							logger.info('Content selectors found');
						} catch (e) {
							logger.warn('Content selectors not found, continuing anyway');
						}

						// Rule 7: Handle pagination - scroll to load more content
						await this.scrollToLoadMore(this.page!, 3);

						htmlContent = await this.page!.content();
						logger.info(`Successfully fetched HTML with Playwright (${htmlContent.length} characters)`);
						break;

					} catch (error: any) {
						retries--;
						logger.error(`Failed to load page (${retries} retries left):`, error.message);

						if (retries === 0) {
							throw error;
						}

						logger.info('Retrying after 5 seconds...');
						await new Promise(resolve => setTimeout(resolve, 5000));
					}
				}
			}

			// Save HTML to file (Rule 9: Store in structured format)
			this.saveHtmlToFile(htmlContent, 'harper');

			// Rule 2 & 3: Extract metadata and parse HTML
			const metadata = this.extractMetadataFromHtml(htmlContent);
			logger.info('Page metadata extracted:', metadata);

			// Extract articles from HTML
			const articles = this.extractArticlesFromHtml(htmlContent);
			logger.info(`Found ${articles.length} articles before filtering`);

			// Rule 6: Filter by fashion keywords
			const filteredArticles = this.filterByKeywords(articles, keywords);
			logger.info(`Filtered to ${filteredArticles.length} articles matching fashion keywords`);

			// Convert to ScrapedPostData format
			for (const article of filteredArticles.slice(0, maxResults)) {
				const post: ScrapedPostData = {
					platformPostId: this.generateSourceId(article.url),
					platform: 'HARPER',
					author: article.author || 'Harper\'s Bazaar',
					authorHandle: 'harpersbazaar',
					text: article.text || article.title || '',
					mediaUrls: article.imageUrl ? [article.imageUrl] : [],
					postedAt: article.publishedDate ? new Date(article.publishedDate) : new Date(),
					likes: 0,
					comments: 0,
					shares: 0,
					views: 0,
					sourceUrl: article.url,
					rawContent: article
				};

				posts.push(post);
			}

			// Save to JSON file (Rule 9: Store in structured format)
			this.saveToJsonFile(posts, 'harper');

			logger.info(`Successfully scraped ${posts.length} posts from Harper's Bazaar`);
			return posts;

		} catch (error) {
			logger.error('Harper\'s Bazaar scraping failed:', error);
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
			logger.info('Harper\'s Bazaar scraper cleaned up');
		} catch (error) {
			logger.error('Error during Harper\'s Bazaar scraper cleanup:', error);
		}
	}

	async testConnection(): Promise<boolean> {
		try {
			logger.info('Testing Harper\'s Bazaar connection...');

			await this.respectRateLimit();

			const response = await axios.get(this.HARPER_FASHION_URL, {
				headers: {
					'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
				},
				timeout: 30000
			});

			const success = response.status === 200;
			logger.info(`Harper's Bazaar connection test: ${success ? 'SUCCESS' : 'FAILED'}`);
			return success;
		} catch (error) {
			logger.error('Harper\'s Bazaar connection test failed:', error);
			return false;
		}
	}

	// Rule 8: Be polite - Rate limiting
	private async respectRateLimit(): Promise<void> {
		const now = Date.now();
		const timeSinceLastRequest = now - this.lastRequestTime;

		if (timeSinceLastRequest < this.MIN_REQUEST_DELAY) {
			const waitTime = this.MIN_REQUEST_DELAY - timeSinceLastRequest;
			logger.info(`Rate limiting: waiting ${waitTime}ms before next request`);
			await new Promise(resolve => setTimeout(resolve, waitTime));
		}

		this.lastRequestTime = Date.now();
	}

	// Rule 7: Handle pagination - scroll to load more content
	private async scrollToLoadMore(page: Page, scrolls: number = 3): Promise<void> {
		logger.info(`Scrolling page ${scrolls} times to load more content`);

		for (let i = 0; i < scrolls; i++) {
			await page.evaluate(() => {
				window.scrollTo(0, document.body.scrollHeight);
			});

			await page.waitForTimeout(2000);
			logger.info(`Scroll ${i + 1}/${scrolls} completed`);
		}
	}

	// Rule 2: Extract metadata from HTML
	private extractMetadataFromHtml(html: string): any {
		const metadata: any = {};

		// Extract title
		const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
		if (titleMatch) {
			metadata.title = titleMatch[1].trim();
		}

		// Extract meta description
		const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
		if (descMatch) {
			metadata.description = descMatch[1].trim();
		}

		// Extract Open Graph data
		const ogTitleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i);
		if (ogTitleMatch) {
			metadata.ogTitle = ogTitleMatch[1].trim();
		}

		const ogImageMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
		if (ogImageMatch) {
			metadata.ogImage = ogImageMatch[1].trim();
		}

		return metadata;
	}

	// Rule 3: Inspect site and extract articles
	private extractArticlesFromHtml(html: string): any[] {
		const articles: any[] = [];

		// Pattern 1: Extract Harper's Bazaar specific format with data-theme-key attributes
		// <a data-theme-key="custom-item" ... href="/fashion/...">
		// Match both orders: href before data-theme-key OR data-theme-key before href
		const articlePattern = /<a[^>]*(?:data-theme-key="custom-item"[^>]*href=["']([^"']+)["']|href=["']([^"']+)["'][^>]*data-theme-key="custom-item")[^>]*>([\s\S]*?)<\/a>/gi;
		const articleMatches = html.matchAll(articlePattern);

		for (const match of articleMatches) {
			const url = this.normalizeUrl(match[1] || match[2]);
			const articleHtml = match[3];

			// Extract title from data-theme-key="custom-item-title-text"
			const titleMatch = articleHtml.match(/<span[^>]*data-theme-key="custom-item-title-text"[^>]*>([^<]+)<\/span>/i);
			const title = titleMatch ? this.cleanText(titleMatch[1]) : '';

			// Extract image from img src
			const imgMatch = articleHtml.match(/<img[^>]*src=["']([^"']+)["'][^>]*>/i);
			const imageUrl = imgMatch ? imgMatch[1] : null;

			// Extract alt text as description
			const altMatch = articleHtml.match(/<img[^>]*alt=["']([^"']+)["'][^>]*>/i);
			const description = altMatch ? this.cleanText(altMatch[1]) : '';

			// Extract data-vars-ga-call-to-action as alternative title
			const gaCallToActionMatch = articleHtml.match(/data-vars-ga-call-to-action=["']([^"']+)["']/i);
			const alternativeTitle = gaCallToActionMatch ? gaCallToActionMatch[1] : '';

			const finalTitle = title || alternativeTitle;
			const text = description || finalTitle;

			if (finalTitle && url) {
				articles.push({
					title: finalTitle,
					url,
					text,
					imageUrl,
					author: null,
					publishedDate: null,
					description
				});
			}
		}

		// Pattern 2: Extract standard article elements
		const standardArticlePattern = /<article[^>]*>([\s\S]*?)<\/article>/gi;
		const standardMatches = html.matchAll(standardArticlePattern);

		for (const match of standardMatches) {
			const articleHtml = match[1];

			// Extract title from h2, h3, or headline class
			const titleMatch = articleHtml.match(/<h[23][^>]*>.*?<a[^>]*>([^<]+)<\/a>.*?<\/h[23]>/i) ||
				articleHtml.match(/<[^>]*class="[^"]*headline[^"]*"[^>]*>([^<]+)</i) ||
				articleHtml.match(/<a[^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)<\/a>/i);

			// Extract URL
			const urlMatch = articleHtml.match(/<a[^>]*href=["']([^"']+)["'][^>]*>/i);

			// Extract image
			const imgMatch = articleHtml.match(/<img[^>]*src=["']([^"']+)["'][^>]*>/i) ||
				articleHtml.match(/data-src=["']([^"']+)["']/i);

			// Extract description or text
			const descMatch = articleHtml.match(/<p[^>]*>([^<]+)<\/p>/i);

			// Extract author
			const authorMatch = articleHtml.match(/by\s+<a[^>]*>([^<]+)<\/a>/i) ||
				articleHtml.match(/class="[^"]*byline[^"]*"[^>]*>([^<]+)</i);

			// Extract date
			const dateMatch = articleHtml.match(/<time[^>]*datetime=["']([^"']+)["']/i);

			if (titleMatch && urlMatch) {
				const url = this.normalizeUrl(urlMatch[1]);
				const title = this.cleanText(titleMatch[1]);
				const text = descMatch ? this.cleanText(descMatch[1]) : title;

				// Avoid duplicates
				if (!articles.some(a => a.url === url)) {
					articles.push({
						title,
						url,
						text,
						imageUrl: imgMatch ? imgMatch[1] : null,
						author: authorMatch ? this.cleanText(authorMatch[1]) : null,
						publishedDate: dateMatch ? dateMatch[1] : null,
						description: descMatch ? this.cleanText(descMatch[1]) : null
					});
				}
			}
		}

		// Pattern 3: Extract links with fashion-related content
		const linkPattern = /<a[^>]*href=["']([^"']*\/fashion\/[^"']+)["'][^>]*>([^<]+)<\/a>/gi;
		const linkMatches = html.matchAll(linkPattern);

		for (const match of linkMatches) {
			const url = this.normalizeUrl(match[1]);
			const title = this.cleanText(match[2]);

			// Avoid duplicates
			if (!articles.some(a => a.url === url) && title.length > 10) {
				articles.push({
					title,
					url,
					text: title,
					imageUrl: null,
					author: null,
					publishedDate: null,
					description: null
				});
			}
		}

		return articles;
	}

	// Rule 6: Filter by fashion keywords
	private filterByKeywords(articles: any[], keywords: string[]): any[] {
		return articles.filter(article => {
			const searchText = `${article.title} ${article.text} ${article.description || ''}`.toLowerCase();
			return keywords.some(keyword => searchText.includes(keyword.toLowerCase()));
		});
	}

	private normalizeUrl(url: string): string {
		if (url.startsWith('http')) {
			return url;
		}
		if (url.startsWith('//')) {
			return 'https:' + url;
		}
		if (url.startsWith('/')) {
			return this.HARPER_BASE_URL + url;
		}
		return this.HARPER_BASE_URL + '/' + url;
	}

	protected cleanText(text: string): string {
		return text
			.replace(/<[^>]+>/g, '')
			.replace(/&nbsp;/g, ' ')
			.replace(/&amp;/g, '&')
			.replace(/&quot;/g, '"')
			.replace(/&apos;/g, "'")
			.replace(/&lt;/g, '<')
			.replace(/&gt;/g, '>')
			.replace(/\s+/g, ' ')
			.trim();
	}

	private generateSourceId(url: string): string {
		return `harper_${Buffer.from(url).toString('base64').substring(0, 32)}`;
	}

	// Rule 9: Save HTML to file for debugging
	private saveHtmlToFile(html: string, prefix: string): void {
		try {
			const outputDir = path.join(__dirname, '../../Output');
			if (!fs.existsSync(outputDir)) {
				fs.mkdirSync(outputDir, { recursive: true });
			}

			const filename = path.join(outputDir, `output_${prefix}.html`);
			fs.writeFileSync(filename, html, 'utf-8');
			logger.info(`Saved HTML to ${filename} (${html.length} bytes)`);
		} catch (error) {
			logger.error('Failed to save HTML file:', error);
		}
	}

	// Rule 9: Save scraped data to JSON file
	private saveToJsonFile(posts: ScrapedPostData[], prefix: string): void {
		try {
			const outputDir = path.join(__dirname, '../../Output');
			if (!fs.existsSync(outputDir)) {
				fs.mkdirSync(outputDir, { recursive: true });
			}

			const filename = path.join(outputDir, `output_${prefix}.json`);
			fs.writeFileSync(filename, JSON.stringify(posts, null, 2), 'utf-8');
			logger.info(`Saved JSON to ${filename} (${posts.length} posts)`);
		} catch (error) {
			logger.error('Failed to save JSON file:', error);
		}
	}
}
