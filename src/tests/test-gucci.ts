/**
 * Gucci Press Scraper Test
 * Tests Gucci press page scraping with fashion-oriented keywords
 */
import { GucciSource } from '../sources/gucci.source';
import { ScrapingConditions } from '../sources/base.source';

async function testGucciScraper() {
	console.log('\n==========================================================');
	console.log('🧪 TESTING GUCCI PRESS SCRAPER');
	console.log('==========================================================\n');

	const scraper = new GucciSource();

	try {
		// Test 1: Connection Test
		console.log('📡 Test 1: Testing Gucci search connection...');
		await scraper.initialize();
		const isConnected = await scraper.testConnection();

		if (isConnected) {
			console.log('✅ Connection successful!\n');
		} else {
			console.log('⚠️  Connection test failed, but continuing with scraping attempt...\n');
		}

		// Test 2: Scrape with default fashion keywords
		console.log('📰 Test 2: Scraping Gucci search with fashion keywords...');
		console.log('⏳ This may take 1-2 minutes...\n');

		const posts = await scraper.scrape({
			maxResults: 20,
			pageTimeout: 90000
		});

		console.log('==========================================================');
		console.log(`✅ SCRAPING COMPLETED - Found ${posts.length} articles`);
		console.log('==========================================================\n');

		if (posts.length > 0) {
			// Display summary
			console.log('📊 SCRAPING SUMMARY:');
			console.log('----------------------------------------------------------');
			console.log(`Total Articles: ${posts.length}`);
			console.log(`Source: Gucci Official Press`);
			console.log(`Platform: ${posts[0].platform}`);
			console.log('');

			// Display first 5 articles
			console.log('📰 ARTICLES FOUND:');
			console.log('----------------------------------------------------------');

			const articlesToShow = posts.slice(0, 5);

			articlesToShow.forEach((post, index) => {
				console.log(`\n${index + 1}. ${post.author}`);
				console.log(`   📅 Posted: ${post.postedAt.toISOString()}`);
				console.log(`   🔗 URL: ${post.sourceUrl}`);
				console.log(`   📝 Content: ${post.text.substring(0, 150)}${post.text.length > 150 ? '...' : ''}`);
				console.log(`   🖼️  Images: ${post.mediaUrls?.length || 0}`);
			});

			console.log('\n');

			// Test 3: Scrape with specific keywords
			console.log('📰 Test 3: Scraping with specific fashion keywords...');
			console.log('   Keywords: collection, runway, campaign');
			console.log('   Max Results: 10');
			console.log('⏳ This may take 1 minute...\n');

			const customConditions: ScrapingConditions = {
				keywords: ['collection', 'runway', 'campaign', 'fashion', 'style'],
				maxResults: 10,
				pageTimeout: 60000,
			};

			const customPosts = await scraper.scrape(customConditions);

			console.log('==========================================================');
			console.log(`✅ CUSTOM SCRAPING COMPLETED - Found ${customPosts.length} articles`);
			console.log('==========================================================\n');

			if (customPosts.length > 0) {
				console.log('📋 SAMPLE ARTICLE DATA (First Article):');
				console.log('----------------------------------------------------------');
				const samplePost = customPosts[0];
				console.log(JSON.stringify({
					platformPostId: samplePost.platformPostId,
					platform: samplePost.platform,
					author: samplePost.author,
					authorHandle: samplePost.authorHandle,
					text: samplePost.text.substring(0, 200) + '...',
					postedAt: samplePost.postedAt,
					sourceUrl: samplePost.sourceUrl,
					mediaCount: samplePost.mediaUrls?.length || 0,
				}, null, 2));
			} else {
				console.log('ℹ️  No articles found with the specified keywords');
			}

			console.log('\n');
			console.log('📁 HTML Output saved to: Backend/Output/output_gucci.html');

		} else {
			console.log('⚠️  No articles found. This could be due to:');
			console.log('   - The page structure may have changed');
			console.log('   - Content is loaded dynamically via JavaScript');
			console.log('   - Network issues or rate limiting');
			console.log('   - The selectors need to be updated');
			console.log('\n   Check the output_gucci.html file to see the raw HTML');
		}

	} catch (error: any) {
		console.error('\n❌ ERROR:', error.message);
		console.error('Stack:', error.stack);
	} finally {
		// Cleanup
		console.log('\n🧹 Cleaning up...');
		await scraper.cleanup();
		console.log('✅ Cleanup complete');
		console.log('\n==========================================================\n');
	}
}

// Run the test
testGucciScraper()
	.then(() => {
		console.log('Test completed successfully');
		process.exit(0);
	})
	.catch((error) => {
		console.error('Test failed:', error);
		process.exit(1);
	});
