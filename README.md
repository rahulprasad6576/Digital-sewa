# Digital Seva Platform

A full-stack web application providing digital services (PAN Card, Aadhaar, Bill Payments, Recharge, etc.) for Indian citizens with **real payment and recharge integration**.

## Tech Stack

- **Backend:** Node.js, Express, MongoDB (Mongoose), JWT Auth
- **Frontend:** HTML5, CSS3, Vanilla JavaScript
- **Payments:** Razorpay (Real UPI, Cards, Net Banking)
- **Recharges:** Provider-agnostic HTTP API integration
- **Bill Payments:** BBPS-compatible provider architecture
- **Features:** Multi-language (English + Hindi + 5 regional languages), Dark Mode, AI Chatbot, Voice Commands

## Quick Start

### Prerequisites

- Node.js >= 18.0.0
- MongoDB (local or Atlas)

### Installation

```bash
# Install backend dependencies
cd backend
npm install

# Create environment file
cp ../.env.example .env
# Edit .env and set your API keys (see Configuration section below)

# Seed admin user
node seed.js
# Default admin: admin@digitalseva.com / admin123

# Start server
node server.js
```

### Access the App

- User Portal: http://localhost:5000
- Admin Panel: http://localhost:5000/admin-login.html

---

## Configuration - Making Payments & Recharges REAL

### 1. Razorpay Payment Gateway (Required for real payments)

1. Create a Razorpay account at https://razorpay.com
2. Get your Test/Live API keys from https://dashboard.razorpay.com/app/keys
3. Add to `.env`:
   ```
   RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxxx
   RAZORPAY_KEY_SECRET=your_key_secret_here
   RAZORPAY_WEBHOOK_SECRET=your_webhook_secret_here
   ```
4. For webhooks: Set your webhook URL to `https://yourdomain.com/razorpay/webhook` in Razorpay dashboard
5. Use **Test Mode** keys for development (no real money deducted)

### 2. Recharge API Provider (Required for real recharges)

The platform supports any HTTP API provider. Popular options in India:

- **Fast2SMS** (https://www.fast2sms.com)
- **RechargeKit** (https://rechargekit.in)
- **Any custom provider** with HTTP API

Add to `.env`:
```
RECHARGE_PROVIDER=custom
RECHARGE_API_URL=https://api.yourprovider.com
RECHARGE_API_KEY=your_api_key_here
RECHARGE_API_SECRET=your_api_secret_here
RECHARGE_DEMO_MODE=false
```

**Demo Mode:** Set `RECHARGE_DEMO_MODE=true` to simulate recharges without real API calls (useful for testing).

### 3. Bill Payment API Provider (Required for real bill payments)

Popular BBPS-compatible providers:

- **BillAvenue** (https://www.billavenue.com)
- **Paytm BBPS** (https://developer.paytm.com/docs/bbps)
- **Any custom provider**

Add to `.env`:
```
BILL_PROVIDER=custom
BILL_API_URL=https://api.yourbillprovider.com
BILL_API_KEY=your_api_key_here
BILL_API_SECRET=your_api_secret_here
BILL_DEMO_MODE=false
```

**Demo Mode:** Set `BILL_DEMO_MODE=true` to simulate bill payments.

---

## API Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/signup` | POST | No | User registration |
| `/login` | POST | No | User login |
| `/dashboard` | GET | User JWT | User dashboard data |
| `/service` | POST | User JWT | Submit service request |
| `/payment/config` | GET | User JWT | Get Razorpay config status |
| `/payment/order` | POST | User JWT | Create Razorpay order |
| `/payment/verify` | POST | User JWT | Verify Razorpay payment |
| `/payment/status/:id` | GET | User JWT | Check payment status |
| `/razorpay/webhook` | POST | No | Razorpay webhook handler |
| `/recharge/mobile` | POST | User JWT | Mobile recharge |
| `/recharge/dth` | POST | User JWT | DTH recharge |
| `/recharge/status/:id` | GET | User JWT | Check recharge status |
| `/operator/detect` | POST | User JWT | Auto-detect mobile operator |
| `/bill/fetch` | POST | User JWT | Fetch bill details |
| `/bill/pay` | POST | User JWT | Pay bill |
| `/bill/status/:id` | GET | User JWT | Check bill payment status |
| `/contact` | POST | No | Submit contact form |
| `/chatbot` | POST | No | AI chatbot response |
| `/admin/login` | POST | No | Admin login |
| `/admin/stats` | GET | Admin JWT | Admin dashboard stats |
| `/health` | GET | No | Server health check |

---

## Project Structure

```
├── backend/
│   ├── server.js              # Express entry point
│   ├── seed.js                # Admin seed script
│   ├── package.json           # Backend dependencies
│   ├── user.js                # User model
│   ├── admin.js               # Admin model
│   ├── payment.js             # Payment model
│   ├── service.js             # Service model
│   ├── contact.js             # Contact model
│   ├── notification.js        # Notification model
│   └── utils/
│       ├── paymentGateway.js  # Razorpay integration
│       ├── rechargeService.js # Recharge API integration
│       ├── billPaymentService.js # Bill payment integration
│       └── rateLimiter.js     # API rate limiting
├── frontend/
│   ├── index.html             # Homepage
│   ├── login.html             # User login
│   ├── signup.html            # User signup
│   ├── dashboard.html         # User dashboard
│   ├── payment.html           # Payment & recharge page
│   ├── admin-login.html       # Admin login
│   ├── admin.html             # Admin dashboard
│   ├── contact.html           # Contact page
│   ├── about.html             # About page
│   ├── plans.html             # Pricing plans
│   ├── privacy.html           # Privacy policy
│   ├── style.css              # Global styles
│   └── script.js              # Shared auth scripts
├── .env.example               # Environment template
├── package.json               # Root package config
└── README.md                  # This file
```

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MONGODB_URI` | MongoDB connection string | `mongodb://127.0.0.1:27017/digital_platform` |
| `JWT_SECRET` | Secret for JWT signing | Required |
| `PORT` | Server port | `5000` |
| `ALLOWED_ORIGINS` | CORS origins (comma-separated) | Localhost defaults |
| `RAZORPAY_KEY_ID` | Razorpay Key ID | Required for real payments |
| `RAZORPAY_KEY_SECRET` | Razorpay Key Secret | Required for real payments |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay Webhook Secret | Optional |
| `RECHARGE_API_URL` | Recharge provider API URL | Required for real recharges |
| `RECHARGE_API_KEY` | Recharge provider API key | Required for real recharges |
| `RECHARGE_DEMO_MODE` | Simulate recharges | `true` |
| `BILL_API_URL` | Bill payment provider URL | Required for real bill payments |
| `BILL_API_KEY` | Bill payment provider key | Required for real bill payments |
| `BILL_DEMO_MODE` | Simulate bill payments | `true` |

---

## How It Works

### Payment Flow (Razorpay)
1. User selects service and enters amount
2. Frontend calls `/payment/order` to create Razorpay order
3. Razorpay Checkout popup opens for user to pay
4. On success, frontend calls `/payment/verify` with signature
5. Backend verifies signature with Razorpay and records payment
6. Webhook (`/razorpay/webhook`) handles async confirmations

### Recharge Flow
1. User enters mobile number / subscriber ID
2. (Optional) Auto-detect operator via `/operator/detect`
3. User selects operator and amount
4. Frontend calls `/recharge/mobile` or `/recharge/dth`
5. Backend calls provider API (or simulates in demo mode)
6. Status can be checked via `/recharge/status/:id`

### Bill Payment Flow
1. User clicks Electricity/Water/Gas service
2. Enters Consumer ID and Biller name
3. Clicks "Fetch Bill" - calls `/bill/fetch`
4. Bill details displayed with amount
5. User clicks "Pay" - calls `/bill/pay`
6. Status can be checked via `/bill/status/:id`

---

## Demo Mode vs Live Mode

| Feature | Demo Mode | Live Mode |
|---------|-----------|-----------|
| Payments | Shows "Not Configured" error | Real Razorpay transactions |
| Recharges | Simulated success with fake ref ID | Real provider API calls |
| Bill Payments | Simulated fetch/pay | Real provider API calls |

**To enable live mode:** Set all `*_DEMO_MODE` variables to `false` and configure real API keys.

---

## Security Notes

- Never commit `.env` file to git
- Use Razorpay Test keys for development
- Set strong `JWT_SECRET` (min 32 characters)
- Enable HTTPS in production
- Configure Razorpay webhooks with signature verification

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Payment gateway not configured" | Set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in `.env` |
| "Recharge provider not configured" | Set `RECHARGE_API_URL` and `RECHARGE_API_KEY` in `.env` |
| MongoDB connection failed | Check `MONGODB_URI` and ensure MongoDB is running |
| CORS errors | Add your frontend URL to `ALLOWED_ORIGINS` |

---

## License

ISC
