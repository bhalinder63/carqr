# 🚗 CarQR — Parking Alert System with Masked Calling

A QR-based system that lets strangers contact car owners **without ever revealing the owner's real phone number**.

---

## How It Works

```
[Car Owner Registers on Website]
         ↓
System assigns a Virtual Number (via Twilio)
         ↓
QR Code generated → yourapp.com/contact/ABC123
         ↓
Owner prints QR tag and sticks it on windscreen
         ↓
[Stranger scans QR Code with phone camera]
         ↓
Landing page: "Car DL01AB1234 — Click to Call"
         ↓
Stranger taps Call → Twilio bridges the call
         ↓
Owner's phone rings — Stranger NEVER sees real number ✅
```

---

## Project Structure

```
carqr/
├── src/
│   ├── server.js                 # Express app entry point
│   ├── routes/
│   │   ├── cars.js               # Car registration API
│   │   ├── calls.js              # Twilio call bridge webhooks
│   │   ├── contact.js            # Public landing page (stranger sees this)
│   │   └── printTag.js           # Print-ready QR sticker page
│   └── services/
│       ├── firebase.js           # Database operations
│       ├── twilio.js             # Masked calling + SMS
│       └── qrcode.js             # QR code generation
├── public/
│   ├── index.html                # Car owner registration page
│   └── qrcodes/                  # Generated QR images (auto-created)
├── .env.example                  # Environment variables template
├── package.json
└── README.md
```

---

## Setup Instructions

### Step 1: Clone and Install

```bash
git clone <your-repo>
cd carqr
npm install
```

---

### Step 2: Set Up Firebase

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Create a new project (e.g. "carqr-app")
3. Go to **Firestore Database** → Create database → Start in production mode
4. Go to **Project Settings** → **Service Accounts** → **Generate new private key**
5. Download the JSON file
6. Copy the values into your `.env` file:

```
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-...@your-project.iam.gserviceaccount.com
```

**Firestore Collections created automatically:**

- `cars` — stores car + owner info
- `scan_logs` — logs every QR scan

---

### Step 3: Set Up Twilio

1. Sign up at [twilio.com](https://twilio.com) (free trial gives you $15 credit)
2. Get your **Account SID** and **Auth Token** from the console dashboard
3. Buy a phone number: **Phone Numbers** → **Buy a Number** → pick any number
4. Add to `.env`:

```
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1XXXXXXXXXX
```

5. **Configure the Twilio number webhook:**
   - Go to your Twilio number settings
   - Under **Voice & Fax** → **A Call Comes In**
   - Set to: `https://yourapp.com/call/bridge/DEFAULT`
   - Method: `HTTP POST`

> 💡 **For production:** Buy one Twilio number per car owner for true full masking.  
> For MVP: Use one shared number with carId routing via IVR.

---

### Step 4: Configure Environment

```bash
cp .env.example .env
```

Fill in all values in `.env`:

```env
PORT=3000
APP_URL=https://yourapp.com
TWILIO_ACCOUNT_SID=ACxxx...
TWILIO_AUTH_TOKEN=xxx...
TWILIO_PHONE_NUMBER=+1XXXXXXXXXX
FIREBASE_PROJECT_ID=your-project
FIREBASE_PRIVATE_KEY="..."
FIREBASE_CLIENT_EMAIL=...
APP_SECRET=random_32_char_string
```

---

### Step 5: Run the App

```bash
# Development (auto-restart on changes)
npm run dev

# Production
npm start
```

App will be running at `http://localhost:3000`

---

### Step 6: Deploy (Railway or Render)

**Railway (Recommended):**

```bash
npm install -g @railway/cli
railway login
railway init
railway up
```

Then add all environment variables in the Railway dashboard.

**Render:**

1. Push to GitHub
2. Connect repo on render.com
3. Add environment variables
4. Deploy

---

## API Reference

| Method | Endpoint                   | Description                 |
| ------ | -------------------------- | --------------------------- |
| `POST` | `/api/cars/register`       | Register a new car          |
| `GET`  | `/api/cars/:carId`         | Get car public info         |
| `GET`  | `/api/cars/:carId/qr`      | Re-download QR code         |
| `GET`  | `/api/cars/:carId/history` | Get scan history            |
| `GET`  | `/contact/:carId`          | Public contact landing page |
| `GET`  | `/print-tag/:carId`        | Print-ready QR tag page     |
| `POST` | `/call/bridge/:carId`      | Twilio call bridge webhook  |
| `POST` | `/call/no-answer/:carId`   | Twilio no-answer webhook    |

---

## Privacy & Security

- ✅ Owner's real phone number is **never sent to the browser**
- ✅ QR code encodes a **URL**, not a phone number
- ✅ Calls are **bridged through Twilio** — both parties see Twilio's number
- ✅ Scan activity is logged for owner's awareness
- ✅ Owner gets **SMS alert** every time their QR is scanned

---

---

## Troubleshooting

### "Application error has occurred" when call connects

This usually means Twilio received HTML instead of TwiML when fetching your webhook. Common causes:

**1. ngrok free tier** — ngrok may show a "Visit Site" page for non-browser requests. Use one of:

- **Cloudflare Tunnel** (no interstitial): `cloudflared tunnel --url http://localhost:3000`
- **ngrok paid** — custom domains skip the warning
- **Deploy** — Railway/Render; no tunnel needed

**2. Check server logs** — When you place a call, watch your terminal. Any `Call bridge error:` message shows the real cause.

**3. Verify APP_URL** — Must be your public URL (ngrok/tunnel) with no trailing slash, e.g. `https://abc123.ngrok-free.app`

---

## Next Steps (Phase 2)

- [ ] Add owner login/dashboard with OTP authentication
- [ ] Buy dedicated Twilio numbers per owner (stronger masking)
- [ ] WhatsApp integration for messaging
- [ ] Owner can set "Do Not Disturb" hours
- [ ] Analytics dashboard (scan count, call history)
- [ ] Mobile app for owners

---

## Tech Stack

| Layer          | Technology           |
| -------------- | -------------------- |
| Backend        | Node.js + Express    |
| Database       | Firebase Firestore   |
| Masked Calling | Twilio Voice         |
| SMS            | Twilio SMS           |
| QR Code        | `qrcode` npm package |
| Frontend       | HTML + TailwindCSS   |
| Hosting        | Railway / Render     |
