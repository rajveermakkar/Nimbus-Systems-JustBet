# API Routes Documentation

---

## Public Endpoints

### Authentication
- **POST /api/auth/register** — Register a new user. Body: `{ firstName, lastName, email, password }`
- **POST /api/auth/login** — Login user. Body: `{ email, password }`
- **POST /api/auth/resend-verification** — Resend email verification. Body: `{ email }`
- **GET /api/auth/verify-email?token=...** — Verify user email with token.
- **GET /api/auth/user-status?email=...** — Check if a user is verified.
- **POST /api/auth/forgot-password** — Request password reset. Body: `{ email }`
- **POST /api/auth/reset-password** — Reset password. Body: `{ email, token, newPassword }`
- **POST /api/auth/logout** — Logout user.

### Auctions (Settled)
- **GET /api/auctions/settled** — Get all approved settled auctions (public marketplace view).
- **GET /api/auctions/settled/:id** — Get a single settled auction (public).
- **POST /api/auctions/settled/:id/bid** — Place a bid on a settled auction (authenticated users only). Body: `{ amount }`
- **GET /api/auctions/settled/:id/bids** — Get all bids for a settled auction (authenticated users only).
- **GET /api/auctions/settled/:id/result** — Get result (winner info) for a settled auction.

### Auctions (Live)
- **GET /api/auctions/live** — Get all approved live auctions (public live events view).
- **GET /api/auctions/live/:id** — Get a single live auction (public).
- **GET /api/auctions/live/:id/bids** — Get bid history for a live auction (public).
- **GET /api/auctions/live/:id/result** — Get result (winner info) for a live auction.

### Auction Utilities
- **GET /api/auctions/countdown/:type/:id** — Get countdown for any auction (settled or live).

---

## Seller Endpoints (require authentication as seller)

- **POST /api/seller/request** — Request to become a seller. (if buyer)
- **GET /api/seller/status** — Get status of seller request. (if buyer)
- **GET /api/seller/analytics** — Get seller analytics and statistics.
- **GET /api/seller/auction-results** — Get auction results (winners, final bids, etc.).

### Settled Auctions
- **POST /api/seller/auctions/settled** — Create a new settled auction. Body: `{ title, description, imageUrl, startTime, endTime, startingPrice, reservePrice }`
- **POST /api/seller/auctions/settled/upload-image** — Upload image for settled auction. Form-data: `image` (file)
- **PATCH /api/seller/auctions/settled/:id** — Update a settled auction (only by owner).
- **GET /api/seller/auctions/settled/:id** — Get a single settled auction by ID (only by owner).
- **GET /api/seller/auctions/settled** — Get all settled auctions created by the seller.

### Live Auctions
- **POST /api/seller/auctions/live** — Create a new live auction. Body: `{ title, description, imageUrl, startTime, endTime, startingPrice, reservePrice, maxParticipants }`
- **POST /api/seller/auctions/live/upload-image** — Upload image for live auction. Form-data: `image` (file)
- **PATCH /api/seller/auctions/live/:id** — Update a live auction (only by owner).
- **GET /api/seller/auctions/live/:id** — Get a single live auction by ID (only by owner).
- **GET /api/seller/auctions/live** — Get all live auctions created by the seller.
- **POST /api/seller/auctions/live/:id/restart** — Restart a live auction that didn't meet reserve price (only by owner).

---

## Admin Endpoints (require authentication as admin)

- **GET /api/admin/pending-sellers** — Get all pending seller approval requests.
- **PATCH /api/admin/sellers/:userId/approve** — Approve or reject a seller request.
- **GET /api/admin/stats** — Get comprehensive statistics (users, auctions, pending requests).
- **GET /api/admin/earnings** — Get platform earnings and fee data. Returns: `{ earnings, totalEarnings, recentEarnings, monthlyData, totalCount }`

**Earnings Response Format:**
```json
{
  "earnings": [
    {
      "id": "...",
      "wallet_id": "...",
      "type": "platform_fee",
      "amount": 25.50,
      "description": "Platform fee from auction 123",
      "reference_id": "123",
      "status": "succeeded",
      "created_at": "2024-01-15T10:30:00Z",
      "user_email": "user@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "currency": "CAD"
    }
  ],
  "totalEarnings": 1250.75,
  "recentEarnings": 450.25,
  "monthlyData": [
    {
      "month": "2024-01",
      "amount": 450.25
    }
  ],
  "totalCount": 25
}
```
- **GET /api/admin/activity-logs** — Get aggregated activity logs from the last 48 hours. Returns: `{ logs: [...] }`

**Activity Logs Response Format:**
```json
{
  "logs": [
    {
      "timestamp": "2024-01-15T10:30:00Z",
      "user": "john@example.com",
      "action": "auction_created",
      "description": "Created new settled auction: Vintage Watch"
    }
  ]
}
```

### User Management
- **GET /api/admin/users** — Get all users with pagination and filtering.
- **PATCH /api/admin/users/:userId/role** — Change user role. Body: `{ role: "buyer" | "seller" | "admin" }`
- **POST /api/admin/users/:userId/ban** — Ban a user. Body: `{ reason }`
- **POST /api/admin/users/:userId/unban** — Unban a user.
- **GET /api/admin/users/:userId/ban-history** — Get ban history for a user.

**Ban/Unban Response Format:**
```json
{
  "user": {
    "id": "...",
    "email": "user@example.com",
    "is_banned": true,
    "ban_reason": "Violation of terms of service",
    "banned_at": "2024-01-15T10:30:00Z"
  },
  "token": "..." // Updated JWT token
}
```

### Settled Auctions
- **GET /api/admin/auctions/settled/pending** — Get all pending settled auctions.
- **PATCH /api/admin/auctions/settled/:id/approve** — Approve a settled auction.
- **PATCH /api/admin/auctions/settled/:id/reject** — Reject a settled auction. Body: `{ rejectionReason }`

### Live Auctions
- **GET /api/admin/auctions/live** — Get all live auctions by status (pending, approved, etc.).
- **GET /api/admin/auctions/live/pending** — Get all pending live auctions.
- **PATCH /api/admin/auctions/live/:id/approve** — Approve a live auction.
- **PATCH /api/admin/auctions/live/:id/reject** — Reject a live auction. Body: `{ rejectionReason }`

### Database Health
- **GET /api/admin/db-health** — Get database health metrics and performance data.

---

## Authenticated User Endpoints

- **GET /api/auth/profile** — Get the profile of the currently logged-in user.
- **POST /api/auth/refresh-token** — Refresh access token.
- **GET /api/auth/winnings** — Get user winnings (auctions they won).
- **GET /api/auth/user/:id** — Get user details by ID (for winner information).

---

## Wallet & Payments Endpoints

### Public (Stripe Webhook)
- **POST /api/wallet/webhook** — Stripe webhook endpoint for payment confirmation. (No auth, Stripe only)

### Authenticated User Endpoints (require JWT)
- **GET /api/wallet/balance** — Get the logged-in user's wallet balance. Returns: `{ balance, currency }`
- **GET /api/wallet/transactions** — Get the logged-in user's wallet transaction history. Returns: `{ transactions: [...] }`
- **POST /api/wallet/create** — Create a wallet for the logged-in user (if not exists). Returns: `{ wallet }`
- **POST /api/wallet/deposit/intent** — Create a Stripe payment intent for wallet deposit. Body: `{ amount }`. Returns: `{ clientSecret }`
- **POST /api/wallet/withdraw** — Create a withdrawal request (refund to original card). Body: `{ amount }`. Returns: `{ message, refundId, amount, userRole }`
- **GET /api/wallet/payment-methods** — List all saved card payment methods for the logged-in user. Returns: `{ paymentMethods: [...] }`
- **POST /api/wallet/payment-methods/setup-intent** — Create a Stripe SetupIntent for adding a new card. Returns: `{ clientSecret }`
- **DELETE /api/wallet/payment-methods/:id** — Remove a saved card payment method by its Stripe ID. Returns: `{ success: true }`

**Notes:**
- All wallet endpoints except `/webhook` require authentication (JWT in Authorization header or cookie).
- Wallets are created automatically for new users during registration.
- Deposits are processed in CAD. Use the returned `clientSecret` with Stripe.js on the frontend to complete payment.
- The webhook endpoint is for Stripe to call after payment; do not call it manually.
- **Security**: Direct API access to deposit/withdrawal endpoints is controlled by `ALLOW_DIRECT_API_ACCESS` environment variable.
- **Withdrawals**: 
  - Sellers can withdraw their earnings (total sales minus previous withdrawals)
  - Buyers can only withdraw unspent deposits (deposits minus spent on auctions)
  - Withdrawals are processed as refunds to the original payment method
- **Daily Limits**: Deposits are limited to $1000 CAD per day per user
- **Validation**: All payments are verified to be real (not test payments) before processing

---

## Order Endpoints

### Authenticated User Endpoints (require JWT)

- **POST /api/orders** — Submit shipping details for a won auction.
  - Body:
    ```json
    {
      "auction_id": "...",
      "auction_type": "live" | "settled",
      "shipping_address": "...",
      "shipping_city": "...",
      "shipping_state": "...",
      "shipping_postal_code": "...",
      "shipping_country": "..."
    }
    ```
  - Returns: The created or updated order object.

- **GET /api/orders/winner** — Get all orders for the logged-in user as a winner.
  - Returns: Array of order objects.

- **GET /api/orders/seller** — Get all orders for the logged-in user as a seller.
  - Returns: Array of order objects (with auction and winner info).

- **PATCH /api/orders/:orderId/status** — Seller updates shipping status for an order.
  - Body:
    ```json
    { "status": "under_process" | "shipped" | "delivered" }
    ```
  - Only the seller for the order can update the status.
  - Returns: The updated order object.

**Notes:**
- All order endpoints require authentication (JWT in Authorization header or cookie).
- Only the winner of an auction can submit shipping details for that auction.
- Only the seller can update the shipping status of their orders.

---

## Notes
- All POST/PATCH endpoints that require authentication must include a valid JWT token in the `Authorization: Bearer <token>` header.
- For image upload endpoints, use `multipart/form-data` with a file field named `image`.
- For creating or updating auctions, required fields are specified in the body. Refer to the endpoint description for details.
- Seller endpoints require the user to have an approved seller role.
- Admin endpoints require the user to have an admin role.
- Auction rejection requires a `rejectionReason` field in the request body to provide explanation for the rejection.
- The stats endpoint returns comprehensive data including user counts (buyers, sellers, pending requests) and auction counts (pending, approved, rejected, closed) for both live and settled auctions.

---

## Updatable Fields for Auctions

### Settled Auctions (PATCH /api/seller/auctions/settled/:id)
- title
- description
- image_url
- start_time
- end_time
- starting_price
- reserve_price
- min_bid_increment (optional, defaults to 5 if not provided)

### Live Auctions (PATCH /api/seller/auctions/live/:id)
- title
- description
- image_url
- start_time
- end_time
- starting_price
- reserve_price
- min_bid_increment (optional, defaults to 5 if not provided)
- max_participants

**Note:**
- `min_bid_increment` is always used in bidding logic. If not provided, it defaults to 5.
- `max_participants` is only required for live auctions.
- Approval is handled by setting `status` to `approved` for both auction types.

