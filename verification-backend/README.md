# SuiVerify Verification Backend

## Overview
SuiVerify is a comprehensive identity verification system built with Python FastAPI that provides secure offline Aadhaar verification with OCR, face recognition, and OTP services. The system is designed for KYC (Know Your Customer) compliance and supports multiple verification workflows.

## Architecture

### Core Technologies
- **Framework**: FastAPI 0.104.1
- **Server**: Uvicorn with auto-reload
- **Database**: MongoDB with Motor (async driver)
- **Cache/Queue**: Redis 5.0.0
- **Computer Vision**: OpenCV, Tesseract OCR, DeepFace, TensorFlow
- **Authentication**: JWT tokens with python-jose
- **Communication**: Twilio for OTP services

### Application Structure
```
verification-backend/
├── main.py                 # FastAPI application entry point
├── requirements.txt        # Python dependencies
├── .env.example           # Environment variables template
├── app/
│   ├── database/          # Database connection and initialization
│   │   ├── __init__.py
│   │   ├── connection.py   # MongoDB connection management
│   │   └── init_db.py     # Database initialization
│   ├── models/            # Data models and schemas
│   │   ├── schemas.py     # Pydantic models for API
│   │   ├── user.py        # User data models
│   │   └── encryption_metadata.py # Encryption metadata models
│   ├── routers/           # API route handlers
│   │   ├── aadhar.py      # Aadhaar OCR endpoints
│   │   ├── face.py        # Face recognition endpoints
│   │   ├── otp.py         # OTP verification endpoints
│   │   ├── user.py        # User management endpoints
│   │   ├── kyc.py         # Complete KYC workflow
│   │   ├── encryption.py  # Encryption metadata management
│   │   └── credentials.py # Credential management
│   └── services/          # Business logic services
│       ├── ocr_service.py           # Aadhaar OCR processing
│       ├── face_recognition_service.py # Face matching algorithms
│       ├── otp_service.py           # OTP generation/verification
│       ├── user_service.py          # User management
│       ├── encryption_service.py    # Data encryption
│       ├── redis_service.py         # Redis operations
│       └── kafka_service.py         # Message queue service
```

## Key Features

### 1. Aadhaar Document Processing
- **OCR Extraction**: Extracts personal information from Aadhaar cards
- **Photo Extraction**: Isolates face photo from Aadhaar document
- **Data Validation**: Validates extracted data format and integrity
- **Supported Fields**: Name, DOB, Gender, Phone, Address, Aadhaar Number

### 2. Face Recognition & Verification
- **Multi-Algorithm Support**: Uses DeepFace with multiple models
- **High Accuracy Mode**: Advanced face matching with confidence scoring
- **Live Photo Verification**: Compares live selfies with Aadhaar photo
- **Anti-Spoofing**: Basic liveness detection capabilities

### 3. OTP Verification System
- **Twilio Integration**: SMS-based OTP delivery
- **Secure Generation**: Cryptographically secure OTP generation
- **Expiration Management**: Time-based OTP expiration
- **Rate Limiting**: Prevents OTP spam and abuse

### 4. Complete KYC Workflow
- **Multi-Step Process**: Aadhaar → Face Match → OTP → Verification
- **Session Management**: Temporary data storage during verification
- **Verification Types**: Supports 'above18' and 'citizenship' verification
- **Audit Trail**: Comprehensive logging of verification attempts

### 5. User Management
- **Profile Management**: User registration and profile updates
- **Verification History**: Track verification attempts and results
- **Status Tracking**: Monitor verification status and completion

### 6. Security & Encryption
- **Data Encryption**: Sensitive data encryption at rest
- **Metadata Management**: Encryption key and metadata tracking
- **Secure Storage**: MongoDB with encrypted collections
- **JWT Authentication**: Secure API access control

## API Endpoints

### Health & Status
- `GET /` - API health check and service status
- `GET /health` - Detailed health check of all services

### User Management (`/api`)
- `POST /users/register` - User registration
- `GET /users/profile/{user_id}` - Get user profile
- `PUT /users/profile/{user_id}` - Update user profile
- `GET /users/{user_id}/verifications` - Get verification history

### KYC Workflow (`/api/kyc`)
- `POST /start-verification` - Start complete KYC process
- `POST /complete-verification` - Complete KYC with OTP
- `GET /verification-status/{session_id}` - Check verification status

### Aadhaar Processing (`/api/aadhaar`)
- `POST /extract` - Extract data from Aadhaar image
- `POST /extract-photo` - Extract photo from Aadhaar
- `POST /validate` - Validate Aadhaar data format

### Face Recognition (`/api/face`)
- `POST /match` - Compare two face images
- `POST /verify-with-aadhaar` - Verify face against Aadhaar photo

### OTP Services (`/api/otp`)
- `POST /send` - Send OTP to phone number
- `POST /verify` - Verify OTP code
- `POST /resend` - Resend OTP

### Encryption (`/api`)
- `POST /encryption-metadata` - Store encryption metadata
- `GET /encryption-metadata/{user_id}` - Retrieve encryption metadata

## Environment Configuration

### Required Environment Variables
```bash
# Twilio Configuration (for OTP)
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number

# MongoDB Configuration
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/
DATABASE_NAME=suiverify_db

# Redis Configuration (for caching/queuing)
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password
REDIS_USERNAME=your_redis_username
REDIS_STREAM_NAME=verification_stream
REDIS_CONSUMER_GROUP=verification_group
REDIS_CONSUMER_NAME=verification_consumer
```

## Installation & Deployment

### Prerequisites
- Python 3.8+ (Python 3.12+ recommended for TensorFlow 2.16+)
- MongoDB instance
- Redis instance
- Tesseract OCR installed on system
- Twilio account for OTP services

### Python Version Compatibility
- **Python 3.12+**: Use TensorFlow 2.16+ (current requirements.txt)
- **Python 3.8-3.11**: Use TensorFlow 2.10-2.13 (change tensorflow>=2.16.0 to tensorflow>=2.10.0,<2.14.0)

### Local Development
```bash
# Clone and navigate to backend
cd verification-backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your configuration

# Run the server
python main.py
# Or with uvicorn directly:
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Ubuntu Instance Setup
```bash
# 1. Install system dependencies
sudo apt update
sudo apt install -y \
    tesseract-ocr tesseract-ocr-eng \
    libglib2.0-0t64 libsm6 libxext6 libxrender-dev libgomp1 \
    libgtk-3-0t64 mesa-common-dev libgl1-mesa-dev libglu1-mesa-dev \
    build-essential python3-dev

# 2. Create virtual environment
python3 -m venv venv
source venv/bin/activate

# 3. Upgrade pip and install Python packages
pip install --upgrade pip setuptools wheel
pip install -r requirements.txt

# 4. Install tf-keras if needed (for TensorFlow 2.16+)
pip install tf-keras>=2.16.0

# 5. Verify Tesseract installation
tesseract --version

# 6. Configure environment
cp .env.example .env
# Edit .env with your configuration

# 7. Run the server
python3 main.py
```

### Production Deployment
- **Server**: Deploy with Gunicorn + Uvicorn workers
- **Database**: MongoDB Atlas or self-hosted MongoDB cluster
- **Cache**: Redis Cloud or self-hosted Redis
- **Storage**: Secure file storage for temporary images
- **Monitoring**: Health check endpoints for load balancer
- **Security**: HTTPS, rate limiting, input validation

## Database Collections

### Users Collection
- User profiles and basic information
- Verification status and history
- Encrypted sensitive data

### OTP Collection
- OTP codes and expiration times
- Phone number associations
- Verification attempts tracking

### Verification Logs Collection
- Complete audit trail of verification attempts
- Success/failure reasons
- Timestamp and session information

### Encryption Metadata Collection
- Encryption keys and metadata
- User data encryption tracking
- Key rotation information

## Integration Points

### Frontend Integration
- **CORS Enabled**: Supports React dev servers (ports 3000, 5173, 5175)
- **File Uploads**: Multipart form data for image uploads
- **JSON APIs**: RESTful JSON responses
- **Error Handling**: Structured error responses

### External Services
- **Twilio**: SMS OTP delivery
- **MongoDB**: Primary data storage
- **Redis**: Caching and message queuing
- **Kafka**: Optional message streaming (service available)

## Security Considerations

### Data Protection
- Sensitive data encryption at rest
- Temporary image data cleanup
- Secure OTP generation and storage
- JWT token-based authentication

### Privacy Compliance
- Minimal data retention
- User consent tracking
- Data anonymization options
- Audit trail maintenance

### System Security
- Input validation and sanitization
- Rate limiting on sensitive endpoints
- CORS configuration
- Environment variable protection

## Monitoring & Logging

### Health Checks
- Service-level health monitoring
- Database connection status
- External service availability
- Resource utilization tracking

### Logging
- Structured logging with levels
- Verification attempt tracking
- Error logging and alerting
- Performance metrics

## Troubleshooting

### Common Issues
1. **MongoDB Connection**: Check URI format and network access
2. **Redis Connection**: Verify Redis server status and credentials
3. **Tesseract OCR**: Ensure Tesseract is installed and in PATH
4. **Twilio OTP**: Verify account credentials and phone number format
5. **Face Recognition**: Check TensorFlow/DeepFace model downloads

### Performance Optimization
- Image preprocessing and compression
- Database query optimization
- Redis caching strategies
- Async/await pattern usage
- Connection pooling

This backend serves as the core verification engine for the SuiVerify identity verification platform, providing secure, scalable, and compliant KYC services.
