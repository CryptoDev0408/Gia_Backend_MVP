import { chromium, Browser, Page } from 'playwright';
import { BaseSocialMediaSource, ScrapedPostData, ScrapingConditions } from './base.source';
import { logger } from '../utils/logger';

/**
 * Instagram Fashion Scraper
 * Focuses on public fashion-oriented content without authentication
 */
export class InstagramFashionSource extends BaseSocialMediaSource {
	private browser: Browser | null = null;
	private page: Page | null = null;
	private isInitialized = false;

	// Default fashion-focused hashtags
	private readonly DEFAULT_FASHION_HASHTAGS = [
		'blockchain', 'ethereum', 'solana'
		// 'fashion',
		// 'fashiontrends',
		// 'streetstyle',
		// 'ootd',
		// 'fashionista',
		// 'fashionweek',
		// 'styleinspiration',
		// 'fashionblogger'
	];

	constructor() {
		super('INSTAGRAM');
	}

	async initialize(): Promise<void> {
		try {
			if (this.isInitialized && this.browser && this.page) {
				logger.info('Instagram scraper already initialized');
				return;
			}

			logger.info('Initializing Instagram fashion scraper...');

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
			await this.page.setViewportSize({ width: 1280, height: 720 });
			await this.page.setExtraHTTPHeaders({
				'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
				'Accept-Language': 'en-US,en;q=0.9',
			});

			this.isInitialized = true;
			logger.info('Instagram fashion scraper initialized successfully');
		} catch (error) {
			logger.error('Failed to initialize Instagram scraper:', error);
			throw error;
		}
	}

	async scrape(conditions: ScrapingConditions = {}): Promise<ScrapedPostData[]> {
		try {
			if (!this.isInitialized || !this.page) {
				await this.initialize();
			}

			const posts: ScrapedPostData[] = [];

			// Apply fashion-oriented conditions
			const hashtags = conditions.hashtags || this.DEFAULT_FASHION_HASHTAGS;
			const maxResults = conditions.maxResults || 50;
			const maxPerHashtag = conditions.maxPostsPerHashtag || 10;
			const pageTimeout = conditions.pageTimeout || 30000;
			const minLikes = conditions.minLikes || 0;

			logger.info(`Starting Instagram scraping with conditions:`, {
				hashtags: hashtags.slice(0, 3),
				maxResults,
				maxPerHashtag,
				minLikes
			});

			for (const hashtag of hashtags) {
				if (posts.length >= maxResults) {
					logger.info(`Reached max results limit (${maxResults})`);
					break;
				}

				try {
					const cleanHashtag = hashtag.replace('#', '').trim();
					const url = `https://www.instagram.com/explore/tags/${cleanHashtag}/`;
					// const url = `https://www.instagram.com/p/DPHKxXWEiyb/?igsh=bG9uZm1zeHR1Nndu`;

					logger.info(`Scraping hashtag: #${cleanHashtag}`);

					await this.page!.goto(url, {
						waitUntil: 'networkidle',
						timeout: pageTimeout
					});

					// Wait for React to render
					await this.page!.waitForTimeout(5000);

					// Extract data from embedded JSON
					const pageData = await this.page!.evaluate(() => {
						const posts: any[] = [];

						// Try to find shared data in scripts
						const scripts = Array.from(document.querySelectorAll('script'));
						for (const script of scripts) {
							const content = script.textContent || '';

							// Look for window._sharedData
							if (content.includes('window._sharedData')) {
								try {
									const match = content.match(/window\._sharedData\s*=\s*({.+?});/);
									if (match) {
										const sharedData = JSON.parse(match[1]);
										const tagData = sharedData?.entry_data?.TagPage?.[0]?.graphql?.hashtag;

										if (tagData?.edge_hashtag_to_media?.edges) {
											tagData.edge_hashtag_to_media.edges.forEach((edge: any) => {
												const node = edge.node;
												posts.push({
													postId: node.shortcode,
													url: `https://www.instagram.com/p/${node.shortcode}/`,
													imageUrl: node.display_url || node.thumbnail_src,
													caption: node.edge_media_to_caption?.edges?.[0]?.node?.text || '',
													likes: node.edge_liked_by?.count || node.edge_media_preview_like?.count || 0,
													comments: node.edge_media_to_comment?.count || 0,
													timestamp: node.taken_at_timestamp ? node.taken_at_timestamp * 1000 : Date.now(),
													author: node.owner?.username || 'unknown',
												});
											});
										}
									}
								} catch (e) {
									// Continue
								}
							}

							// Also try __additionalDataLoaded
							if (content.includes('additionalDataLoaded')) {
								try {
									const match = content.match(/"hashtag":\s*({.+?"edge_hashtag_to_media".+?})}}/);
									if (match) {
										const tagData = JSON.parse(match[1]);
										if (tagData?.edge_hashtag_to_media?.edges) {
											tagData.edge_hashtag_to_media.edges.forEach((edge: any) => {
												const node = edge.node;
												if (!posts.find(p => p.postId === node.shortcode)) {
													posts.push({
														postId: node.shortcode,
														url: `https://www.instagram.com/p/${node.shortcode}/`,
														imageUrl: node.display_url || node.thumbnail_src,
														caption: node.edge_media_to_caption?.edges?.[0]?.node?.text || '',
														likes: node.edge_liked_by?.count || node.edge_media_preview_like?.count || 0,
														comments: node.edge_media_to_comment?.count || 0,
														timestamp: node.taken_at_timestamp ? node.taken_at_timestamp * 1000 : Date.now(),
														author: node.owner?.username || 'unknown',
													});
												}
											});
										}
									}
								} catch (e) {
									// Continue
								}
							}
						}

						// Fallback: Try to extract from visible DOM
						if (posts.length === 0) {
							const links = document.querySelectorAll('a[href*="/p/"]');
							links.forEach((link, index) => {
								if (index >= 12) return;
								const href = (link as HTMLAnchorElement).href;
								const match = href.match(/\/p\/([^\/]+)\//);
								if (match) {
									const img = link.querySelector('img') as HTMLImageElement;
									posts.push({
										postId: match[1],
										url: href,
										imageUrl: img?.src || '',
										caption: img?.alt || '',
										likes: 0,
										comments: 0,
										timestamp: Date.now(),
										author: 'unknown',
									});
								}
							});
						}

						return posts;
					});

					logger.info(`Found ${pageData.length} posts for #${cleanHashtag}`);

					// Process posts
					const postsToProcess = pageData.slice(0, Math.min(maxPerHashtag, maxResults - posts.length));

					for (const post of postsToProcess) {
						try {
							// If we already have engagement data, use it directly
							if (post.likes > 0) {
								// Apply engagement threshold
								if (minLikes > 0 && post.likes < minLikes) {
									logger.info(`Skipping post with ${post.likes} likes (min: ${minLikes})`);
									continue;
								}

								posts.push({
									platformPostId: post.postId,
									platform: 'INSTAGRAM',
									author: 'Unknown',
									authorHandle: post.author || 'unknown',
									text: post.caption || '',
									mediaUrls: [post.imageUrl],
									postedAt: new Date(post.timestamp),
									likes: post.likes,
									comments: post.comments || 0,
									shares: 0,
									views: 0,
									sourceUrl: post.url,
									rawContent: post,
								});

								logger.info(`Added post ${post.postId} with ${post.likes} likes`);
								continue;
							}

							// Otherwise fetch details
							logger.info(`Fetching details for post: ${post.postId}`);

							await this.page!.goto(post.url, {
								waitUntil: 'domcontentloaded',
								timeout: pageTimeout
							});

							await this.page!.waitForTimeout(3000);

							// Extract detailed information
							const details = await this.page!.evaluate(() => {
								// Try to extract from embedded JSON first
								const scripts = Array.from(document.querySelectorAll('script'));
								for (const script of scripts) {
									try {
										const content = script.textContent || '';
										if (content.includes('window._sharedData')) {
											const match = content.match(/window\._sharedData\s*=\s*({.+?});/);
											if (match) {
												const sharedData = JSON.parse(match[1]);
												const media = sharedData?.entry_data?.PostPage?.[0]?.graphql?.shortcode_media;

												if (media) {
													const images = [media.display_url];
													if (media.edge_sidecar_to_children?.edges) {
														media.edge_sidecar_to_children.edges.forEach((edge: any) => {
															images.push(edge.node.display_url);
														});
													}

													return {
														caption: media.edge_media_to_caption?.edges?.[0]?.node?.text || '',
														author: media.owner?.full_name || media.owner?.username || 'Unknown',
														authorHandle: media.owner?.username || 'unknown',
														timestamp: media.taken_at_timestamp ? media.taken_at_timestamp * 1000 : Date.now(),
														likes: media.edge_media_preview_like?.count || 0,
														comments: media.edge_media_to_comment?.count || 0,
														images: images,
													};
												}
											}
										}
									} catch (e) {
										// Continue
									}
								}

								// Fallback to meta tags
								const getMetaContent = (property: string) => {
									const meta = document.querySelector(`meta[property="${property}"]`);
									return meta?.getAttribute('content') || '';
								};

								const imgs = document.querySelectorAll('article img[src*="cdninstagram"]');
								const images = Array.from(imgs)
									.map(img => (img as HTMLImageElement).src)
									.filter(src => src && !src.includes('profile'));

								return {
									caption: getMetaContent('og:description') || '',
									author: 'Unknown',
									authorHandle: 'unknown',
									timestamp: Date.now(),
									likes: 0,
									comments: 0,
									images: images,
								};
							});

							const likes = typeof details.likes === 'string'
								? parseInt(details.likes.replace(/,/g, ''), 10)
								: details.likes;

							// Apply engagement threshold
							if (minLikes > 0 && likes < minLikes) {
								logger.info(`Skipping post with ${likes} likes (min: ${minLikes})`);
								continue;
							}

							posts.push({
								platformPostId: post.postId,
								platform: 'INSTAGRAM',
								author: details.author || 'Unknown',
								authorHandle: details.authorHandle || 'unknown',
								text: details.caption || post.caption || '',
								mediaUrls: details.images.length > 0 ? details.images : [post.imageUrl],
								postedAt: new Date(details.timestamp),
								likes: likes,
								comments: details.comments || 0,
								shares: 0,
								views: 0,
								sourceUrl: post.url,
								rawContent: { ...post, ...details },
							});

							logger.info(`Added post with ${likes} likes`);

							if (posts.length >= maxResults) break;

						} catch (error) {
							logger.warn(`Failed to get details for post ${post.postId}:`, error);
							continue;
						}
					}

				} catch (error) {
					logger.warn(`Failed to scrape #${hashtag}:`, error);
					continue;
				}
			}

			logger.info(`Total scraped ${posts.length} fashion posts from Instagram`);
			return posts;

		} catch (error: any) {
			logger.error('Instagram scraping error:', error);
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
			logger.info('Instagram scraper cleaned up successfully');
		} catch (error) {
			logger.error('Instagram cleanup error:', error);
		}
	}

	async testConnection(): Promise<boolean> {
		try {
			if (!this.isInitialized) {
				await this.initialize();
			}

			if (!this.page) {
				return false;
			}

			await this.page.goto('https://www.instagram.com/explore/', {
				waitUntil: 'domcontentloaded',
				timeout: 15000
			});

			logger.info('Instagram connection test successful');
			return true;
		} catch (error) {
			logger.error('Instagram connection test failed:', error);
			return false;
		}
	}
}
