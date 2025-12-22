/**
 * Elle Fashion Scraper Test
 * Tests Elle.com fashion page scraping
 */
import { ElleSource } from '../sources/elle.source';
import { ScrapingConditions } from '../sources/base.source';

async function testElleScraper() {
	console.log('\n==========================================================');
	console.log('🧪 TESTING ELLE FASHION SCRAPER');
	console.log('==========================================================\n');

	const scraper = new ElleSource();

	try {
		// Test 1: Connection Test
		console.log('📡 Test 1: Testing Elle fashion connection...');
		await scraper.initialize();
		const isConnected = await scraper.testConnection();

		if (isConnected) {
			console.log('✅ Connection successful!\n');
		} else {
			console.log('⚠️  Connection test failed, but continuing with scraping attempt...\n');
		}

		// Test 2: Scrape with default fashion keywords
		console.log('📰 Test 2: Scraping Elle fashion with default keywords...');
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
			console.log(`Source: Elle Fashion`);
			console.log(`Platform: ${posts[0].platform}`);
			console.log('');

			// Display first 5 articles
			console.log('📰 ARTICLES FOUND:');
			console.log('----------------------------------------------------------');

			const articlesToShow = posts.slice(0, 5);

			articlesToShow.forEach((post, index) => {
				console.log(`\n${index + 1}. ${post.rawContent?.title || 'Untitled'}`);
				console.log(`   ✍️  Author: ${post.author}`);
				console.log(`   📅 Posted: ${post.postedAt.toISOString()}`);
				console.log(`   🔗 URL: ${post.sourceUrl}`);
				console.log(`   📝 Description: ${post.rawContent?.description || 'No description'}`);
				console.log(`   🖼️  Images: ${post.mediaUrls?.length || 0}`);
			});

			console.log('\n');

			// Test 3: Scrape with specific keywords
			console.log('📰 Test 3: Scraping with specific fashion keywords...');
			console.log('   Keywords: designer, runway, launch');
			console.log('   Max Results: 10');
			console.log('⏳ This may take 1 minute...\n');

			const customConditions: ScrapingConditions = {
				keywords: ['designer', 'runway', 'launch', 'collection', 'style'],
				maxResults: 10,
				pageTimeout: 90000,
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
					title: samplePost.rawContent?.title,
					author: samplePost.author,
					description: samplePost.rawContent?.description,
					postedAt: samplePost.postedAt,
					sourceUrl: samplePost.sourceUrl,
					mediaCount: samplePost.mediaUrls?.length || 0,
				}, null, 2));
			} else {
				console.log('ℹ️  No articles found with the specified keywords');
			}

			console.log('\n');
			console.log('📁 HTML Output saved to: Backend/Output/output_elle.html');
			console.log('📁 JSON Output saved to: Backend/Output/output_elle.json');

		} else {
			console.log('⚠️  No articles found. This could be due to:');
			console.log('   - The page structure may have changed');
			console.log('   - Content is loaded dynamically via JavaScript');
			console.log('   - Network issues or rate limiting');
			console.log('   - The selectors need to be updated');
			console.log('\n   Check the output_elle.html file to see the raw HTML');
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
testElleScraper()
	.then(() => {
		console.log('Test completed successfully');
		process.exit(0);
	})
	.catch((error) => {
		console.error('Test failed:', error);
		process.exit(1);
	});
