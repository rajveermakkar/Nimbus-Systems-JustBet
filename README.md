# JustBet - Auction Platform

A modern auction bidding platform built with Express.js and PostgreSQL.

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

## API Endpoints

### Authentication

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "firstName": "Rajveer",
  "lastName": "Singh",
  "email": "rajveer@example.com",
  "password": "password123",
  "confirmPassword": "password123"
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "rajveer@example.com",
  "password": "password123"
}
```
Response will include an HTTP-only cookie named 'token'

#### Logout
```http
POST /api/auth/logout
```
Clears the authentication cookie

#### Get User Profile
```http
GET /api/auth/profile
```
Requires authentication cookie

Response:
```json
{
  "user": {
    "id": "uuid",
    "firstName": "test",
    "lastName": "user",
    "email": "test@test.com",
    "role": "user",
    "createdAt": "2024-03-21T12:00:00Z"
  }
}
```

#### Verify Email
```http
GET /api/auth/verify-email?token=<verification_token>
```

#### Resend Verification Email
```http
POST /api/auth/resend-verification
Content-Type: application/json

{
  "email": "rajveer@example.com"
}
```

#### Check User Status
```http
GET /api/auth/user-status?email=rajveer@example.com
```

## Database Schema

### Users Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'user',
  is_verified BOOLEAN DEFAULT false,
  verification_token VARCHAR(255),
  verification_token_expires TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
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

## License

This project is proprietary and confidential.
