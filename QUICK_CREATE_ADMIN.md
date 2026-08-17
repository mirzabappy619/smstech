# Quick Start: Create Admin User

## Option 1: Promote Existing User (Fastest) ⚡

If you already have a user account:

1. **Open Supabase SQL Editor**
   - Go to your Supabase dashboard
   - Click "SQL Editor" in the left sidebar

2. **Find your auth ID:**

```sql
SELECT id as auth_id, email FROM auth.users WHERE email = 'your-email@example.com';
```

3. **Make yourself admin:**

```sql
INSERT INTO users (auth_id, email, role, first_name, last_name)
VALUES (
    'YOUR_AUTH_ID_FROM_STEP_2',
    'your-email@example.com',
    'admin',
    'Your First Name',
    'Your Last Name'
)
ON CONFLICT (auth_id)
DO UPDATE SET role = 'admin';
```

4. **Done!** Now try accessing `/admin`

---

## Option 2: Create New Admin User

### Step 1: Create Auth User in Supabase Dashboard

1. Go to **Authentication** → **Users** in Supabase
2. Click **"Add user"**
3. Select **"Create new user"**
4. Enter:
   - Email: `admin@example.com`
   - Password: `SecurePassword123!`
   - Auto Confirm User: **✅ Check this**
5. Click **"Create user"**

### Step 2: Get the Auth ID

Run this in SQL Editor:

```sql
SELECT id as auth_id, email FROM auth.users WHERE email = 'admin@example.com';
```

Copy the `auth_id` value.

### Step 3: Create User Profile

Replace `YOUR_AUTH_ID` with the value from Step 2:

```sql
INSERT INTO users (auth_id, email, role, first_name, last_name)
VALUES (
    'YOUR_AUTH_ID',
    'admin@example.com',
    'admin',
    'Admin',
    'User'
);
```

### Step 4: Login

1. Go to `http://localhost:3000/login`
2. Login with:
   - Email: `admin@example.com`
   - Password: `SecurePassword123!`
3. Visit `/admin` - you should now have access!

---

## Option 3: Development Shortcut (ONLY FOR TESTING)

Make ALL users admin temporarily:

```sql
UPDATE users SET role = 'admin';
```

⚠️ **Don't use this in production!**

---

## Roles Explained

| Role       | Access                     |
| ---------- | -------------------------- |
| `customer` | Storefront only            |
| `admin`    | Admin panel + Storefront   |
| `owner`    | Full system access         |
| `delivery` | Delivery features (future) |

---

## Troubleshooting

### "Access denied. Admin privileges required."

→ Your user exists but doesn't have admin role. Run the promotion SQL from Option 1.

### "Your account needs to be set up."

→ Your auth account exists but no profile in users table. Run Step 3 from Option 2.

### Still stuck?

Check if your user exists in both tables:

```sql
SELECT
    au.id as auth_id,
    au.email as auth_email,
    u.id as user_id,
    u.role
FROM auth.users au
LEFT JOIN users u ON au.id = u.auth_id
WHERE au.email = 'your-email@example.com';
```

If `user_id` is NULL, you need to create the profile (Option 2, Step 3).
If `role` is not 'admin' or 'owner', update it (Option 1, Step 3).
