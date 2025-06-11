# JustBet - Sports Betting Platform

A modern sports betting platform built with Express.js and PostgreSQL.

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
```

4. Start the development server:
```bash
npm run dev
```

The server will automatically:
- Connect to the database
- Create necessary tables if they don't exist
- Create an initial admin user if no users exist

## Security Details

### Password Encryption (Bcrypt)
- Uses bcrypt with 10 salt rounds
- Hashed passwords are 60 characters long
- Format: `$2b$10$[22 chars salt][31 chars hash]`
- Example: `$2b$10$LQVDxJ5UxX5X5X5X5X5X5O5X5X5X5X5X5X5X5X5X5X5X5X5X5X`

### User IDs (UUID)
- Uses UUID v4 (random)
- 32 hexadecimal characters
- Format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
- Example: `123e4567-e89b-12d3-a456-426614174000`
- Extremely low collision probability

## Git Workflow

### Branching Strategy

1. Create a new branch for each task:
```bash
git checkout -b SCRUM-123-task-description
```
Example: `git checkout -b SCRUM-45-user-registration`

2. Make your changes and commit them:
```bash
git add .
git commit -m "SCRUM-123: Brief description of changes"
```

### Code Review Process

1. Push your branch to remote:
```bash
git push -u origin SCRUM-123-task-description
```

2. Create a Pull Request (PR) on GitHub:
   - Set the base branch to `main`
   - Add a description of your changes
   - Request reviews from team members

3. Wait for code review:
   - Address any review comments
   - Make additional commits if needed

4. After approval:
   - Merge the PR into main

### Best Practices

- Keep commits focused and atomic
- Write clear commit messages

## API Endpoints

### Authentication

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "password": "password123",
  "confirmPassword": "password123"
}
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
   - Log connections for Debugging

## License

This project is proprietary and confidential.
