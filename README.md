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
# Server Configuration
PORT=3000

# Database Configuration
DB_USER=your_db_user
DB_HOST=localhost
DB_NAME=justbet
DB_PASSWORD=your_db_password
DB_PORT=5432

# JWT Configuration
JWT_SECRET=your_jwt_secret_key

# Email Configuration
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your_smtp_username
SMTP_PASS=your_smtp_password
EMAIL_FROM=noreply@justbet.com
```

4. Start the development server:
```bash
npm run dev
```

The server will automatically:
- Connect to the database
- Create necessary tables if they don't exist
- Create an initial admin user if no users exist

## Role-Based Authentication System

### User Roles
- **Buyer** (default): Can browse and bid on auctions
- **Seller**: Can create and manage auctions (requires admin approval)
- **Admin**: Can approve/reject seller requests and manage the platform

### Authentication Flow
1. Users register as buyers by default
2. Buyers can request to become sellers by providing business details
3. Admin reviews and approves/rejects seller requests
4. Only approved sellers can access seller-specific features

## API Endpoints

### Authentication

#### Register User (Default Buyer)
```http
POST /auth/register
Content-Type: application/json

{
  "firstName": "Rajveer",
  "lastName": "Singh",
  "email": "rajveer@example.com",
  "password": "password123",
  "confirmPassword": "password123"

**Response:**
```json
{
  "message": "Registration successful. Please check your email to verify your account.",
  "user": {
    "id": "uuid-here",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "role": "buyer"
  }
}
```

#### Verify Email
```http
GET /auth/verify-email?token=<verification_token>
```

**Response:**
```json
{
  "message": "Email verified successfully"
}
```

#### Login User
```http
POST /auth/login
Content-Type: application/json

{
  "email": "rajveer@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "message": "Login successful",
  "token": "jwt-token-here",
  "expiresIn": "30m",
  "user": {
    "id": "uuid-here",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "role": "buyer",
    "isApproved": false
  }
}
```

#### Get User Profile
```http
GET /auth/profile
Authorization: Bearer <JWT_TOKEN>
```

**Response:**
```json
{
  "user": {
    "id": "uuid-here",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "role": "buyer",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### Logout
```http
POST /auth/logout
Authorization: Bearer <JWT_TOKEN>
```

**Response:**
```json
{
  "message": "Logged out successfully"
}
```

### Seller Management

#### Request to Become Seller
```http
POST /seller/request
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "businessName": "John's Shop",
  "businessDescription": "We sell amazing products",
  "businessAddress": "123 Main Street, City, State 12345",
  "businessPhone": "1234567890"
}
```

**Required Fields:** businessName, businessDescription, businessAddress, businessPhone

**Response:**
```json
{
  "message": "Seller role request submitted successfully. Waiting for admin approval.",
  "user": {
    "id": "uuid-here",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "role": "seller",
    "isApproved": false,
    "businessDetails": {
      "businessName": "John's Shop",
      "businessDescription": "We sell amazing products",
      "businessAddress": "123 Main Street, City, State 12345",
      "businessPhone": "1234567890",
      "businessWebsite": "https://johnsshop.com",
      "businessDocuments": "https://example.com/documents.pdf"
    }
  },
  "token": "new-jwt-token-here"
}
```

#### Check Seller Request Status
```http
GET /seller/status
Authorization: Bearer <JWT_TOKEN>
```

**Response (Pending):**
```json
{
  "role": "seller",
  "isApproved": false,
  "status": "pending",
  "businessDetails": {
    "businessName": "John's Shop",
    "businessDescription": "We sell amazing products",
    "businessAddress": "123 Main Street, City, State 12345",
    "businessPhone": "1234567890",
    "businessWebsite": "https://johnsshop.com",
    "businessDocuments": "https://example.com/documents.pdf"
  },
  "token": "jwt-token-here"
}
```

**Response (Approved):**
```json
{
  "role": "seller",
  "isApproved": true,
  "status": "approved",
  "businessDetails": {
    "businessName": "John's Shop",
    "businessDescription": "We sell amazing products",
    "businessAddress": "123 Main Street, City, State 12345",
    "businessPhone": "1234567890",
    "businessWebsite": "https://johnsshop.com",
    "businessDocuments": "https://example.com/documents.pdf"
  },
  "token": "seller-jwt-token-here"
}
```

### Admin Management

#### Get Pending Seller Approvals
```http
GET /admin/pending-sellers
Authorization: Bearer <ADMIN_JWT_TOKEN>
```

**Response:**
```json
{
  "pendingSellers": [
    {
      "id": "uuid-here",
      "first_name": "John",
      "last_name": "Doe",
      "email": "john@example.com",
      "role": "seller",
      "is_approved": false,
      "created_at": "2024-01-01T00:00:00.000Z",
      "business_name": "John's Shop",
      "business_description": "We sell amazing products",
      "business_address": "123 Main Street, City, State 12345",
      "business_phone": "1234567890",
      "business_website": "https://johnsshop.com",
      "business_documents": "https://example.com/documents.pdf"
    }
  ],
  "token": "admin-jwt-token-here"
}
```

#### Approve/Reject Seller
```http
PATCH /admin/sellers/:userId/approve
Authorization: Bearer <ADMIN_JWT_TOKEN>
Content-Type: application/json

{
  "approved": true
}
```

**Response:**
```json
{
  "user": {
    "id": "uuid-here",
    "first_name": "John",
    "last_name": "Doe",
    "email": "john@example.com",
    "role": "seller",
    "is_approved": true,
    "business_name": "John's Shop",
    "business_description": "We sell amazing products",
    "business_address": "123 Main Street, City, State 12345",
    "business_phone": "1234567890",
    "business_website": "https://johnsshop.com",
    "business_documents": "https://example.com/documents.pdf"
  },
  "token": "admin-jwt-token-here"
}
```

## Complete API Testing Guide

### 1. Register User (Default Buyer)
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Doe", 
    "email": "john@example.com",
    "password": "password123"
  }'
```

### 2. Verify Email
```bash
curl -X GET "http://localhost:3000/auth/verify-email?token=your-verification-token"
```

### 3. Login User
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "password123"
  }'
```

### 4. Get User Profile
```bash
curl -X GET http://localhost:3000/auth/profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 5. Request to Become Seller
```bash
curl -X POST http://localhost:3000/seller/request \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "businessName": "John's Shop",
    "businessDescription": "We sell amazing products",
    "businessAddress": "123 Main Street, City, State 12345",
    "businessPhone": "1234567890",
    "businessWebsite": "https://johnsshop.com",
    "businessDocuments": "https://example.com/documents.pdf"
  }'
```

### 6. Check Seller Request Status
```bash
curl -X GET http://localhost:3000/seller/status \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 7. Admin Login
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@justbet.com",
    "password": "admin123"
  }'
```

### 8. Admin: Get Pending Seller Approvals
```bash
curl -X GET http://localhost:3000/admin/pending-sellers \
  -H "Authorization: Bearer ADMIN_JWT_TOKEN"
```

### 9. Admin: Approve Seller
```bash
curl -X PATCH http://localhost:3000/admin/sellers/USER_ID_HERE/approve \
  -H "Authorization: Bearer ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "approved": true
  }'
```

### 10. Check Seller Status After Approval
```bash
curl -X GET http://localhost:3000/seller/status \
  -H "Authorization: Bearer SELLER_JWT_TOKEN"
```

### 11. Logout
```bash
curl -X POST http://localhost:3000/auth/logout \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Error Testing Scenarios

### Test Invalid Login
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "wrong@email.com",
    "password": "wrongpassword"
  }'
```
**Expected:** `401 Unauthorized`

### Test Unauthorized Access to Admin Routes
```bash
curl -X GET http://localhost:3000/admin/pending-sellers \
  -H "Authorization: Bearer BUYER_JWT_TOKEN"
```
**Expected:** `403 Forbidden`

### Test Seller Request Without Required Fields
```bash
curl -X POST http://localhost:3000/seller/request \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "businessName": "John's Shop"
  }'
```
**Expected:** `400 Bad Request`

## Database Schema

### Users Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'buyer',
  is_verified BOOLEAN DEFAULT false,
  is_approved BOOLEAN DEFAULT false,
  verification_token VARCHAR(255),
  verification_token_expires TIMESTAMP WITH TIME ZONE,
  reset_token VARCHAR(255),
  reset_token_expires TIMESTAMP WITH TIME ZONE,
  business_name VARCHAR(255),
  business_description TEXT,
  business_address TEXT,
  business_phone VARCHAR(20),
  business_website VARCHAR(255),
  business_documents TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

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

3. Security:
   - Always validate user input
   - Use role-based access control
   - Implement proper JWT token handling
   - Sanitize database queries

## Notes

- The verification token will be sent to the email address provided during registration
- All timestamps are in ISO format
- JWT tokens expire after 30 minutes
- Default admin credentials: `admin@justbet.com` / `admin123`

## License

This project is proprietary and confidential.
