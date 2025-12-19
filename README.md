# GIA AI Blog Backend

AI-powered fashion trend analysis backend for GIA Token. Scrapes social media platforms (Twitter/X, Instagram), processes content with NLP, clusters similar posts, and generates AI insights.

## 🏗️ Architecture

```
┌──────────────────────────┐
│ Social Media Sources     │ ← Twitter API, Instagram Scraping
└────────────┬─────────────┘
             ↓
┌──────────────────────────┐
│ Scraping Layer           │ ← Playwright, Axios, Cron Jobs
└────────────┬─────────────┘
             ↓
┌──────────────────────────┐
│ Normalization Layer      │ ← Text cleaning, NLP extraction
└────────────┬─────────────┘
             ↓
┌──────────────────────────┐
│ Clustering Module        │ ← Hashtag/keyword grouping
└────────────┬─────────────┘
             ↓
┌──────────────────────────┐
│ AI Insight Generator     │ ← OpenAI GPT-4 integration
└────────────┬─────────────┘
             ↓
┌──────────────────────────┐
│ MySQL Database           │ ← Prisma ORM
└────────────┬─────────────┘
             ↓
┌──────────────────────────┐
│ REST API                 │ ← Express.js endpoints
└──────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- MySQL 8.0+
- Twitter API credentials
- OpenAI API key

### Installation

1. **Clone and install dependencies:**

```bash
cd Backend
npm install
```

2. **Configure environment:**

```bash
cp .env.example .env
# Edit .env with your credentials
```

3. **Setup database:**

```bash
npx prisma generate
npx prisma migrate dev
```

4. **Start development server:**

```bash
npm run dev
```

Server runs on `http://localhost:4000`

## 📡 API Endpoints

### Authentication

#### Wallet Authentication (Primary)

```bash
# Get nonce for wallet signature
POST /api/v1/auth/wallet/nonce
Body: { "walletAddress": "0x..." }

# Login with wallet
POST /api/v1/auth/wallet/login
Body: { "walletAddress": "0x...", "signature": "0x..." }
```

#### Email Authentication (Optional)

```bash
# Register
POST /api/v1/auth/register
Body: { "email": "user@example.com", "password": "...", "username": "..." }

# Login
POST /api/v1/auth/login
Body: { "email": "user@example.com", "password": "..." }
```

### Trends

```bash
# Get all active trends
GET /api/v1/trends?limit=10&offset=0&sortBy=trendScore

# Get single trend with all posts
GET /api/v1/trends/:id
```

### Posts (Requires Auth)

```bash
# Like/unlike post
POST /api/v1/posts/:id/like
Headers: { "Authorization": "Bearer <token>" }

# Save/unsave post
POST /api/v1/posts/:id/save

# Add comment
POST /api/v1/posts/:id/comment
Body: { "content": "Great style!" }

# Get saved posts
GET /api/v1/posts/saved
```

### Admin (Requires Admin Role)

```bash
# Trigger manual scraping
POST /api/v1/admin/scrape/trigger

# Get system stats
GET /api/v1/admin/stats

# Get job history
GET /api/v1/admin/jobs
```

## 🗄️ Database Schema

### Key Tables

- **users** - User accounts (wallet + email auth)
- **scraped_posts** - Raw scraped data
- **normalized_posts** - Processed & scored posts
- **trend_clusters** - Grouped trends with AI insights
- **post_likes/comments/saves** - User interactions
- **scraping_jobs** - Job tracking

## 🔄 Automated Pipeline

The scraping pipeline runs automatically every 6 hours (configurable):

1. **Scrape** posts from Twitter & Instagram
2. **Normalize** text, extract hashtags/keywords
3. **Cluster** similar posts together
4. **Generate** AI insights with OpenAI
5. **Calculate** trend scores & growth rates

Manually trigger: `POST /api/v1/admin/scrape/trigger`

## 🛠️ Development

### Scripts

```bash
npm run dev          # Start dev server with hot reload
npm run build        # Compile TypeScript
npm run start        # Start production server
npm run prisma:studio # Open Prisma Studio (DB GUI)
```

### Project Structure

```
src/
├── config/          # Configuration
├── database/        # Prisma client
├── jobs/            # Cron schedulers
├── middleware/      # Express middleware
├── routes/          # API routes
├── services/        # Business logic
│   ├── auth.service.ts
│   ├── scraping.service.ts
│   ├── normalization.service.ts
│   ├── clustering.service.ts
│   └── ai-insight.service.ts
├── sources/         # Social media scrapers
│   ├── base.source.ts
│   ├── twitter.source.ts
│   └── instagram.source.ts
├── utils/           # Utilities
└── server.ts        # Main entry point
```

## 🔐 Environment Variables

See `.env.example` for all required variables:

- `DATABASE_URL` - MySQL connection string
- `JWT_SECRET` - JWT signing secret
- `OPENAI_API_KEY` - OpenAI API key
- `TWITTER_BEARER_TOKEN` - Twitter API token
- Social media credentials

## 📊 Monitoring

- Logs: `logs/app.log`
- Error logs: `logs/error.log`
- Job status: `GET /api/v1/admin/jobs`
- System stats: `GET /api/v1/admin/stats`

## 🚨 Troubleshooting

### Database Connection Issues

```bash
# Check MySQL is running
mysql -u root -p

# Regenerate Prisma client
npx prisma generate
```

### Scraping Failures

- Check API credentials in `.env`
- Verify rate limits not exceeded
- Check logs in `logs/error.log`

### Instagram Scraping Issues

- Instagram requires browser automation
- May be blocked by rate limits
- Consider reducing scraping frequency

## 📝 License

MIT

## 🤝 Contributing

1. Create feature branch
2. Make changes
3. Add tests
4. Submit PR

## 📞 Support

For issues, contact the GIA development team.
