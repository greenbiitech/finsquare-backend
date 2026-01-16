# Wallet Setup Flow Documentation

## Overview

The wallet activation flow is a multi-step process that guides users through identity verification (BVN), personal information confirmation, and transaction PIN creation.

## Flow Steps

### Step 1: BVN Validation (`walletSetupStep: BVN_VERIFIED`)

**Sub-steps:**
1. **Enter BVN** (`BVN_INITIATED`)
   - Endpoint: `POST /api/v1/wallet/bvn/initiate`
   - User submits their 11-digit BVN
   - Returns `sessionId` and available verification `methods` (phone, email)

2. **Select Verification Method** (`OTP_SENT`)
   - Endpoint: `POST /api/v1/wallet/bvn/verify`
   - User selects phone or email to receive OTP
   - NIBSS sends OTP to the selected channel

3. **Verify OTP** (`BVN_VERIFIED`)
   - Endpoint: `POST /api/v1/wallet/bvn/details`
   - User submits OTP received from NIBSS
   - Returns verified BVN data (name, DOB, gender, phone, email)
   - BVN data is stored in `user.bvnData`

**Mobile Pages:**
- `bvn_validation_page.dart`
- `select_verification_method_page.dart`
- `verify_otp_page.dart`

---

### Step 2: Verify Personal Information (`walletSetupStep: PERSONAL_INFO`)

- Endpoint: `POST /api/v1/wallet/personal-info` (to be implemented)
- Displays BVN data (read-only): Name, Phone, DOB, Gender
- User selects their occupation
- Data is confirmed and stored

**Mobile Page:** `verify_personal_info_page.dart`

---

### Step 3: Address Information (`walletSetupStep: ADDRESS_INFO`)

- Endpoint: `POST /api/v1/wallet/address` (to be implemented)
- User enters: Street address, City, State, Country
- Address is stored for KYC compliance

**Mobile Page:** `address_info_page.dart`

---

### Step 4: Face Verification (`walletSetupStep: FACE_VERIFIED`)

- Endpoint: `POST /api/v1/wallet/face-verification` (to be implemented)
- User takes a selfie
- Image is uploaded and stored
- Optional: Liveness detection

**Mobile Pages:**
- `face_verification_page.dart`
- `confirm_photo_page.dart`

---

### Step 5: Proof of Address (`walletSetupStep: PROOF_OF_ADDRESS`)

- Endpoint: `POST /api/v1/wallet/proof-of-address` (to be implemented)
- User uploads utility bill, bank statement, or similar document
- Document is stored for KYC compliance

**Mobile Page:** `proof_of_address_page.dart`

---

### Step 6: Transaction PIN (`walletSetupStep: PIN_CREATED` → `COMPLETED`)

- Endpoint: `POST /api/v1/wallet/transaction-pin` (to be implemented)
- User creates a 4-6 digit PIN
- PIN is hashed and stored in `user.transactionPin`
- Wallet is created and activated

**Mobile Pages:**
- `create_transaction_pin_page.dart`
- `confirm_transaction_pin_page.dart`
- `wallet_success_page.dart`

---

## State Machine

```
NOT_STARTED
    ↓ (Enter BVN)
BVN_INITIATED
    ↓ (Select verification method)
OTP_SENT
    ↓ (Verify OTP successfully)
BVN_VERIFIED
    ↓ (Confirm personal info)
PERSONAL_INFO
    ↓ (Enter address)
ADDRESS_INFO
    ↓ (Complete face verification)
FACE_VERIFIED
    ↓ (Upload proof of address)
PROOF_OF_ADDRESS
    ↓ (Create transaction PIN)
PIN_CREATED
    ↓ (Wallet created)
COMPLETED
```

---

## Resume Logic

When a user returns to the app, check their `walletSetupStep` to determine where to resume:

| `walletSetupStep` | Resume Route |
|-------------------|--------------|
| `null` / `NOT_STARTED` | `/activate-wallet` |
| `BVN_INITIATED` | `/bvn-validation` |
| `OTP_SENT` | `/verify-otp` (with stored sessionId) |
| `BVN_VERIFIED` | `/verify-personal-info` |
| `PERSONAL_INFO` | `/address-info` |
| `ADDRESS_INFO` | `/face-verification` |
| `FACE_VERIFIED` | `/proof-of-address` |
| `PROOF_OF_ADDRESS` | `/create-transaction-pin` |
| `PIN_CREATED` | `/wallet-success` |
| `COMPLETED` | Wallet Dashboard |

---

## API Endpoints

### GET /api/v1/wallet/setup/progress

Returns current wallet setup state and resume information.

**Response:**
```json
{
  "success": true,
  "data": {
    "currentStep": "BVN_VERIFIED",
    "resumeRoute": "/verify-personal-info",
    "hasCompletedBvn": true,
    "hasWallet": false,
    "bvnData": {
      "firstName": "CHINEDU",
      "lastName": "AJIKWU",
      "gender": "male",
      "dateOfBirth": "1990-01-15"
    }
  }
}
```

---

## BVN Uniqueness

**Rule:** Once a BVN is verified by a user, no other user can verify the same BVN.

**Implementation:**
- When a user successfully completes Step 1 (BVN_VERIFIED), the BVN is stored in `user.bvnData.bvn`
- Before initiating BVN validation, check if any other user already has this BVN
- Return error: "This BVN is already registered with another account"

---

## Data Storage

### User Model Fields

| Field | Type | Purpose |
|-------|------|---------|
| `walletSetupStep` | String | Current step in the flow |
| `walletSetupData` | JSON | Temporary data (sessionId, method) - cleared after BVN verification |
| `bvnData` | JSON | Verified BVN data from Mono |
| `transactionPin` | String | Hashed transaction PIN |

### bvnData Structure

```json
{
  "bvn": "22198338286",
  "firstName": "CHINEDU",
  "middleName": "WILSON",
  "lastName": "AJIKWU",
  "gender": "male",
  "dateOfBirth": "1990-01-15",
  "phoneNumber": "09037128859",
  "email": "wilsonajikwu@gmail.com",
  "residentialAddress": "...",
  "stateOfResidence": "...",
  "lgaOfResidence": "...",
  "image": "base64...",
  "nin": "...",
  "nationality": "Nigerian"
}
```
