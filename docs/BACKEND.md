# BiteBox Backend — Documentation

Spring Boot 3.3 / Java 21 / Spring Web + Data JPA + Security / MySQL / JWT (JJWT) / Maven.

## Architecture

```
com.bitebox
├── BiteboxApplication.java
├── config/        AppConfig (BCrypt bean), SecurityConfig (CORS, auth rules), DataSeeder
├── controller/    AuthController, MenuController, OrderController, AdminController
├── dto/           AuthDtos, MenuDtos, OrderDtos, AdminDtos (records + Bean Validation)
├── entity/        User, Category, MenuItem, Order, OrderItem, Role, OrderStatus
├── repository/    Spring Data JPA repositories
├── service/       AuthService, MenuService, OrderService, AdminService, JwtService
├── security/      JwtAuthFilter (Bearer token → ROLE_CUSTOMER / ROLE_ADMIN)
└── exception/     GlobalExceptionHandler (consistent JSON errors)
```

Flow: `Controller → Service → Repository → MySQL`. Controllers contain no business
logic; services own pricing rules and ownership checks.

## Database schema (MySQL, `bitebox`, InnoDB)

| Table | Key columns | Relations |
|---|---|---|
| `users` | id PK, name, email UK, password_hash, phone, role ENUM, created_at | 1─n `orders` |
| `categories` | id PK, name UK, description | 1─n `menu_items` |
| `menu_items` | id PK, name, description, price DECIMAL(10,2), image_url, category_id FK, available, rating, reviews | n─1 `categories` |
| `orders` | id PK, order_ref UK (`BB-XXXXXXXX`), user_id FK, status ENUM, delivery fields, subtotal/delivery/packaging/discount/coupon/total, created_at | 1─n `order_items` |
| `order_items` | id PK, order_id FK (cascade), menu_item_id FK, item_name snapshot, quantity, unit_price snapshot | n─1 `orders`, `menu_items` |

`unit_price` and `item_name` are **snapshots** — historical orders never change
when menu prices/names change.

## Pricing rules (server-side, mirrors `js/pricing.js`)

- Delivery ₹40 + packaging ₹20 when the order has items.
- Tier discount on subtotal: >₹1000 → 25%, ≥₹800 → 15%, ≥₹699 → 10%.
- Coupons: `BITE10` (10% off subtotal, max ₹100), `BITE20` (20% off if subtotal ≥₹699), `FREESHIP` (waives delivery).
- **The backend recomputes everything from DB prices — client totals are display-only.**

## API endpoints

Base URL: `http://localhost:8081` — all under `/api`.

### Auth (public)
| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/api/auth/register` | `{name,email,phone?,password}` | `AuthResponse{token,userId,name,email,phone,role}` |
| POST | `/api/auth/login` | `{email,password}` | same |

### Menu
| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/api/menu?category=&q=` | public | list, optional filters |
| GET | `/api/menu/{id}` | public | single item |
| POST | `/api/menu` | ADMIN | create |
| PUT | `/api/menu/{id}` | ADMIN | update |
| DELETE | `/api/menu/{id}` | ADMIN | delete |

### Orders (authenticated, `Authorization: Bearer <jwt>`)
| Method | Path | Notes |
|---|---|---|
| POST | `/api/orders` | `{items:[{menuItemId,quantity}], delivery:{house,street,city,state,pin,instructions,paymentMethod}, couponCode?}` → 201 `OrderResponse` |
| GET | `/api/orders` | caller's own orders, newest first |
| GET | `/api/orders/{orderRef}` | owner or admin; others → 403 |

### Admin (ADMIN role only)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/admin/stats` | totals, revenue (excl. cancelled), pending, menu items, customers |
| GET | `/api/admin/orders` | all orders |
| PATCH | `/api/admin/orders/{orderRef}/status` | `{status}` — PENDING/CONFIRMED/PREPARING/OUT_FOR_DELIVERY/DELIVERED/CANCELLED |
| GET | `/api/admin/customers` | per-customer order count + spend |
| GET | `/api/admin/analytics` | status counts, top items, revenue |

### Errors
`{ "error": "message" }` — 400 validation (with `fields` map), 401 unauthenticated,
403 forbidden, 404 not found, 409 duplicate email, 500 generic.

## Setup (Windows PowerShell)

Prereqs: Java 21+, Maven 3.9+, MySQL running on `localhost:3306`.

```powershell
cd "C:\class web development\Bitebox\backend"
$env:DB_USER = "root"                    # optional, defaults shown
$env:DB_PASSWORD = "your-mysql-password"  # optional, dev default is 'password'
$env:JWT_SECRET = "long-random-string"    # optional, MUST be set for production
mvn spring-boot:run
```

Backend listens on **http://localhost:8081**. On first boot it creates the
`bitebox` schema, tables (JPA `ddl-auto: update`), seeds 4 menu items and the
demo admin `admin@bitebox.demo` / `admin123` (**local dev only**).

## Frontend connection

- `js/api.js` → `BB_API` client, base `http://localhost:8081`, token in
  `localStorage` key `biteboxToken`.
- API-first with graceful fallback: if the backend is unreachable, the site
  keeps working in demo mode (localStorage auth/cart/orders).
- Checkout posts a real order only when logged in via API **and** every cart
  item carries a `menuItemId`; otherwise it produces a local demo ticket.
- `admin.html` enters live mode automatically for ADMIN-role JWTs.

## Testing

```powershell
# Menu (public)
curl http://localhost:8081/api/menu

# Register / login
curl -X POST http://localhost:8081/api/auth/register -H "Content-Type: application/json" -d '{"name":"Test","email":"t@t.dev","password":"test123"}'
curl -X POST http://localhost:8081/api/auth/login -H "Content-Type: application/json" -d '{"email":"t@t.dev","password":"test123"}'

# Authenticated order (use token from login)
curl -X POST http://localhost:8081/api/orders -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{"items":[{"menuItemId":1,"quantity":2}],"delivery":{"house":"1","street":"St","city":"City","state":"ST","pin":"411001","paymentMethod":"UPI"}}'
```

Postman: import `docs/postman/` (if present) or create requests manually —
set `Authorization: Bearer <token>` header after login.

Verified manually: menu list, register, login, order create (server-side
totals + coupon), order list, 401 without token, admin stats, 403 for
customer→admin access.

## Production configuration

Two Spring profiles:

- **`default` (dev)** — `application.yml`: localhost MySQL `root`/`password`
  defaults, `ddl-auto: update`, JWT dev secret fallback, CORS = localhost origins.
- **`prod`** — `application-prod.yml`: **no credential defaults** — the app
  refuses to start unless `DB_USER`, `DB_PASSWORD`, `JWT_SECRET` are set;
  `ddl-auto: validate` (schema must be migrated deliberately); CORS from
  `CORS_ORIGINS`; only `/actuator/health` exposed, details hidden.

Run prod locally (PowerShell):

```powershell
$env:DB_USER="..."; $env:DB_PASSWORD="..."; $env:JWT_SECRET="..."
$env:CORS_ORIGINS="https://your-frontend-domain.com"
mvn spring-boot:run -Dspring-boot.run.profiles=prod
```

Health check: `GET /actuator/health` → `{"status":"UP"}` (public, no details).

## Security notes

- BCrypt password hashing; passwords never stored or returned in plaintext.
- Stateless JWT (HS256, 24h) — set `JWT_SECRET` to a long random value in production.
- Role enforcement is server-side (`@PreAuthorize`, security config) — hiding
  `admin.html` is UX only.
- CORS allows localhost dev origins only.
- DB credentials come from env vars; the `root/password` default is for local
  development only and must be overridden anywhere real.
