# JustBet - Auction Platform

A modern auction bidding platform built with Express.js and PostgreSQL with role-based authentication and seller approval system.

## Project Structure

```
justbet/
├── backend/         # Express.js API server
├── frontend/        # React frontend application
└── README.md
```

## Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the backend directory with the following configuration:
```env
DB_USER=your_db_user
DB_HOST=your_db_host
DB_NAME=your_db_name
DB_PASSWORD=your_db_password
DB_PORT=5432
DB_SSL=true

PORT=3000

# SMTP
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_smtp_user
SMTP_PASS=your_smtp_password
EMAIL_FROM=your_email_from
CLIENT_URL=http://localhost:3000

JWT_SECRET=your_jwt_secret

FRONTEND_URL=http://localhost:5173

# Blob storage
AZURE_BLOB_CONTAINER=your_container
AZURE_STORAGE_ACCOUNT_NAME=your_storage_account
AZURE_STORAGE_CONNECTION_STRING=your_connection_string
AZURE_STORAGE_ACCESS_KEY=your_access_key

# Redis
REDIS_HOST=your_redis_host
REDIS_PORT=6380
REDIS_PASSWORD=your_redis_password
REDIS_SSL=true

NODE_ENV=development

# Stripe API keys
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
ALLOW_DIRECT_API_ACCESS=true  # Set to false in production
```

4. Start the development server:
```bash
npm run dev
```

The server will automatically:
- Connect to the database
- Create necessary tables if they don't exist
- Create an initial admin user if no users exist

## Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the frontend directory with the following configuration:
```env
VITE_BACKEND_URL=http://localhost:3000
VITE_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
```

4. Start the frontend development server:
```bash
npm run dev
```

## Project Structure and Dependency Management

- The backend and frontend each have their own `package.json` and `package-lock.json` files.
- Always run `npm install` and `npm run dev` in the respective `backend` or `frontend` directory.

## API Documentation

- All API routes are fully documented in `ROUTES.md`, and `Routes.md` in the project root. Refer to that file for the latest and complete list of endpoints.

## Role-Based Authentication System

### User Roles
- **Buyer** (default): Can browse and bid on auctions
- **Seller**: Can create and manage auctions (requires admin approval)
- **Admin**: Can approve/reject seller requests and manage the platform

### Admin Management

#### Get Pending Seller Approvals
```http
GET /admin/pending-sellers
Authorization: Bearer <ADMIN_JWT_TOKEN>
```

#### Approve/Reject Seller
```http
PATCH /admin/sellers/:userId/approve
Authorization: Bearer <ADMIN_JWT_TOKEN>
Content-Type: application/json


## Route Guards and Middleware

### Authentication Middleware (`jwtauth.js`)
- Verifies JWT tokens from cookies or Authorization header
- Fetches current user data from database
- Attaches user info to request object

### Role Authorization Middleware (`roleAuth.js`)
- Checks if user has required role(s)
- For sellers, verifies approval status
- Returns 403 Forbidden for insufficient permissions

### Admin Route Protection
All admin routes are protected with:
```javascript
router.use(jwtauthMiddleware);
router.use(roleAuth(['admin']));
```

## Development Guidelines

1. Code Style:
   - Use meaningful variable names
   - Keep functions small and focused
   - Add comments for complex logic
   - Follow the existing code structure

2. Error Handling:
   - Use try-catch blocks for async operations
   - Return appropriate HTTP status codes
   - Log errors for debugging

3. Important:
   - Always validate user input
   - Use role-based access control
   - Implement proper JWT token handling
   - Sanitize database queries

4. Make a PR and Ask for Reviews

## Notes

- The verification token will be sent to the email address provided during registration
- Login Session expire after 60 minutes, You can always click on Extend to Extend Session
- Default admin credentials: `admin@justbet.com` / `admin123`

## License

This project is proprietary and confidential to Nimbus Systems.
