# Sample Orders Not Found

## Issue

The admin order details page shows "Order not found" because there are no orders in the database yet.

## Solution

You have 3 options:

### Option 1: Create Orders via Storefront (Recommended)

1. Go to the storefront ([http://localhost:3000](http://localhost:3000))
2. Browse products and add items to your cart
3. Complete the checkout process
4. The order will then appear in the admin panel

### Option 2: Run Sample Orders SQL

I've created a sample orders SQL file at `supabase/seed/sample-orders.sql`.

To use it:

1. Open your Supabase project dashboard
2. Go to the SQL Editor
3. Copy and paste the contents of `supabase/seed/sample-orders.sql`
4. Click "Run" to execute
5. This will create 3 sample orders with different statuses

**Note:** Make sure you have at least one user account in your database first. The script will use the first available user.

### Option 3: Quick Order Creation via API

You can also create an order via the API:

```bash
# First, login to get auth token
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-email@example.com",
    "password": "your-password"
  }'

# Then create an order (use the token from login)
curl -X POST http://localhost:3000/api/v1/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "items": [
      {
        "product_id": "a1111111-1111-1111-1111-111111111111",
        "quantity": 1
      }
    ],
    "shipping_address": {
      "first_name": "John",
      "last_name": "Doe",
      "address_line1": "123 Main St",
      "city": "New York",
      "state": "NY",
      "postal_code": "10001",
      "country": "United States",
      "phone": "+1 555-123-4567"
    },
    "billing_address": {
      "first_name": "John",
      "last_name": "Doe",
      "address_line1": "123 Main St",
      "city": "New York",
      "state": "NY",
      "postal_code": "10001",
      "country": "United States"
    },
    "payment_method": "cash_on_delivery"
  }'
```

## What's Fixed

The order details page now:

- ✅ Fetches real order data from the API
- ✅ Shows proper error messages when orders don't exist
- ✅ Displays authentication errors clearly
- ✅ Handles all edge cases gracefully
- ✅ Updates order status correctly via PUT request

Once you create some orders using any of the methods above, the admin order details page will work perfectly!
