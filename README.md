# SUI Verify Workshop

## Overview

SUI Verify is a blockchain-based document verification system built on the Sui network. It enables secure document verification, face matching, and NFT-based verification proofs.

## Features

- Document verification (Ghana Card/Passport)
- Face verification with liveness detection
- OTP-based verification
- NFT minting for verified identities
- Government access control
- Secure document storage

## Project Structure

```
sui-verify-workshop/
├── contracts/           # Move smart contracts
├── frontend/           # React/TypeScript frontend
├── verification-backend/ # Python FastAPI backend
├── nautilus_infra/     # Infrastructure components
└── suiverify-sdk/      # TypeScript SDK
```

## Documentation

- [Technical Documentation](docs/technical/README.md)
- [API Reference](docs/api/README.md)
- [User Guide](docs/user/README.md)
- [Deployment Guide](docs/deployment/README.md)

## Quick Start

### Prerequisites

- Sui CLI
- Node.js 16+
- Python 3.8+
- Docker

### Smart Contract Development

```bash
cd contracts
sui move build
sui client publish
```

### Frontend Development

```bash
cd frontend
pnpm install
pnpm dev
```

### Backend Development

```bash
cd verification-backend
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
pip install -r requirements.txt
python main.py
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit changes
4. Submit pull request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support, contact support@suiverify.com