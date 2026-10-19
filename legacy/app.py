"""LineSkip — Flask entrypoint. Single process, started by `python app.py` (deployment contract §7)."""
from functools import wraps

from flask import Flask, g, jsonify, render_template, request

import config
import db
from analytics import service as analytics_service
from auth import service as auth_service
from passes import repository as passes_repo
from passes import service as passes_service


def require_auth(view):
    """Flask glue: resolve the Bearer token to a user_id (stored on g) or return 401."""
    @wraps(view)
    def wrapper(*args, **kwargs):
        token = _bearer_token()
        conn = db.get_connection()
        try:
            user_id = auth_service.verify_session(conn, token)
        finally:
            conn.close()
        if user_id is None:
            return jsonify(error="authentication required"), 401
        g.user_id = user_id
        return view(*args, **kwargs)

    return wrapper


def _bearer_token():
    header = request.headers.get("Authorization", "")
    if header.startswith("Bearer "):
        return header[len("Bearer ") :]
    return None


def create_app():
    app = Flask(__name__)
    db.init_db()
    # Seed sample venues on startup (idempotent) so the app is usable with no manual setup.
    seed_conn = db.get_connection()
    try:
        passes_repo.seed_venues(seed_conn)
    finally:
        seed_conn.close()

    @app.get("/health")
    def health():
        return jsonify(status="ok")

    # --- HTML pages (thin client over the JSON API; /venues* stays JSON) ----

    @app.get("/")
    def page_index():
        conn = db.get_connection()
        try:
            venues = passes_repo.list_venues(conn)
        finally:
            conn.close()
        return render_template("index.html", venues=venues)

    @app.get("/venue/<int:venue_id>")
    def page_venue(venue_id):
        conn = db.get_connection()
        try:
            venue = passes_repo.get_venue(conn, venue_id)
            if venue is None:
                return render_template("venue.html", venue=None, passes=[]), 404
            passes = passes_repo.list_pass_products(conn, venue_id)
        finally:
            conn.close()
        return render_template("venue.html", venue=venue, passes=passes)

    @app.get("/login")
    def page_login():
        return render_template("login.html")

    @app.get("/my-passes")
    def page_my_passes():
        return render_template("my_passes.html")

    @app.get("/dashboard")
    def page_dashboard():
        return render_template("dashboard.html")

    @app.get("/venues")
    def list_venues():
        conn = db.get_connection()
        try:
            venues = passes_repo.list_venues(conn)
        finally:
            conn.close()
        return jsonify([dict(v) for v in venues])

    @app.get("/venues/<int:venue_id>/passes")
    def list_venue_passes(venue_id):
        conn = db.get_connection()
        try:
            venue = passes_repo.get_venue(conn, venue_id)
            if venue is None:
                return jsonify(error="venue not found"), 404
            passes = passes_repo.list_pass_products(conn, venue_id)
        finally:
            conn.close()
        return jsonify([dict(p) for p in passes])

    @app.post("/auth/register")
    def register():
        data = request.get_json(silent=True) or {}
        conn = db.get_connection()
        try:
            user_id = auth_service.register(conn, data.get("email"), data.get("password"))
        except auth_service.AuthError as exc:
            return jsonify(error=str(exc)), 400
        finally:
            conn.close()
        return jsonify(id=user_id), 201

    @app.post("/auth/login")
    def login():
        data = request.get_json(silent=True) or {}
        conn = db.get_connection()
        try:
            token = auth_service.login(conn, data.get("email"), data.get("password"))
        except auth_service.AuthError as exc:
            return jsonify(error=str(exc)), 401
        finally:
            conn.close()
        return jsonify(token=token)

    @app.get("/auth/me")
    @require_auth
    def me():
        return jsonify(user_id=g.user_id)

    @app.post("/passes/purchase")
    @require_auth
    def purchase_pass():
        data = request.get_json(silent=True) or {}
        conn = db.get_connection()
        try:
            result = passes_service.purchase(conn, g.user_id, data.get("pass_product_id"))
        except passes_service.PassError as exc:
            return jsonify(error=str(exc)), 400
        finally:
            conn.close()
        return jsonify(result), 201

    @app.get("/passes/mine")
    @require_auth
    def my_passes():
        conn = db.get_connection()
        try:
            rows = passes_repo.list_purchases_for_user(conn, g.user_id)
        finally:
            conn.close()
        return jsonify([dict(r) for r in rows])

    @app.post("/passes/redeem")
    def redeem_pass():
        # Open endpoint: the redemption code itself is the credential (models door staff scanning).
        data = request.get_json(silent=True) or {}
        conn = db.get_connection()
        try:
            result = passes_service.redeem(conn, data.get("code"))
        except passes_service.PassError as exc:
            return jsonify(error=str(exc)), 400
        finally:
            conn.close()
        return jsonify(result)

    @app.post("/passes/<int:purchase_id>/refund")
    @require_auth
    def refund_pass(purchase_id):
        conn = db.get_connection()
        try:
            result = passes_service.refund(conn, purchase_id, g.user_id)
        except passes_service.PassError as exc:
            return jsonify(error=str(exc)), 400
        finally:
            conn.close()
        return jsonify(result)

    # --- Analytics reporting (read-only; open, like /venues) ---------------

    @app.get("/analytics/revenue")
    def analytics_revenue():
        conn = db.get_connection()
        try:
            total = analytics_service.total_revenue(conn)
        finally:
            conn.close()
        return jsonify(total_revenue_cents=total)

    @app.get("/analytics/revenue/by-venue")
    def analytics_revenue_by_venue():
        conn = db.get_connection()
        try:
            rows = analytics_service.revenue_per_venue(conn)
        finally:
            conn.close()
        return jsonify(rows)

    @app.get("/analytics/venues/top")
    def analytics_top_venues():
        # Bad/missing ?n= falls back to 3 so a malformed query can't 500.
        n = request.args.get("n", default=3, type=int)
        if n is None or n < 1:
            n = 3
        conn = db.get_connection()
        try:
            rows = analytics_service.top_venues(conn, n)
        finally:
            conn.close()
        return jsonify(rows)

    @app.get("/analytics/revenue/by-day")
    def analytics_revenue_by_day():
        conn = db.get_connection()
        try:
            rows = analytics_service.revenue_per_day(conn)
        finally:
            conn.close()
        return jsonify(rows)

    return app


app = create_app()


if __name__ == "__main__":
    # Bind 0.0.0.0 and read PORT from env so the shared deployment script works unmodified.
    app.run(host="0.0.0.0", port=config.get_port())
