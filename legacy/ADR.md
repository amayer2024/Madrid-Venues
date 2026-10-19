# Architecture Decision Records

## 1. Backend language and framework
Date: 2026-10-05
Status: Decided
Context: The assignment is graded on explaining my own code cold at a closed-book oral check that
multiplies the whole grade, and it must run as a single process with SQLite storage.
Decision: Python + Flask with the stdlib `sqlite3` module (no ORM) and `werkzeug.security` for
password hashing, which ships with Flask.
Alternatives considered: FastAPI — rejected because its Pydantic models, `Depends()` dependency
injection, and `async` add framework machinery I would have to explain under exam conditions for no
benefit at this scale. Django — rejected as far too heavy for two small domains (poor-judgment
signal per §1b).
Consequences: Every request handler is plain traceable Python, which is ideal for the comprehension
check. The cost is writing request validation and SQL by hand instead of getting it for free.

## 2. Scoping the two feature domains to be independently modularizable
Date: 2026-10-06
Status: Decided
Context: The assignment requires two backend domains coupled as little as possible, each able to
become its own microservice later. Passes (selling/redeeming passes) and Analytics (revenue
reporting) clearly need to share sales data without becoming entangled.
Decision: Analytics owns its own `events` table and reports only from it; the Passes domain reaches
Analytics through a single function, `record_event()`, and nothing else — invoked at two lifecycle
points (`purchase()` records a `purchase` event and `refund()` records a `refund` event). There is
no foreign key between `events` and the Passes tables, and neither domain reads the other's tables.
Alternatives considered: Let Analytics query the `purchases` table directly with SQL joins —
rejected because it would bind Analytics to the Passes schema, so the two could never be split. A
message broker / event bus — rejected as out of scope (§1c forbids brokers; this is one process),
with the in-process `record_event()` call standing in for the future network boundary.
Consequences: To extract Analytics into its own service later, I turn the `record_event()` calls
into HTTP/queue messages and point its reports at the events it already owns — the seam is that one
function, the single integration surface between the domains, regardless of how many lifecycle
events call it. The cost now is a one-way in-process dependency (Passes imports Analytics only to
emit events).

## 3. SQLite data model for the Passes domain
Date: 2026-10-06
Status: Decided
Context: The Passes domain needs to sell limited-inventory passes and later feed revenue numbers to
the Analytics domain, so the schema has to handle money and stock correctly while keeping the two
domains loosely coupled.
Decision: Store all money as integer `*_cents` columns; model inventory as two columns on
`pass_products` (`quantity_total` fixed, `quantity_sold` incremented on purchase); give `purchases`
a text `status` enum (`active`/`redeemed`/`refunded`), a unique `redemption_code`, and a
denormalized `venue_id`. The Analytics `events` table (added later) will hold no foreign key into
these tables.
Alternatives considered: Storing prices as REAL/float — rejected because floating-point rounding
corrupts money math. A separate `inventory` table or per-pass rows — rejected as overkill for a
simple sold-vs-total count. A foreign key from `events` into `purchases` — rejected because it would
tie Analytics to the Passes schema and break the independent-domain goal (see ADR-2).
Consequences: Money math is exact and the oversell check is a trivial `quantity_sold >=
quantity_total` comparison. Denormalizing `venue_id` costs a little duplication but lets purchases
be reported on (and events recorded) without joining back through `pass_products`.

## 4. Testing approach and what coverage measures
Date: 2026-10-09
Status: Decided
Context: The grade is dominated by a closed-book oral check where I must explain my own code, and
the assignment asks for ≥70% test coverage on the core logic with a stated, reproducible figure.
The code is split into pure service modules (business rules), repository modules (SQL), and thin
Flask routes (HTTP glue).
Decision: Test the service and repository layers directly against a per-test temporary SQLite
database (the `conn` fixture in `tests/conftest.py`), and measure coverage on `auth`, `passes`, and
`analytics` only — not `app.py`. Each test drives one branch of the logic (e.g. sold-out, double
redeem, refund-of-another-user, empty-report, seed idempotency). The documented command is
`pytest --cov=auth --cov=passes --cov=analytics --cov-report=term-missing`.
Alternatives considered: HTTP-level tests through the Flask test client — rejected because they are
slower, mostly re-prove what the service tests already cover, and would pull framework glue into the
coverage number, making it less meaningful. No coverage gate at all — rejected because the
assignment wants a concrete, reproducible figure.
Consequences: The tests exercise exactly the code I have to explain at the oral check, and the
coverage number reflects real logic rather than routing boilerplate. Current result: 34 tests, 100%
line coverage on the measured modules. The cost is that the thin routes are verified by hand (live
`curl` / browser checks during development) rather than by automated HTTP tests.

## 5. Deliberately not building real payment processing
Date: 2026-10-11
Status: Decided
Context: Buying a pass is a paid transaction, so a product I could actually ship would eventually
charge a card; I had to decide whether to integrate a payment gateway now or defer it.
Decision: `purchase()` records the sale as a transaction (the price is copied into
`purchases.price_cents_paid` and a redemption code is issued) but does not charge real money; a
payment gateway is explicitly out of scope for this assignment.
Alternatives considered: Integrating a real gateway such as Stripe or PayPal — rejected because it
requires an external runtime dependency plus secret/API-key management, which is in tension with
§7.6 ("no required external runtime dependency beyond a public API your use case genuinely needs")
and the single-container contract, and it drags in PCI-compliance scope that teaches nothing about
the DevOps modularization goal of this assignment. A fake in-app "wallet" balance — rejected as
busywork that simulates payment without being real, adding a table and rules I would have to explain
for no learning value.
Consequences: The money path stays a clean integer-cents bookkeeping record that both domains
already rely on (Passes stores it, Analytics reports on it), and the purchase flow is fully testable
with no network calls or secrets. The cost is that "payment" is modelled, not executed; wiring in a
real gateway — and its secrets, through the same environment-variable config approach in
`config.py` — is deferred to when the app is actually deployed.
