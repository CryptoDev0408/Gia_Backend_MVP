import { EtcSocialSource } from '../sources/etc-social.source';
import { logger } from '../utils/logger';

/**
 * Test EtcSocial Scraper
 * Tests the generic HTML scraping functionality
 */
async function testEtcScraper() {
	logger.info('=== Starting EtcSocial Scraper Test ===');

	const etcSource = new EtcSocialSource();

	try {
		// Test 1: Initialize Scraper
		logger.info('\n--- Test 1: Initialize Scraper ---');
		await etcSource.initialize();
		logger.info('Scraper initialized successfully ✓');

		// Test 2: Connection Test
		logger.info('\n--- Test 2: Connection Test ---');
		const connectionOk = await etcSource.testConnection();
		logger.info(`Connection test result: ${connectionOk ? 'SUCCESS ✓' : 'FAILED ✗'}`);

		// Test 3: Scrape Multiple URLs
		logger.info('\n--- Test 3: Scrape Fashion URLs ---');
		const posts = await etcSource.scrape({
			urls: [
				'https://fashionista.com/fashion-week'
			],
			maxResults: 10,
		});

		logger.info(`\n=== Scraping Results ===`);
		logger.info(`Total posts scraped: ${posts.length}`);

		if (posts.length > 0) {
			logger.info(`\n--- Sample Posts ---`);
			posts.forEach((post, index) => {
				logger.info(`\nPost ${index + 1}:`);
				logger.info(`  Platform: ${post.platform}`);
				logger.info(`  Author: ${post.author}`);
				logger.info(`  Author Handle: ${post.authorHandle}`);
				logger.info(`  Text: ${post.text?.substring(0, 100)}...`);
				logger.info(`  URL: ${post.sourceUrl}`);
				logger.info(`  HTML Size: ${(JSON.stringify(post.rawContent).length / 1024).toFixed(2)} KB`);

				if (post.rawContent) {
					const rawContent = post.rawContent as any;
					logger.info(`  Parsed Articles: ${rawContent.parsedContent?.articles?.length || 0}`);
					logger.info(`  Parsed Images: ${rawContent.parsedContent?.images?.length || 0}`);
					logger.info(`  Parsed Links: ${rawContent.parsedContent?.links?.length || 0}`);
				}
			});

			logger.info(`\n--- Statistics ---`);
			const totalHtmlSize = posts.reduce((sum, p) => sum + JSON.stringify(p.rawContent).length, 0);
			logger.info(`Total HTML fetched: ${(totalHtmlSize / 1024).toFixed(2)} KB`);
		}

		// Test 4: Cleanup
		logger.info('\n--- Test 4: Cleanup ---');
		await etcSource.cleanup();
		logger.info('Scraper cleaned up successfully ✓');

		logger.info('\n=== All Tests Completed Successfully ✓ ===');

	} catch (error) {
		logger.error('Test failed:', error);
		throw error;
	} finally {
		// Ensure cleanup happens
		try {
			await etcSource.cleanup();
		} catch (e) {
			// Ignore cleanup errors
		}
	}
}

// Run the test
testEtcScraper()
	.then(() => {
		logger.info('\n✓ Test suite completed');
		process.exit(0);
	})
	.catch((error) => {
		logger.error('\n✗ Test suite failed:', error);
		process.exit(1);
	});
