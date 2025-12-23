# Elle Fashion Scraper + AI Normalization

This workflow scrapes fashion articles from Elle.com and normalizes them using OpenAI GPT-4.

## Prerequisites

1. **OpenAI API Key** - Required for AI normalization
   - Get your API key from: https://platform.openai.com/api-keys
   - Add it to `.env` file (see step 2)

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure OpenAI API Key

Edit the `.env` file and replace the placeholder with your actual OpenAI API key:

```bash
# .env file
OPENAI_API_KEY=sk-your-actual-openai-api-key-here
OPENAI_MODEL=gpt-4o
```

⚠️ **Important**: Make sure to use a valid OpenAI API key starting with `sk-`

### 3. Run the Complete Workflow

```bash
npm run elle
```

This command will:

1. **Scrape** Elle.com fashion articles
2. **Normalize** with AI (OpenAI GPT-4)
3. **Save** results to `Output/normalized_elle.json`

## Workflow Details

### Step 1: Scraping

- **Source**: https://www.elle.com/fashion/
- **Method**: Playwright + axios (dual strategy)
- **Output**: JSON format with article data
- **Files Created**:
  - `Output/output_elle.html` - Raw HTML
  - `Output/output_elle.json` - Parsed JSON

### Step 2: AI Normalization

- **Input**: Scraped JSON data
- **AI Model**: GPT-4o
- **Prompt**: `prompts/fashion-prompt.txt`
- **Output Fields**:
  - `Title` - Article title
  - `AI_Insight` - 2-3 sentence trend analysis
  - `Image` - Primary image URL
  - `Description` - Clean 1-2 sentence summary
  - `Link` - Source URL
  - `Platform` - "ELLE"
  - `Hashtags` - 5-7 relevant fashion hashtags
- **File Created**:
  - `Output/normalized_elle.json` - AI-normalized data

## Output Format

The normalized JSON file contains an array of objects:

```json
[
  {
    "Title": "Spring 2025 Runway Trends",
    "AI_Insight": "This collection marks a significant shift towards sustainable luxury...",
    "Image": "https://hips.hearstapps.com/...",
    "Description": "Explore the top runway trends from Paris Fashion Week.",
    "Link": "https://www.elle.com/fashion/...",
    "Platform": "ELLE",
    "Hashtags": [
      "#FashionWeek2025",
      "#SustainableFashion",
      "#RunwayTrends",
      "#SpringFashion",
      "#ParisFashionWeek"
    ]
  }
]
```

## Troubleshooting

### Error: "Invalid API key"

- Check that your OpenAI API key in `.env` is correct
- Verify the key starts with `sk-`
- Ensure you have API credits in your OpenAI account

### Error: "Failed to load prompt template"

- Verify `prompts/fashion-prompt.txt` exists
- Check file permissions

### No Articles Scraped

- Check your internet connection
- The website structure may have changed
- Try increasing `pageTimeout` in the scraping conditions

## Files Structure

```
Backend/
├── src/
│   ├── sources/
│   │   └── elle.source.ts        # Elle scraper
│   ├── services/
│   │   └── normalization.service.ts  # AI normalization
│   └── tests/
│       └── test-elle.ts          # Complete workflow test
├── prompts/
│   └── fashion-prompt.txt        # OpenAI prompt template
├── Output/
│   ├── output_elle.html          # Raw HTML
│   ├── output_elle.json          # Scraped JSON
│   └── normalized_elle.json      # AI-normalized JSON
└── .env                          # Configuration (add your API key here)
```

## Other Available Scripts

```bash
npm run test:elle    # Same as 'npm run elle'
npm run test:harper  # Test Harper's Bazaar scraper
npm run test:etc     # Test generic ETC scraper
npm run dev          # Start backend server
```

## Cost Estimate

- **OpenAI API Usage**: ~$0.01 - $0.05 per 10 articles (GPT-4o)
- Depends on article length and response complexity

## API Rate Limits

- **Elle.com**: 2-second delay between requests (respectful scraping)
- **OpenAI**: Standard rate limits apply (see OpenAI dashboard)
