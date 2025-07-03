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

### Settled Auctions
- **GET /api/admin/auctions/settled/pending** — Get all pending settled auctions.
- **PATCH /api/admin/auctions/settled/:id/approve** — Approve a settled auction.
- **PATCH /api/admin/auctions/settled/:id/reject** — Reject a settled auction. Body: `{ rejectionReason }`

### Live Auctions
- **GET /api/admin/auctions/live** — Get all live auctions by status (pending, approved, etc.).
- **GET /api/admin/auctions/live/pending** — Get all pending live auctions.
- **PATCH /api/admin/auctions/live/:id/approve** — Approve a live auction.
- **PATCH /api/admin/auctions/live/:id/reject** — Reject a live auction. Body: `{ rejectionReason }`

---

## Authenticated User Endpoints

- **GET /api/auth/profile** — Get the profile of the currently logged-in user.
- **POST /api/auth/refresh-token** — Refresh access token.
- **GET /api/auth/winnings** — Get user winnings (auctions they won).
- **GET /api/auth/user/:id** — Get user details by ID (for winner information).

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

