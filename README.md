# DocAI Backend

A powerful TypeScript backend for document AI processing, featuring PDF text extraction, semantic search, AI-powered Q&A, and user authentication with email verification.

## 📋 Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [API Endpoints](#api-endpoints)
- [Database Schema](#database-schema)
- [Services](#services)
- [Email Service](#email-service)
- [Installation & Setup](#installation--setup)
- [Environment Variables](#environment-variables)
- [Usage Examples](#usage-examples)
- [Rate Limiting](#rate-limiting)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

## ✨ Features

- **PDF Processing**: Extract text from PDF documents using pdf2json
- **Semantic Search**: Vector-based document search using embeddings
- **AI Q&A**: GPT-4 powered question answering based on document content
- **User Authentication**: JWT-based auth with email verification
- **Rate Limiting**: Smart rate limiting for anonymous and authenticated users
- **File Upload**: Secure file upload with multer
- **Email Service**: Nodemailer integration for account activation
- **Database**: PostgreSQL with Supabase integration
- **TypeScript**: Full TypeScript support with type safety

## 🛠 Tech Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL (Supabase)
- **AI/ML**: OpenAI GPT-4, Xenova Transformers
- **Email**: Nodemailer with Gmail
- **File Processing**: pdf2json, multer
- **Authentication**: JWT, bcrypt
- **Vector Search**: Custom cosine similarity implementation

## 🔌 API Endpoints

### Authentication Routes (`/auth`)

#### POST `/auth/signup`
Register a new user account.

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securepassword"
}
```

**Response:**
```json
{
  "message": "Signup successful! Check your email to activate.",
  "userId": 123,
  "emailSent": true,
  "messageId": "email-message-id"
}
```

#### POST `/auth/login`
Authenticate user and get JWT token.

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "securepassword"
}
```

**Response:**
```json
{
  "message": "Login successful",
  "token": "jwt-token-here",
  "user": {
    "id": 123,
    "name": "John Doe",
    "email": "john@example.com"
  }
}
```

#### GET `/auth/activate/:token`
Activate user account using email token.

**Response:**
```json
{
  "status": "success",
  "message": "✅ Hi John, your account is activated! You can now log in."
}
```

### File Upload Routes (`/file`)

#### POST `/file/upload`
Upload and process PDF documents.

**Request:** Multipart form data
- `file`: PDF file
- `userId`: (optional) User ID for authenticated uploads

**Response:**
```json
{
  "message": "✅ Document uploaded successfully",
  "document": {
    "id": 456,
    "filename": "document.pdf",
    "fileType": "application/pdf",
    "fileUrl": "/uploads/filename.pdf"
  },
  "chunks": 15
}
```

### Query Routes (`/query`)

#### POST `/query/query`
Query documents using AI-powered semantic search.

**Request Body:**
```json
{
  "documentId": 456,
  "query": "What is the main topic of this document?",
  "limit": 5,
  "userId": 123
}
```

**Response:**
```json
{
  "answer": "Based on the document content, the main topic is...",
  "sources": [
    {
      "chunk_text": "Relevant text chunk...",
      "similarity": 0.85
    }
  ],
  "queryId": 789,
  "rateLimitInfo": {
    "limit": 50,
    "remaining": 49,
    "resetTime": "2024-01-02T00:00:00.000Z"
  }
}
```

#### GET `/query/rate-limit`
Get current rate limit status.

**Response:**
```json
{
  "limit": 50,
  "remaining": 45,
  "resetTime": "2024-01-02T00:00:00.000Z",
  "requiresAuth": false
}
```

## 🗄 Database Schema

### Users Table
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  active BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Documents Table
```sql
CREATE TABLE documents (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  filename VARCHAR(255) NOT NULL,
  file_type VARCHAR(100) NOT NULL,
  file_url VARCHAR(500) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Document Chunks Table
```sql
CREATE TABLE document_chunks (
  id SERIAL PRIMARY KEY,
  document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
  chunk_text TEXT NOT NULL,
  embedding TEXT NOT NULL, -- JSON string of vector
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Query Usage Table
```sql
CREATE TABLE query_usage (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  ip_address VARCHAR(45) NOT NULL,
  document_id INTEGER,
  query TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Chat History Table
```sql
CREATE TABLE chat_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  answer TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## 🔧 Services

### LLM Service (`src/services/llmService.ts`)
- **Purpose**: Generate AI-powered answers using OpenAI GPT-4
- **Model**: GPT-4o-mini for cost efficiency
- **Features**: Context-aware responses based on document content

### Embedding Service (`src/services/embedingService.ts`)
- **Purpose**: Generate text embeddings for semantic search
- **Model**: Xenova/all-MiniLM-L6-v2 (384 dimensions)
- **Features**: Singleton pattern for performance, mean pooling

### Query Service (`src/services/queryService.ts`)
- **Purpose**: Semantic document search using cosine similarity
- **Features**: Vector-based search, configurable result limits

### Rate Limit Service (`src/services/rateLimitService.ts`)
- **Purpose**: Manage API usage limits
- **Limits**: 
  - Anonymous users: 3 queries/day
  - Authenticated users: 50 queries/day
- **Features**: IP-based tracking, daily reset

### Upload File Service (`src/services/uploadFileService.ts`)
- **Purpose**: Handle file metadata storage
- **Features**: File validation, metadata management

## 📧 Email Service

### Configuration
The email service uses Nodemailer with Gmail SMTP:

```typescript
const transporter = nodemailer.createTransporter({
  service: "gmail",
  auth: {
    user: "your-email@gmail.com",
    pass: "your-app-password" // Gmail App Password
  }
});
```

### Features
- **Account Activation**: Send activation emails during signup
- **Email Verification**: Verify email addresses before account activation
- **Error Handling**: Comprehensive error logging and fallback responses
- **Template Support**: HTML email templates with dynamic content

### Setup Gmail
1. Enable 2-Factor Authentication on your Gmail account
2. Generate an App Password:
   - Go to Google Account → Security → 2-Step Verification → App passwords
   - Generate password for "Mail"
3. Use the App Password in your environment variables

### Email Testing
Test email functionality with the test endpoint:

```bash
curl -X POST http://localhost:10000/api/auth/test-email \
  -H "Content-Type: application/json" \
  -d '{"testEmail": "test@example.com"}'
```

## 🚀 Installation & Setup

### Prerequisites
- Node.js 18+ 
- PostgreSQL database (or Supabase)
- Gmail account for email service
- OpenAI API key

### 1. Clone Repository
```bash
git clone <repository-url>
cd DocAIBackend
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Setup
Create a `.env` file in the root directory:

```env
# Database Configuration
DB_HOST=aws-1-ap-south-1.pooler.supabase.com
DB_PORT=6543
DB_NAME=postgres
DB_USER=postgres.your-project-ref
DB_PASSWORD=your-database-password

# Supabase Configuration
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key

# JWT Secret
JWT_SECRET=your-super-secret-jwt-key

# OpenAI API
OPENAI_API_KEY=your-openai-api-key

# Email Configuration
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-gmail-app-password

# Server Configuration
PORT=10000
NODE_ENV=development
```

### 4. Database Migration
```bash
npm run migrate
```

### 5. Start Development Server
```bash
npm run dev
```

### 6. Build for Production
```bash
npm run build
npm start
```

## 📊 Rate Limiting

### Anonymous Users
- **Limit**: 3 queries per day
- **Tracking**: IP address based
- **Reset**: Daily at midnight UTC

### Authenticated Users
- **Limit**: 50 queries per day
- **Tracking**: User ID based
- **Reset**: Daily at midnight UTC

### Rate Limit Headers
All responses include rate limit information:
```json
{
  "limit": 50,
  "remaining": 45,
  "resetTime": "2024-01-02T00:00:00.000Z",
  "requiresAuth": false
}
```

## 🚀 Deployment

### Environment Variables for Production
Ensure all environment variables are set in your deployment platform:

```env
# Production Database
DB_HOST=your-production-db-host
DB_PORT=5432
DB_NAME=your-db-name
DB_USER=your-db-user
DB_PASSWORD=your-db-password

# Production URLs
SUPABASE_URL=https://your-project.supabase.co
OPENAI_API_KEY=your-openai-key
JWT_SECRET=your-production-jwt-secret
```

### Common Deployment Platforms

#### Vercel
1. Connect your GitHub repository
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push

#### Render
1. Connect your repository
2. Set environment variables
3. Use Node.js buildpack
4. Set build command: `npm run build`
5. Set start command: `npm start`

#### Railway
1. Connect your repository
2. Set environment variables
3. Deploy automatically

### Database Connection Issues
If you encounter IPv6 connection errors:
1. Ensure your database host supports IPv4
2. Add `family: 4` to your database configuration
3. Use connection string with IPv4 address

## 🔧 Troubleshooting

### Common Issues

#### 1. Database Connection Failed
```
Error: connect ENETUNREACH [IPv6 address]
```
**Solution**: Force IPv4 connection in database config:
```typescript
const pool = new Pool({
  // ... other config
  family: 4, // Force IPv4
});
```

#### 2. Email Authentication Failed
```
Error: SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string
```
**Solution**: 
- Use Gmail App Password instead of regular password
- Ensure `DB_PASSWORD` is set in environment variables

#### 3. OpenAI API Errors
```
Error: Invalid API key
```
**Solution**: 
- Verify `OPENAI_API_KEY` is set correctly
- Check API key has sufficient credits
- Ensure API key has access to GPT-4

#### 4. File Upload Issues
```
Error: Unsupported file type
```
**Solution**: 
- Only PDF and plain text files are supported
- Check file MIME type is correct
- Ensure file is not corrupted

### Debug Mode
Enable debug logging by setting:
```env
NODE_ENV=development
DEBUG=true
```

### Logs
Check application logs for detailed error information:
```bash
# Development
npm run dev

# Production
npm start
```

## 📝 API Usage Examples

### Complete Workflow Example

1. **Sign up a new user:**
```bash
curl -X POST http://localhost:10000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "securepassword"
  }'
```

2. **Activate account (click link in email)**
3. **Login:**
```bash
curl -X POST http://localhost:10000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "securepassword"
  }'
```

4. **Upload a PDF:**
```bash
curl -X POST http://localhost:10000/file/upload \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@document.pdf" \
  -F "userId=123"
```

5. **Query the document:**
```bash
curl -X POST http://localhost:10000/query/query \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "documentId": 456,
    "query": "What is the main topic of this document?",
    "userId": 123
  }'
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the ISC License.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the troubleshooting section
- Review the API documentation
