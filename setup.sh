#!/bin/bash

# GIA Backend Quick Setup Script
echo "🚀 GIA Backend Setup Script"
echo "============================"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from .env.example..."
    cp .env.example .env
    echo "✅ .env file created!"
    echo "⚠️  Please edit .env and add your actual credentials:"
    echo "   - DATABASE_URL (MySQL connection string)"
    echo "   - OPENAI_API_KEY"
    echo "   - SOCIAL_TWITTER_API_* (Twitter API credentials)"
    echo "   - SOCIAL_INSTAGRAM_API_* (Instagram credentials)"
    echo ""
else
    echo "✅ .env file already exists"
    echo ""
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install
echo "✅ Dependencies installed!"
echo ""

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npm run prisma:generate
echo "✅ Prisma client generated!"
echo ""

# Run migrations
echo "🗄️  Running database migrations..."
echo "⚠️  Make sure MySQL is running and DATABASE_URL is configured correctly!"
read -p "Press Enter to continue or Ctrl+C to cancel..."
npm run prisma:migrate
echo "✅ Migrations completed!"
echo ""

# Final message
echo "============================"
echo "✅ Backend setup complete!"
echo ""
echo "To start the development server:"
echo "  npm run dev"
echo ""
echo "The server will run on: http://localhost:5005"
echo "============================"
