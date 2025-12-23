import { HarperSource } from '../sources/harper.source';
import { logger } from '../utils/logger';

/**
 * Test Harper's Bazaar Scraper
 * Tests the scraping functionality for Harper's Bazaar fashion section
 */
async function testHarperScraper() {
	logger.info('=== Starting Harper\'s Bazaar Scraper Test ===');

	const harperSource = new HarperSource();

	try {
		// Test 1: Connection Test
		logger.info('\n--- Test 1: Connection Test ---');
		const connectionOk = await harperSource.testConnection();
		logger.info(`Connection test result: ${connectionOk ? 'SUCCESS ✓' : 'FAILED ✗'}`);

		if (!connectionOk) {
			logger.error('Connection test failed. Stopping tests.');
			return;
		}

		// Test 2: Initialize Scraper
		logger.info('\n--- Test 2: Initialize Scraper ---');
		await harperSource.initialize();
		logger.info('Scraper initialized successfully ✓');

		// Test 3: Scrape with Fashion Keywords
		logger.info('\n--- Test 3: Scrape Fashion Content ---');
		const posts = await harperSource.scrape({
			keywords: [
				'fashion',
				'style',
				'designer',
				'collection',
				'runway',
				'trend',
				'couture',
				'luxury'
			],
			maxResults: 20,
		});

		logger.info(`\n=== Scraping Results ===`);
		logger.info(`Total posts found: ${posts.length}`);

		if (posts.length > 0) {
			logger.info(`\n--- Sample Posts ---`);
			posts.slice(0, 5).forEach((post, index) => {
				logger.info(`\nPost ${index + 1}:`);
				logger.info(`  Platform: ${post.platform}`);
				logger.info(`  Author: ${post.author}`);
				logger.info(`  Text: ${post.text?.substring(0, 100)}...`);
				logger.info(`  URL: ${post.sourceUrl}`);
				logger.info(`  Media URLs: ${post.mediaUrls?.length || 0} images`);
				logger.info(`  Likes: ${post.likes}`);
				logger.info(`  Posted: ${post.postedAt}`);
			});

			logger.info(`\n--- Statistics ---`);
			const withImages = posts.filter(p => p.mediaUrls && p.mediaUrls.length > 0).length;
			const withText = posts.filter(p => p.text && p.text.length > 0).length;

			logger.info(`Posts with images: ${withImages}/${posts.length} (${Math.round(withImages / posts.length * 100)}%)`);
			logger.info(`Posts with text: ${withText}/${posts.length} (${Math.round(withText / posts.length * 100)}%)`);
		}

		// Test 4: Cleanup
		logger.info('\n--- Test 4: Cleanup ---');
		await harperSource.cleanup();
		logger.info('Scraper cleaned up successfully ✓');

		logger.info('\n=== All Tests Completed Successfully ✓ ===');

	} catch (error) {
		logger.error('Test failed:', error);
		throw error;
	} finally {
		// Ensure cleanup happens
		try {
			await harperSource.cleanup();
		} catch (e) {
			// Ignore cleanup errors
		}
	}
}

// Run the test
testHarperScraper()
	.then(() => {
		logger.info('\n✓ Test suite completed');
		process.exit(0);
	})
	.catch((error) => {
		logger.error('\n✗ Test suite failed:', error);
		process.exit(1);
	});
