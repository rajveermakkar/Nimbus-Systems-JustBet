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
- **GET /api/auctions/approved** — Get all approved settled auctions (public marketplace view).
- **GET /api/auctions/:id** — Get auction with current bid information (public).
- **POST /api/auctions/:id/bid** — Place a bid on a settled auction (authenticated users only). Body: `{ amount }`
- **GET /api/auctions/:id/bids** — Get all bids for a settled auction (authenticated users only).

### Auctions (Live)
- **GET /api/live-auction?status=approved** — Get all approved live auctions (public live events view).

---

## Seller Endpoints (require authentication as seller)

- **POST /api/seller/request** — Request to become a seller. (if buyer)
- **GET /api/seller/status** — Get status of seller request. (if buyer)

### Settled Auctions
- **POST /api/seller/auctions** — Create a new settled auction. Body: `{ title, description, imageUrl, startTime, endTime, startingPrice, reservePrice }`
- **POST /api/seller/auctions/upload-image** — Upload image for settled auction. Form-data: `image` (file)
- **PATCH /api/seller/auctions/:id** — Update a settled auction (only by owner).
- **GET /api/seller/auctions** — Get all settled auctions created by the seller.

### Live Auctions
- **POST /api/seller/live-auction** — Create a new live auction. Body: `{ title, description, imageUrl, startTime, endTime, startingPrice, reservePrice, maxParticipants }`
- **POST /api/seller/live-auction/upload-image** — Upload image for live auction. Form-data: `image` (file)
- **PATCH /api/seller/live-auction/:id** — Update a live auction (only by owner).
- **GET /api/seller/live-auction** — Get all live auctions created by the seller.
- **POST /api/seller/live-auction/:id/restart** — Restart a live auction that didn't meet reserve price (only by owner).

---

## Admin Endpoints (require authentication as admin)

- **GET /api/admin/pending-sellers** — Get all pending seller approval requests.
- **PATCH /api/admin/sellers/:userId/approve** — Approve or reject a seller request.

### Settled Auctions
- **GET /api/admin/auctions/pending** — Get all pending settled auctions.
- **POST /api/admin/auctions/:id/approve** — Approve a settled auction.

### Live Auctions
- **GET /api/admin/live-auction?status=pending** — Get all live auctions by status (pending, approved, etc.).
- **PATCH /api/admin/live-auction/:id/approve** — Approve a live auction.

---

## Authenticated User Endpoints

- **GET /api/auth/profile** — Get the profile of the currently logged-in user.

---

## Notes
- All POST/PATCH endpoints that require authentication must include a valid JWT token in the `Authorization: Bearer <token>` header.
- For image upload endpoints, use `multipart/form-data` with a file field named `image`.
- For creating or updating auctions, required fields are specified in the body. Refer to the endpoint description for details.

