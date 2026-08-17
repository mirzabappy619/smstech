#!/bin/bash

# Comprehensive Sample Data Loader for E-commerce Platform
# Run this script to populate your database with realistic sample data
# including products, categories, and landing pages

set -e  # Exit on error

echo "🚀 Loading comprehensive sample data..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if required environment variables are set
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo -e "${RED}❌ Error: Supabase environment variables not found${NC}"
    echo "Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in your .env.local file"
    exit 1
fi

echo -e "${BLUE}📊 Sample Data Summary:${NC}"
echo "• 8 main categories (Electronics, Clothing, Home & Garden, etc.)"
echo "• 20+ subcategories for better organization" 
echo "• 16 diverse products across all categories"
echo "• 60+ product variations (sizes, colors, storage, etc.)"
echo "• Realistic inventory levels for all items"
echo "• 5 complete landing pages with different block types"
echo "• 4 promotional coupons and delivery zones"
echo ""

echo -e "${YELLOW}⏳ This will populate your database with sample data...${NC}"
read -p "Continue? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
fi

echo ""
echo -e "${BLUE}📦 Loading sample data from supabase-seed.sql...${NC}"

# Check if the seed file exists
if [ ! -f "supabase-seed.sql" ]; then
    echo -e "${RED}❌ supabase-seed.sql file not found${NC}"
    echo "Please run this script from the project root directory"
    exit 1
fi

# Apply the sample data
psql "${DATABASE_URL:-postgresql://postgres:password@localhost:54322/postgres}" \
    -f supabase-seed.sql \
    -v ON_ERROR_STOP=1 || {
    
    echo -e "${RED}❌ Failed to load sample data via psql${NC}"
    echo ""
    echo -e "${YELLOW}💡 Alternative: Copy the contents of supabase-seed.sql and paste into your Supabase SQL Editor${NC}"
    echo "1. Open Supabase Dashboard → SQL Editor"
    echo "2. Copy contents of supabase-seed.sql"
    echo "3. Paste and run the SQL"
    exit 1
}

echo ""
echo -e "${GREEN}✅ Sample data loaded successfully!${NC}"
echo ""
echo -e "${BLUE}📋 What was created:${NC}"
echo ""
echo -e "${GREEN}🗂️  Categories:${NC}"
echo "• Electronics → Smartphones, Laptops, Audio, Smart Home, Gaming"
echo "• Clothing → Men, Women, Kids, Accessories"  
echo "• Home & Garden → Furniture, Decor, Lighting, Garden Tools"
echo "• Sports & Fitness → Exercise Equipment, Athletic Wear, Outdoor Sports"
echo "• Health & Beauty → Skincare, Makeup, Hair Care, Wellness"
echo "• Kitchen & Dining, Books & Media, Toys & Games"
echo ""
echo -e "${GREEN}📱 Sample Products:${NC}"
echo "• Pro Smartphone X12 (3 storage, 3 color options)"
echo "• Budget Smart Phone Z5 (3 color options)"
echo "• Wireless Noise-Canceling Headphones Pro (4 colors)"
echo "• Ultra Slim Laptop Pro 15 (2 storage, 2 color options)"
echo "• Gaming Laptop Beast 17 (2 storage options)"
echo "• Classic Cotton T-Shirt (4 sizes, 3 colors)"
echo "• Premium Denim Jeans (10 size combinations)"
echo "• Elegant Summer Dress (3 sizes, 2 colors)"
echo "• Adjustable Dumbbell Set Pro"
echo "• Pro Running Shoes Elite (6 sizes, 2 colors)"
echo "• Anti-Aging Vitamin C Serum"
echo "• And more..."
echo ""
echo -e "${GREEN}🎨 Landing Pages:${NC}"
echo "• /landing/new-smartphone-launch - Product launch page"
echo "• /landing/summer-fashion-sale - Sale/promotion page" 
echo "• /landing/home-fitness-guide - Educational/guide page"
echo "• /landing/smart-home-essentials - Bundle/package page"
echo "• /landing/skincare-routine - Category-focused page"
echo ""
echo -e "${GREEN}🎫 Coupons Available:${NC}"
echo "• WELCOME10 - 10% off orders over $50"
echo "• SAVE20 - $20 off orders over $100" 
echo "• FREESHIP - Free shipping on orders over $75"
echo "• SUMMER25 - 25% off orders over $150"
echo ""
echo -e "${BLUE}🔗 Quick Links:${NC}"
echo "• Admin Dashboard: http://localhost:3000/admin"
echo "• Products Management: http://localhost:3000/admin/products" 
echo "• Landing Page Builder: http://localhost:3000/admin/landing-pages"
echo "• Storefront: http://localhost:3000"
echo ""
echo -e "${GREEN}🎉 Your e-commerce platform is now loaded with realistic sample data!${NC}"
echo "You can start exploring the admin panel and storefront immediately."