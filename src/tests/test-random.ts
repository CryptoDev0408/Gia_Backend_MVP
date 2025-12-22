/**
 * Test EtcSocial Random URL Scraper
 * Tests the generic scraper with various URLs and saves HTML to output.html
 */
import { EtcSocialSource } from '../sources/etc-social.source';
import { writeFileSync } from 'fs';
import { join } from 'path';

async function testRandomURLScraping() {
	const scraper = new EtcSocialSource();

	try {
		console.log('\n========================================');
		console.log('🌐 EtcSocial Random URL Scraper Test');
		console.log('========================================\n');

		// Initialize scraper
		await scraper.initialize();
		console.log('✓ Scraper initialized\n');

		// Test URLs - you can change these to any URLs you want to scrape
		const testURLs = [
			// 'https://www.instagram.com/p/DPHKxXWEiyb/?igsh=bG9uZm1zeHR1Nndu',
			// 'https://www.upwork.com/jobs/~021968034018269460686',
			// 'https://about.google/',
			// 'https://x.com/ofviince/',
			"https://www.gucci.com/press"
		];

		// Get URL from command line if provided
		const cliUrl = process.argv[2];
		const urlsToScrape = cliUrl ? [cliUrl] : testURLs;

		console.log(`📍 URLs to scrape: ${urlsToScrape.length}\n`);

		// Scrape the URLs
		const results = await scraper.scrape({
			urls: urlsToScrape,
			pageTimeout: 30000
		});

		console.log('\n========================================');
		console.log('📊 Scraping Results');
		console.log('========================================\n');

		console.log(`Total pages scraped: ${results.length}\n`);

		// Display results
		results.forEach((result, index) => {
			console.log(`\n--- Page ${index + 1} ---`);
			console.log(`URL: ${result.sourceUrl}`);
			console.log(`Title: ${result.text}`);
			console.log(`Author: ${result.author}`);
			console.log(`Domain: ${result.authorHandle}`);
			console.log(`HTML Size: ${(result.rawContent.html.length / 1024).toFixed(2)} KB`);
			console.log(`Fetched At: ${result.rawContent.fetchedAt}`);

			// Show first 500 characters of HTML
			console.log('\n📄 HTML Preview (first 500 chars):');
			console.log('─'.repeat(80));
			console.log(result.rawContent.html.substring(0, 500));
			console.log('...');
			console.log('─'.repeat(80));
		});

		// Test fetchRawHTML method directly and save to file
		if (urlsToScrape.length > 0) {
			console.log('\n\n========================================');
			console.log('🔍 Fetching Raw HTML and Saving to File');
			console.log('========================================\n');

			const testUrl = urlsToScrape[0];
			console.log(`Fetching raw HTML from: ${testUrl}\n`);

			const rawHtml = await scraper.fetchRawHTML(testUrl);

			console.log(`✓ Raw HTML fetched successfully`);
			console.log(`HTML Length: ${rawHtml.length} characters`);
			console.log(`HTML Size: ${(rawHtml.length / 1024).toFixed(2)} KB\n`);

			// Save to output.html file
			const outputPath = join(process.cwd(), 'output.html');
			writeFileSync(outputPath, rawHtml, 'utf-8');

			console.log(`✓ Raw HTML saved to: ${outputPath}`);
			console.log(`📄 File size: ${(rawHtml.length / 1024).toFixed(2)} KB\n`);
		}

		console.log('\n✅ Test completed successfully!\n');

	} catch (error: any) {
		console.error('\n❌ Test failed:', error.message);
		console.error(error);
	} finally {
		// Cleanup
		await scraper.cleanup();
		console.log('🧹 Cleanup completed\n');
	}
}

// Run the test
testRandomURLScraping();
