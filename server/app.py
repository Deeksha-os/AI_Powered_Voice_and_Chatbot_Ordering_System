# server/app.py
import os
import hmac
import hashlib
import json
from datetime import datetime, timedelta

from flask import Flask, request, jsonify, abort
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from flask_cors import CORS
from dotenv import load_dotenv

try:
    import razorpay  # type: ignore

    _razorpay_available = True
except Exception as _e:
    print("Razorpay import failed; payment endpoints will be disabled:", _e)
    razorpay = None
    _razorpay_available = False

load_dotenv()
# Also load .env from the server directory explicitly (helps on Windows)
try:
    from pathlib import Path

    server_env = Path(__file__).parent / ".env"
    if server_env.exists():
        load_dotenv(server_env.as_posix(), override=True)
except Exception as _e:
    pass

app: Flask = Flask(__name__)
CORS(app)

# Config
DB_URI = os.getenv("DATABASE_URL", "sqlite:///ecommerce.db")
app.config["SQLALCHEMY_DATABASE_URI"] = DB_URI
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)

RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET")
RAZORPAY_WEBHOOK_SECRET = os.getenv("RAZORPAY_WEBHOOK_SECRET")


# Compute test mode dynamically from environment every time
def is_test_mode() -> bool:
    v = os.getenv("ALLOW_TEST_PAYMENTS", "0")
    return v in {"1", "true", "True", "YES", "yes", "on", "ON"}


razorpay_client = None
if _razorpay_available and RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET:
    try:
        razorpay_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
    except Exception as _e:
        print("Failed to initialize Razorpay client; disabling payments:", _e)
        razorpay_client = None


# --------------------
# Models
# --------------------
class Product(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False)
    price = db.Column(db.Float, nullable=False)  # INR
    unit = db.Column(db.String(50), nullable=True)
    category = db.Column(db.String(50), nullable=True)
    stock = db.Column(db.Integer, default=0)
    image = db.Column(db.String(50), nullable=True)


class Order(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    razorpay_order_id = db.Column(db.String(100), unique=True, nullable=True)
    total = db.Column(db.Float, nullable=False)
    status = db.Column(db.String(50), default="Pending")
    address = db.Column(db.Text, nullable=True)
    customer_name = db.Column(db.String(120), nullable=True)
    customer_phone = db.Column(db.String(20), nullable=True)
    payment_id = db.Column(db.String(100), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    items = db.relationship("OrderItem", backref="order", cascade="all, delete-orphan")


class OrderLocation(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey("order.id"), nullable=False, unique=True)
    latitude = db.Column(db.Float, nullable=True)
    longitude = db.Column(db.Float, nullable=True)
    status = db.Column(db.String(50), default="Preparing")  # Preparing | Dispatched | Out for delivery | Delivered
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class OrderItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey("order.id"), nullable=False)
    product_id = db.Column(db.Integer, nullable=False)
    product_name = db.Column(db.String(150), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    price = db.Column(db.Float, nullable=False)  # price per unit at time of order


# --------------------
# Auth: User model
# --------------------
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False, default="customer")  # customer | vendor | admin

    def set_password(self, password: str):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password: str) -> bool:
        return check_password_hash(self.password_hash, password)


class UserActivity(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=True)
    email = db.Column(db.String(120), nullable=False)
    role = db.Column(db.String(20), nullable=False)
    action = db.Column(db.String(50), nullable=False)  # signup | login
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class VendorVerification(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    vendor_email = db.Column(db.String(120), nullable=False, unique=True)
    vendor_name = db.Column(db.String(100), nullable=False)
    store_name = db.Column(db.String(100), nullable=False)
    owner_name = db.Column(db.String(100), nullable=False)
    phone = db.Column(db.String(20), nullable=True)
    status = db.Column(db.String(20), nullable=False, default="pending")  # pending, approved, rejected
    admin_notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    reviewed_at = db.Column(db.DateTime, nullable=True)
    reviewed_by = db.Column(db.String(120), nullable=True)  # admin email who reviewed


class CustomerRequest(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    customer_email = db.Column(db.String(120), nullable=False)
    customer_name = db.Column(db.String(100), nullable=False)
    product_id = db.Column(db.Integer, nullable=False)
    product_name = db.Column(db.String(150), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    status = db.Column(db.String(50), default="pending")  # pending | notified | fulfilled
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


# --------------------
# Helper: seed products (use your mock list)
# --------------------
def seed_products():
    if Product.query.count() > 0:
        return
    mock_products = [
        {"id": 1, "name": "Fresh Tomatoes", "price": 40, "unit": "per kg", "category": "vegetables", "stock": 25,
         "image": "🍅"},
        {"id": 2, "name": "Organic Spinach", "price": 30, "unit": "per bunch", "category": "vegetables", "stock": 15,
         "image": "🥬"},
        {"id": 3, "name": "Sweet Bananas", "price": 60, "unit": "per dozen", "category": "fruits", "stock": 20,
         "image": "🍌"},
        {"id": 4, "name": "Fresh Apples", "price": 120, "unit": "per kg", "category": "fruits", "stock": 18,
         "image": "🍎"},
        {"id": 5, "name": "Whole Milk", "price": 65, "unit": "per litre", "category": "dairy", "stock": 30,
         "image": "🥛"},
        {"id": 6, "name": "Greek Yogurt", "price": 45, "unit": "per cup", "category": "dairy", "stock": 12,
         "image": "🥄"},
        {"id": 7, "name": "Basmati Rice", "price": 85, "unit": "per kg", "category": "staples", "stock": 50,
         "image": "🌾"},
        {"id": 8, "name": "Wheat Flour", "price": 42, "unit": "per kg", "category": "staples", "stock": 35,
         "image": "🌾"},
    ]
    for p in mock_products:
        prod = Product(
            id=p["id"],
            name=p["name"],
            price=p["price"],
            unit=p.get("unit"),
            category=p.get("category"),
            stock=p.get("stock", 0),
            image=p.get("image", ""),
        )
        db.session.add(prod)
    db.session.commit()
    print("Seeded products.")


# --------------------
# Seed admin user
# --------------------
def seed_admin() -> None:
    admin_email = os.getenv("ADMIN_EMAIL", "admin@freshmarket.com")
    admin_password = os.getenv("ADMIN_PASSWORD", "admin123")
    existing = User.query.filter_by(email=admin_email).first()
    if existing:
        return
    admin = User(email=admin_email, role="admin")
    admin.set_password(admin_password)
    db.session.add(admin)
    db.session.commit()
    print(f"Seeded admin user: {admin_email}")


def seed_test_users() -> None:
    """Seed test users for all roles"""
    test_users = [
        {"email": "customer@test.com", "password": "test123", "role": "customer"},
        {"email": "vendor@test.com", "password": "test123", "role": "vendor"},
    ]
    
    for user_data in test_users:
        existing = User.query.filter_by(email=user_data["email"]).first()
        if existing:
            continue
        user = User(email=user_data["email"], role=user_data["role"])
        user.set_password(user_data["password"])
        db.session.add(user)
        db.session.commit()
        print(f"Seeded {user_data['role']} user: {user_data['email']}")


# --------------------
# Endpoints
# --------------------
@app.route("/api/debug-config", methods=["GET"])
def debug_config():
    return jsonify({
        "allowTestPayments": is_test_mode(),
        "razorpayEnabled": bool(razorpay_client),
        "db": app.config.get("SQLALCHEMY_DATABASE_URI")
    })


@app.route("/api/products", methods=["GET"])
def get_products():
    prods = Product.query.all()
    data = [
        {
            "id": p.id,
            "name": p.name,
            "price": p.price,
            "unit": p.unit,
            "category": p.category,
            "stock": p.stock,
            "image": p.image,
        }
        for p in prods
    ]
    return jsonify(data)


@app.route("/api/admin/recent-activity", methods=["GET"])
def recent_activity():
    # Support simple pagination
    try:
        limit = int(request.args.get("limit", 100))
    except Exception:
        limit = 100
    try:
        offset = int(request.args.get("offset", 0))
    except Exception:
        offset = 0
    q = UserActivity.query.order_by(UserActivity.created_at.desc())
    acts = q.offset(offset).limit(min(limit, 1000)).all()
    data = [
        {
            "name": a.name,
            "email": a.email,
            "role": a.role,
            "action": a.action,
            "created_at": a.created_at.isoformat(),
        }
        for a in acts
    ]
    return jsonify({"items": data, "nextOffset": offset + len(data)})


@app.route("/api/products", methods=["POST"])
def create_product():
    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "name is required"}), 400
    try:
        price = float(data.get("price") or 0)
    except Exception:
        return jsonify({"error": "invalid price"}), 400
    try:
        stock = int(data.get("stock") or 0)
    except Exception:
        return jsonify({"error": "invalid stock"}), 400
    unit = (data.get("unit") or "").strip() or None
    category = (data.get("category") or "").strip() or None
    image = (data.get("image") or "").strip() or None

    prod = Product(name=name, price=price, stock=stock, unit=unit, category=category, image=image)
    db.session.add(prod)
    db.session.commit()
    return jsonify({"success": True, "product": {
        "id": prod.id,
        "name": prod.name,
        "price": prod.price,
        "unit": prod.unit,
        "category": prod.category,
        "stock": prod.stock,
        "image": prod.image,
    }}), 201


@app.route("/api/products/<int:pid>", methods=["PUT"])
def update_product(pid: int):
    prod = Product.query.get(pid)
    if not prod:
        return jsonify({"error": "Product not found"}), 404
    data = request.get_json() or {}
    if "name" in data:
        prod.name = str(data.get("name") or prod.name)
    if "price" in data:
        try:
            prod.price = float(data.get("price"))
        except Exception:
            return jsonify({"error": "invalid price"}), 400
    if "stock" in data:
        try:
            prod.stock = int(data.get("stock"))
        except Exception:
            return jsonify({"error": "invalid stock"}), 400
    if "unit" in data:
        prod.unit = str(data.get("unit") or "") or None
    if "category" in data:
        prod.category = str(data.get("category") or "") or None
    if "image" in data:
        prod.image = str(data.get("image") or "") or None
    db.session.commit()
    return jsonify({"success": True})


@app.route("/api/cart/add", methods=["POST"])
def add_to_cart():
    """
    Decrease stock when an item is added to the cart.
    Expects JSON: { product_id: int, quantity: int }
    """
    data = request.get_json() or {}
    product_id = data.get("product_id")
    quantity = data.get("quantity", 1)

    if not product_id:
        return jsonify({"error": "product_id is required"}), 400
    try:
        product_id = int(product_id)
        quantity = int(quantity)
    except Exception:
        return jsonify({"error": "Invalid product_id or quantity"}), 400
    if quantity <= 0:
        return jsonify({"error": "Quantity must be positive"}), 400

    product = Product.query.get(product_id)
    if not product:
        return jsonify({"error": "Product not found"}), 404
    if product.stock < quantity:
        return jsonify({"error": f"Insufficient stock. Available: {product.stock}"}), 400

    product.stock -= quantity
    db.session.commit()

    return jsonify({
        "success": True,
        "product": {
            "id": product.id,
            "name": product.name,
            "price": product.price,
            "unit": product.unit,
            "category": product.category,
            "stock": product.stock,
            "image": product.image,
        },
        "quantity_added": quantity
    })


@app.route("/api/cart/bulk-add", methods=["POST"])
def bulk_add_to_cart():
    """
    Add multiple items to cart in a single request.
    Expects JSON: { items: [{ product_id: int, quantity: int }, ...] }
    """
    data = request.get_json() or {}
    items = data.get("items", [])

    if not items or not isinstance(items, list):
        return jsonify({"error": "items array is required"}), 400

    if len(items) == 0:
        return jsonify({"error": "At least one item is required"}), 400

    results = []
    errors = []
    successful_additions = 0

    # Validate all items first
    for i, item in enumerate(items):
        product_id = item.get("product_id")
        quantity = item.get("quantity", 1)

        if not product_id:
            errors.append(f"Item {i+1}: product_id is required")
            continue

        try:
            product_id = int(product_id)
            quantity = int(quantity)
        except Exception:
            errors.append(f"Item {i+1}: Invalid product_id or quantity")
            continue

        if quantity <= 0:
            errors.append(f"Item {i+1}: Quantity must be positive")
            continue

        product = Product.query.get(product_id)
        if not product:
            errors.append(f"Item {i+1}: Product not found")
            continue

        if product.stock < quantity:
            errors.append(f"Item {i+1}: Insufficient stock. Available: {product.stock}")
            continue

        results.append({
            "product_id": product_id,
            "quantity": quantity,
            "product": {
                "id": product.id,
                "name": product.name,
                "price": product.price,
                "unit": product.unit,
                "category": product.category,
                "stock": product.stock,
                "image": product.image,
            }
        })

    # Proceed with stock updates for all valid items, even if some failed validation
    try:
        for result in results:
            product = Product.query.get(result["product_id"])
            product.stock -= result["quantity"]
            successful_additions += 1

        db.session.commit()

        # If there were validation errors, return partial success
        if errors:
            return jsonify({
                "success": True,
                "items_added": successful_additions,
                "results": results,
                "errors": errors,
                "partial_success": True
            }), 200

        return jsonify({
            "success": True,
            "items_added": successful_additions,
            "results": results
        })

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Database error: {str(e)}"}), 500


@app.route("/api/cart/remove", methods=["POST"])
def remove_from_cart():
    """
    Increase stock when an item is removed from the cart.
    Expects JSON: { product_id: int, quantity: int }
    """
    data = request.get_json() or {}
    product_id = data.get("product_id")
    quantity = data.get("quantity", 1)

    if not product_id:
        return jsonify({"error": "product_id is required"}), 400
    try:
        product_id = int(product_id)
        quantity = int(quantity)
    except Exception:
        return jsonify({"error": "Invalid product_id or quantity"}), 400
    if quantity <= 0:
        return jsonify({"error": "Quantity must be positive"}), 400

    product = Product.query.get(product_id)
    if not product:
        return jsonify({"error": "Product not found"}), 404

    product.stock += quantity
    db.session.commit()

    return jsonify({
        "success": True,
        "product": {
            "id": product.id,
            "name": product.name,
            "price": product.price,
            "unit": product.unit,
            "category": product.category,
            "stock": product.stock,
            "image": product.image,
        },
        "quantity_removed": quantity
    })


@app.route("/api/payment/upi-qr", methods=["POST"])
def generate_upi_qr():
    """
    Generate a dynamic UPI payment string and a QR code URL for the amount/order.
    Expects JSON: { amount: float, order_id: str }
    """
    data = request.get_json() or {}
    try:
        amount = float(data.get("amount") or 0)
    except Exception:
        return jsonify({"error": "Invalid amount"}), 400
    order_id = str(data.get("order_id") or "")

    if amount <= 0:
        return jsonify({"error": "Invalid amount"}), 400

    upi_id = "freshmarket@paytm"
    upi_string = (
        f"upi://pay?pa={upi_id}&pn=FreshMarket&am={amount}&cu=INR&tn=Order%20{order_id}"
    )
    # Public QR service for demo purposes
    qr_url = (
            "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=" + upi_string
    )

    return jsonify({
        "success": True,
        "upi_string": upi_string,
        "qr_url": qr_url,
        "upi_id": upi_id,
        "amount": amount,
        "order_id": order_id,
    })


@app.route("/api/payment/scan-qr", methods=["POST"])
def scan_qr_payment():
    """
    Process QR code payment
    Expects JSON: { qr_data: str, order_id: str, amount: float }
    """
    data = request.get_json() or {}
    qr_data = data.get("qr_data", "")
    order_id = data.get("order_id", "")
    amount = data.get("amount", 0)

    if not qr_data or not order_id:
        return jsonify({"error": "Missing qr_data or order_id"}), 400

    # Parse UPI QR code data
    try:
        from urllib.parse import urlparse, parse_qs
        parsed_url = urlparse(qr_data)
        params = parse_qs(parsed_url.query)

        # Extract UPI parameters
        upi_id = params.get('pa', [''])[0]
        merchant_name = params.get('pn', ['Merchant'])[0]
        qr_amount = float(params.get('am', [amount])[0])
        currency = params.get('cu', ['INR'])[0]
        transaction_note = params.get('tn', ['Payment'])[0]

        # Validate UPI QR code format
        if not upi_id or '@' not in upi_id:
            return jsonify({
                "success": False,
                "error": "Invalid UPI QR code format"
            }), 400

    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Invalid QR code data"
        }), 400

    # Mock payment processing - in real implementation, you'd verify with UPI provider
    import random
    success_rate = 0.9 if qr_amount <= 1000 else 0.8 if qr_amount <= 5000 else 0.7
    is_successful = random.random() < success_rate

    if is_successful:
        # Create or update order status to paid
        order = Order.query.filter_by(razorpay_order_id=order_id).first()
        if not order:
            # Create a new order if it doesn't exist
            order = Order(
                razorpay_order_id=order_id,
                total=qr_amount,
                status="Paid",
                customer_name="QR Payment User",
                customer_phone="",
                address="QR Payment Address"
            )
            db.session.add(order)

        order.status = "Paid"
        order.payment_id = f"qr_{int(datetime.utcnow().timestamp())}"
        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Payment processed successfully",
            "transaction_id": f"qr_{int(datetime.utcnow().timestamp())}",
            "merchant": merchant_name,
            "amount": qr_amount,
            "currency": currency,
            "upi_id": upi_id
        })
    else:
        return jsonify({
            "success": False,
            "error": "Payment processing failed. Please try again."
        }), 400


@app.route("/api/auth/signup", methods=["POST"])
def signup():
    try:
        data = request.get_json() or {}
        email = (data.get("email") or "").strip().lower()
        password = data.get("password") or ""
        role = (data.get("role") or "customer").strip().lower()
        name = (data.get("name") or data.get("fullName") or email.split('@')[0]).strip()

        print(f"Signup attempt for email: {email}, role: {role}")  # Debug log

        if not email or not password:
            return jsonify({"error": "Email and password are required"}), 400
        if role not in {"customer", "vendor", "admin"}:
            role = "customer"

        existing_user = User.query.filter_by(email=email).first()
        if existing_user:
            print(f"Email already registered: {email}")  # Debug log
            return jsonify({"error": "Email already registered"}), 409

        # Handle vendor signup differently - require admin approval
        if role == "vendor":
            # Check if vendor verification already exists
            existing_verification = VendorVerification.query.filter_by(vendor_email=email).first()
            if existing_verification:
                return jsonify({"error": "Vendor verification request already exists"}), 409

            # Check if user already exists
            existing_user = User.query.filter_by(email=email).first()
            if existing_user:
                return jsonify({"error": "Email already registered"}), 409

            # Create vendor verification request
            store_name = data.get("storeName", "")
            owner_name = data.get("ownerName", name)
            phone = data.get("phone", "")

            verification = VendorVerification(
                vendor_email=email,
                vendor_name=name,
                store_name=store_name,
                owner_name=owner_name,
                phone=phone,
                status="pending"
            )
            db.session.add(verification)
            
            # Also create the user account with the password, but it will be blocked until admin approves
            user = User(email=email, role="vendor")
            user.set_password(password)
            db.session.add(user)
            
            db.session.commit()

            print(f"Vendor verification request created for: {email}")  # Debug log

            return jsonify({
                "success": True,
                "message": "Vendor verification request submitted. You will be notified once approved by admin.",
                "verification_id": verification.id
            }), 201

        # For customer and admin signup, create user directly
        user = User(email=email, role=role)
        user.set_password(password)
        db.session.add(user)
        db.session.commit()

        print(f"Signup successful for user: {user.email}, role: {user.role}")  # Debug log

        try:
            db.session.add(UserActivity(name=name, email=user.email, role=user.role, action="signup"))
            db.session.commit()
        except Exception as e:
            print(f"Error logging user activity: {e}")  # Debug log
            db.session.rollback()

        return jsonify({
            "success": True,
            "user": {"id": user.id, "email": user.email, "role": user.role}
        }), 201
    except Exception as e:
        print(f"Signup error: {e}")  # Debug log
        return jsonify({"error": "Internal server error"}), 500


@app.route("/api/auth/login", methods=["POST"])
def login():
    try:
        data = request.get_json() or {}
        email = (data.get("email") or "").strip().lower()
        password = data.get("password") or ""
        name = (data.get("name") or data.get("fullName") or email.split('@')[0]).strip()

        print(f"Login attempt for email: {email}")  # Debug log

        if not email or not password:
            return jsonify({"error": "Email and password are required"}), 400

        user = User.query.filter_by(email=email).first()
        
        # Check if user doesn't exist but has a vendor verification request
        if not user:
            verification = VendorVerification.query.filter_by(vendor_email=email).first()
            if verification:
                # User has a vendor verification request
                if verification.status == "pending":
                    return jsonify({
                        "error": "Vendor account is pending admin approval. Please wait for verification.",
                        "status": "pending",
                        "message": "Your vendor registration is under review. You will be notified once approved."
                    }), 403
                elif verification.status == "rejected":
                    return jsonify({
                        "error": "Vendor account application was rejected.",
                        "status": "rejected",
                        "message": verification.admin_notes or "Please contact support for more information."
                    }), 403
                # If approved but no user created yet (shouldn't happen, but handle gracefully)
                return jsonify({"error": "Account not fully activated. Please contact support."}), 500
            else:
                print(f"User not found for email: {email}")  # Debug log
                return jsonify({"error": "Invalid credentials"}), 401
        
        if not user.check_password(password):
            print(f"Invalid password for email: {email}")  # Debug log
            return jsonify({"error": "Invalid credentials"}), 401

        # Check if vendor is approved
        if user.role == "vendor":
            verification = VendorVerification.query.filter_by(vendor_email=email).first()
            if not verification or verification.status != "approved":
                status = verification.status if verification else "pending"
                return jsonify({
                    "error": "Vendor account is pending admin approval. Please wait for admin verification.",
                    "status": status
                }), 403

        print(f"Login successful for user: {user.email}, role: {user.role}")  # Debug log

        try:
            db.session.add(UserActivity(name=name, email=user.email, role=user.role, action="login"))
            db.session.commit()
        except Exception as e:
            print(f"Error logging user activity: {e}")  # Debug log
            db.session.rollback()

        return jsonify({
            "success": True,
            "user": {"id": user.id, "email": user.email, "role": user.role}
        })
    except Exception as e:
        print(f"Login error: {e}")  # Debug log
        return jsonify({"error": "Internal server error"}), 500


@app.route("/api/auth/logout", methods=["POST"])
def logout():
    """
    Logout endpoint for logging user activity.
    Note: Since we use localStorage for session management, 
    this endpoint is mainly for logging purposes.
    """
    try:
        data = request.get_json() or {}
        email = (data.get("email") or "").strip().lower()
        name = (data.get("name") or email.split('@')[0]).strip()
        role = data.get("role", "unknown")

        if email:
            try:
                db.session.add(UserActivity(name=name, email=email, role=role, action="logout"))
                db.session.commit()
            except Exception as e:
                print(f"Error logging logout activity: {e}")
                db.session.rollback()

        return jsonify({
            "success": True,
            "message": "Logged out successfully"
        })
    except Exception as e:
        print(f"Logout error: {e}")
        return jsonify({"error": "Internal server error"}), 500


@app.route("/api/vendor/stock-notifications", methods=["GET"])
def get_stock_notifications():
    """
    Get stock notifications for vendors.
    Returns products that are out of stock or low stock.
    """
    try:
        # Get products with low or no stock
        low_stock_products = Product.query.filter(
            db.or_(Product.stock == 0, Product.stock < 10)
        ).all()
        
        notifications = []
        for product in low_stock_products:
            notification_type = "out_of_stock" if product.stock == 0 else "low_stock"
            priority = "high" if product.stock == 0 else "medium"
            
            notifications.append({
                "id": f"{notification_type}-{product.id}",
                "product_id": product.id,
                "product_name": product.name,
                "type": notification_type,
                "message": f"{product.name} is {'out of stock' if product.stock == 0 else f'running low ({product.stock} remaining)'}",
                "timestamp": datetime.utcnow().isoformat(),
                "priority": priority,
                "stock": product.stock
            })
        
        return jsonify({
            "success": True,
            "notifications": notifications
        })
        
    except Exception as e:
        print(f"Error fetching stock notifications: {e}")
        return jsonify({"error": "Internal server error"}), 500


@app.route("/api/vendor/customer-requests", methods=["GET"])
def get_customer_requests():
    """
    Get customer requests for out-of-stock items for vendors.
    Returns all pending customer requests.
    """
    try:
        # Get all pending customer requests, ordered by creation date (newest first)
        requests = CustomerRequest.query.filter_by(status="pending").order_by(CustomerRequest.created_at.desc()).all()
        
        requests_list = []
        for req in requests:
            requests_list.append({
                "id": req.id,
                "customer_email": req.customer_email,
                "customer_name": req.customer_name,
                "product_id": req.product_id,
                "product_name": req.product_name,
                "quantity": req.quantity,
                "status": req.status,
                "created_at": req.created_at.isoformat(),
            })
        
        return jsonify({
            "success": True,
            "requests": requests_list
        })
        
    except Exception as e:
        print(f"Error fetching customer requests: {e}")
        return jsonify({"error": "Internal server error"}), 500


@app.route("/api/customer/submit-request", methods=["POST"])
def submit_customer_request():
    """
    Submit a customer request for out-of-stock item.
    """
    try:
        data = request.get_json() or {}
        
        customer_email = data.get("email", "").strip().lower()
        customer_name = data.get("name", "").strip()
        product_id = data.get("product_id")
        product_name = data.get("product_name", "").strip()
        quantity = data.get("quantity", 1)
        
        if not customer_email or not customer_name or not product_id:
            return jsonify({"error": "Missing required fields"}), 400
        
        # Check if product exists and is out of stock
        product = Product.query.get(product_id)
        if not product:
            return jsonify({"error": "Product not found"}), 404
        
        if product.stock > 0:
            return jsonify({"error": "Product is not out of stock"}), 400
        
        # Create the request
        request_obj = CustomerRequest(
            customer_email=customer_email,
            customer_name=customer_name,
            product_id=product_id,
            product_name=product_name,
            quantity=quantity,
            status="pending"
        )
        db.session.add(request_obj)
        db.session.commit()
        
        return jsonify({
            "success": True,
            "message": "Request submitted successfully",
            "request_id": request_obj.id
        })
        
    except Exception as e:
        print(f"Error submitting customer request: {e}")
        return jsonify({"error": "Internal server error"}), 500


@app.route("/api/vendor/customer-requests/<int:request_id>/mark-notified", methods=["PUT"])
def mark_request_notified(request_id):
    """
    Mark a customer request as notified (vendor has been notified about stock)
    """
    try:
        request_obj = CustomerRequest.query.get(request_id)
        if not request_obj:
            return jsonify({"error": "Request not found"}), 404
        
        request_obj.status = "notified"
        db.session.commit()
        
        return jsonify({
            "success": True,
            "message": "Request marked as notified"
        })
        
    except Exception as e:
        print(f"Error updating customer request: {e}")
        return jsonify({"error": "Internal server error"}), 500


@app.route("/api/admin/statistics", methods=["GET"])
def get_admin_statistics():
    """
    Get comprehensive statistics for admin dashboard.
    """
    try:
        # Count users by role
        total_users = User.query.count()
        total_customers = User.query.filter_by(role="customer").count()
        total_vendors = User.query.filter_by(role="vendor").count()
        total_admins = User.query.filter_by(role="admin").count()
        
        # Count approved vendors
        approved_vendors = VendorVerification.query.filter_by(status="approved").count()
        
        # Count products
        total_products = Product.query.count()
        out_of_stock_products = Product.query.filter_by(stock=0).count()
        low_stock_products = Product.query.filter(Product.stock > 0, Product.stock <= 10).count()
        
        # Count orders and compute active orders/value (active = not delivered)
        total_orders = Order.query.count()
        active_orders_q = Order.query.filter(Order.status != "delivered")
        active_orders = active_orders_q.count()
        active_orders_value = db.session.query(db.func.sum(Order.total)).filter(Order.status != "delivered").scalar() or 0
        completed_orders = Order.query.filter_by(status="delivered").count()
        
        # Calculate revenue
        completed_orders_revenue = db.session.query(db.func.sum(Order.total)).filter(Order.status.in_(["Paid","delivered"])) .scalar() or 0
        
        # Calculate today's revenue (SQLite compatible)
        from datetime import date
        today = datetime.now().date()
        today_start = datetime.combine(today, datetime.min.time())
        today_end = datetime.combine(today, datetime.max.time())
        
        today_revenue = db.session.query(db.func.sum(Order.total)).filter(
            Order.status.in_(["Paid","delivered"]),
            Order.created_at >= today_start,
            Order.created_at <= today_end
        ).scalar() or 0

        # Inventory value = sum of vendors' items total amount of all products
        inventory_value = db.session.query(db.func.sum(Product.price * Product.stock)).scalar() or 0
        
        # Count pending vendor verifications
        pending_verifications = VendorVerification.query.filter_by(status="pending").count()
        
        # System uptime (mock for now - in real app, you'd track actual uptime)
        system_uptime = "99.8%"
        
        # Recent activity count (last 24 hours) - SQLite syntax
        recent_activity = UserActivity.query.filter(
            UserActivity.created_at >= datetime.utcnow() - timedelta(hours=24)
        ).count()
        
        statistics = {
            "total_users": total_users,
            "total_customers": total_customers,
            "total_vendors": total_vendors,
            "total_admins": total_admins,
            "approved_vendors": approved_vendors,
            "total_products": total_products,
            "out_of_stock_products": out_of_stock_products,
            "low_stock_products": low_stock_products,
            "total_orders": total_orders,
            "active_orders": active_orders,
            "completed_orders": completed_orders,
            "active_orders_value": float(active_orders_value),
            # As requested, treat total_revenue card as inventory value
            "total_revenue": float(inventory_value),
            "today_revenue": float(today_revenue),
            "pending_verifications": pending_verifications,
            "system_uptime": system_uptime,
            "recent_activity": recent_activity
        }
        
        return jsonify({
            "success": True,
            "statistics": statistics
        })
        
    except Exception as e:
        print(f"Error fetching admin statistics: {e}")
        return jsonify({"error": "Internal server error"}), 500


@app.route("/api/admin/vendor-verifications", methods=["GET"])
def get_vendor_verifications():
    """
    Get all vendor verification requests for admin review.
    """
    try:
        verifications = VendorVerification.query.order_by(VendorVerification.created_at.desc()).all()
        
        verification_list = []
        for verification in verifications:
            verification_list.append({
                "id": verification.id,
                "vendor_email": verification.vendor_email,
                "vendor_name": verification.vendor_name,
                "store_name": verification.store_name,
                "owner_name": verification.owner_name,
                "phone": verification.phone,
                "status": verification.status,
                "admin_notes": verification.admin_notes,
                "created_at": verification.created_at.isoformat(),
                "reviewed_at": verification.reviewed_at.isoformat() if verification.reviewed_at else None,
                "reviewed_by": verification.reviewed_by
            })
        
        return jsonify({
            "success": True,
            "verifications": verification_list
        })
        
    except Exception as e:
        print(f"Error fetching vendor verifications: {e}")
        return jsonify({"error": "Internal server error"}), 500


@app.route("/api/admin/vendor-verifications/<int:verification_id>", methods=["PUT"])
def update_vendor_verification(verification_id):
    """
    Approve or reject vendor verification request.
    Expects JSON: { status: "approved" | "rejected", admin_notes: "optional notes" }
    """
    try:
        data = request.get_json() or {}
        status = data.get("status", "").strip().lower()
        admin_notes = data.get("admin_notes", "")
        admin_email = data.get("admin_email", "admin@freshmarket.com")  # In real app, get from session
        
        if status not in ["approved", "rejected"]:
            return jsonify({"error": "Status must be 'approved' or 'rejected'"}), 400
        
        verification = VendorVerification.query.get(verification_id)
        if not verification:
            return jsonify({"error": "Verification request not found"}), 404
        
        verification.status = status
        verification.admin_notes = admin_notes
        verification.reviewed_at = datetime.utcnow()
        verification.reviewed_by = admin_email
        
        # If approved, create the vendor user account
        if status == "approved":
            # Check if user already exists
            existing_user = User.query.filter_by(email=verification.vendor_email).first()
            if not existing_user:
                # Create vendor user account
                vendor_user = User(email=verification.vendor_email, role="vendor")
                # Set a temporary password - vendor will need to reset it
                vendor_user.set_password("temp_password_123")
                db.session.add(vendor_user)
                
                # Log the approval activity
                db.session.add(UserActivity(
                    name=verification.vendor_name,
                    email=verification.vendor_email,
                    role="vendor",
                    action="approved"
                ))
        
        db.session.commit()
        
        return jsonify({
            "success": True,
            "message": f"Vendor verification {status} successfully"
        })
        
    except Exception as e:
        print(f"Error updating vendor verification: {e}")
        db.session.rollback()
        return jsonify({"error": "Internal server error"}), 500


@app.route("/api/admin/users", methods=["GET"])
def admin_list_users():
    try:
        users = User.query.all()
        return jsonify({
            "success": True,
            "users": [
                {"id": u.id, "email": u.email, "role": u.role}
                for u in users
            ]
        })
    except Exception as e:
        print(f"Error listing users: {e}")
        return jsonify({"error": "Internal server error"}), 500


@app.route("/api/admin/vendors", methods=["GET"])
def admin_list_vendors():
    try:
        verifications = VendorVerification.query.order_by(VendorVerification.created_at.desc()).all()
        return jsonify({
            "success": True,
            "vendors": [
                {
                    "email": v.vendor_email,
                    "name": v.vendor_name,
                    "store_name": v.store_name,
                    "phone": v.phone,
                    "status": v.status,
                    "created_at": v.created_at.isoformat(),
                }
                for v in verifications if v.status == "approved"
            ]
        })
    except Exception as e:
        print(f"Error listing vendors: {e}")
        return jsonify({"error": "Internal server error"}), 500


@app.route("/api/admin/user-stats", methods=["GET"])
def admin_user_stats():
    """Compute user management stats: active customers (last 30d), new registrations (7d), retention%.
    Retention% = active_customers / total_customers * 100
    """
    try:
        total_customers = User.query.filter_by(role="customer").count()

        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        active_customers = UserActivity.query \
            .filter(UserActivity.role == "customer", UserActivity.created_at >= thirty_days_ago) \
            .with_entities(UserActivity.email).distinct().count()

        seven_days_ago = datetime.utcnow() - timedelta(days=7)
        new_registrations = UserActivity.query \
            .filter(UserActivity.role == "customer", UserActivity.action == "signup", UserActivity.created_at >= seven_days_ago) \
            .count()

        retention_percent = round((active_customers / total_customers) * 100.0, 2) if total_customers else 0.0

        return jsonify({
            "success": True,
            "stats": {
                "active_customers": active_customers,
                "new_registrations": new_registrations,
                "retention_percent": retention_percent,
                "total_customers": total_customers,
            }
        })
    except Exception as e:
        print(f"Error computing user stats: {e}")
        return jsonify({"error": "Internal server error"}), 500


@app.route("/api/admin/vendor-performance", methods=["GET"])
def admin_vendor_performance():
    """List approved vendors with placeholder orders/revenue (no vendor-order mapping available)."""
    try:
        vendors = VendorVerification.query.filter_by(status="approved").order_by(VendorVerification.created_at.desc()).all()
        return jsonify({
            "success": True,
            "vendors": [
                {
                    "email": v.vendor_email,
                    "name": v.vendor_name,
                    "store_name": v.store_name,
                    "phone": v.phone,
                    "orders": 0,
                    "revenue": 0.0,
                    "status": v.status,
                    "created_at": v.created_at.isoformat(),
                }
                for v in vendors
            ]
        })
    except Exception as e:
        print(f"Error computing vendor performance: {e}")
        return jsonify({"error": "Internal server error"}), 500

@app.route("/api/vendor/verification-status/<email>", methods=["GET"])
def get_vendor_verification_status(email):
    """
    Check vendor verification status by email.
    """
    try:
        verification = VendorVerification.query.filter_by(vendor_email=email).first()
        
        if not verification:
            return jsonify({
                "success": True,
                "status": "not_found",
                "message": "No verification request found"
            })
        
        return jsonify({
            "success": True,
            "status": verification.status,
            "message": verification.admin_notes or "",
            "created_at": verification.created_at.isoformat(),
            "reviewed_at": verification.reviewed_at.isoformat() if verification.reviewed_at else None
        })
        
    except Exception as e:
        print(f"Error checking vendor verification status: {e}")
        return jsonify({"error": "Internal server error"}), 500


@app.route("/api/create-order", methods=["POST"])
def create_order():
    """
    Expects JSON:
      { cart: { "<productId>": qty, ... }, address: "...", total: <client_total> }
    Server will compute total from DB for security, create Razorpay order, and store order.
    """
    data = request.get_json() or {}
    cart = data.get("cart") or {}
    address = data.get("address", "")
    customer_name = (data.get("name") or data.get("customer_name") or "").strip()
    customer_phone = (data.get("phone") or data.get("customer_phone") or "").strip()
    payment_method = (data.get("paymentMethod") or data.get("payment_method") or "online").lower()
    client_total = float(data.get("amount") or data.get("total") or 0)

    if not cart:
        return jsonify({"error": "Cart is empty"}), 400

    # compute total on server from DB (prevent client tampering)
    server_total = 0.0
    items = []
    for pid_str, qty in cart.items():
        try:
            pid = int(pid_str)
            qty = int(qty)
        except Exception:
            return jsonify({"error": "Invalid cart format"}), 400
        product = Product.query.get(pid)
        if not product:
            return jsonify({"error": f"Product {pid} not found"}), 404
        items.append({"product_id": pid, "product_name": product.name, "quantity": qty, "price": product.price})
        server_total += product.price * qty

    # Use server total regardless of client_total mismatch
    amount_in_paise = int(round(server_total * 100))

    # If COD selected, skip Razorpay and create order as 'Created' (unpaid)
    if payment_method == "cod":
        order = Order(
            razorpay_order_id=f"cod_{int(datetime.utcnow().timestamp())}",
            total=server_total,
            status="Created",
            address=address,
            customer_name=customer_name,
            customer_phone=customer_phone,
        )
        db.session.add(order)
        db.session.flush()
        for it in items:
            oi = OrderItem(
                order_id=order.id,
                product_id=it["product_id"],
                product_name=it["product_name"],
                quantity=it["quantity"],
                price=it["price"],
            )
            db.session.add(oi)
        # Initialize tracking row
        db.session.add(OrderLocation(order_id=order.id, status="Preparing"))
        db.session.commit()
        return jsonify({
            "success": True,
            "orderId": order.razorpay_order_id,
            "amount": server_total,
            "internalOrderId": order.id,
            "paymentMethod": "cod"
        })

    # Create Razorpay order (or test fallback)
    if not razorpay_client:
        if not is_test_mode():
            return jsonify({"error": "Payments disabled on server"}), 501
        # Test mode: create local order as Paid and return mock ids
        order = Order(razorpay_order_id=f"test_{int(datetime.utcnow().timestamp())}", total=server_total, status="Paid",
                      address=address, customer_name=customer_name, customer_phone=customer_phone)
        db.session.add(order)
        db.session.flush()
        for it in items:
            oi = OrderItem(
                order_id=order.id,
                product_id=it["product_id"],
                product_name=it["product_name"],
                quantity=it["quantity"],
                price=it["price"],
            )
            db.session.add(oi)
        # Initialize tracking row
        db.session.add(OrderLocation(order_id=order.id, status="Preparing"))
        db.session.commit()
        return jsonify({
            "success": True,
            "orderId": order.razorpay_order_id,
            "keyId": "TEST",
            "amount": server_total,
            "internalOrderId": order.id,
            "testMode": True
        })
    try:
        razorpay_order = razorpay_client.order.create({
            "amount": amount_in_paise,
            "currency": "INR",
            "payment_capture": 1  # auto capture (or 0 for manual)
        })
    except Exception as e:
        print("Razorpay order create error:", e)
        return jsonify({"error": "Could not create payment order"}), 500

    # Persist Order & OrderItems
    order = Order(razorpay_order_id=razorpay_order["id"], total=server_total, status="Created", address=address,
                  customer_name=customer_name, customer_phone=customer_phone)
    db.session.add(order)
    db.session.flush()  # to get order.id

    for it in items:
        oi = OrderItem(
            order_id=order.id,
            product_id=it["product_id"],
            product_name=it["product_name"],
            quantity=it["quantity"],
            price=it["price"],
        )
        db.session.add(oi)

    db.session.commit()

    return jsonify({
        "success": True,
        "orderId": razorpay_order["id"],
        "keyId": RAZORPAY_KEY_ID,
        "amount": server_total,  # INR (float)
        "internalOrderId": order.id
    })


@app.route("/api/verify-payment", methods=["POST"])
def verify_payment():
    """
    Expects:
      { razorpay_order_id, razorpay_payment_id, razorpay_signature }
    """
    data = request.get_json() or {}
    order_id = data.get("razorpay_order_id")
    payment_id = data.get("razorpay_payment_id")
    signature = data.get("razorpay_signature")

    if not (order_id and payment_id and signature):
        return jsonify({"error": "Missing parameters"}), 400

    generated_sig = hmac.new(RAZORPAY_KEY_SECRET.encode(), f"{order_id}|{payment_id}".encode(),
                             hashlib.sha256).hexdigest()

    if hmac.compare_digest(generated_sig, signature):
        # mark DB order as paid
        order = Order.query.filter_by(razorpay_order_id=order_id).first()
        if order:
            order.status = "Paid"
            order.payment_id = payment_id
            # Initialize tracking row on payment success
            try:
                existing = OrderLocation.query.filter_by(order_id=order.id).first()
            except Exception:
                existing = None
            if not existing:
                loc = OrderLocation(order_id=order.id, status="Preparing")
                db.session.add(loc)
            db.session.commit()
        return jsonify({"success": True, "message": "Payment verified"})
    else:
        return jsonify({"success": False, "error": "Invalid signature"}), 400


@app.route("/api/order-status/<string:order_id>", methods=["GET"])
def order_status(order_id):
    # Accept either internal numeric id or razorpay order id
    order = None
    if order_id.isdigit():
        order = Order.query.get(int(order_id))
    if not order:
        order = Order.query.filter_by(razorpay_order_id=order_id).first()
    if not order:
        return jsonify({"error": "Order not found"}), 404

    # Optional ownership check via name/phone (since we don't persist email on orders yet)
    try:
        provided_name = (request.args.get("name") or "").strip()
        provided_phone = (request.args.get("phone") or "").strip()

        # If client provides either identifier, require at least one to match the order
        if provided_name or provided_phone:
            name_matches = (provided_name and order.customer_name and provided_name.lower() == (order.customer_name or "").lower())
            phone_matches = (provided_phone and order.customer_phone and provided_phone == (order.customer_phone or ""))
            if not (name_matches or phone_matches):
                return jsonify({"error": "Unauthorized to view this order"}), 403
    except Exception:
        pass

    items = [
        {"product_id": it.product_id, "product_name": it.product_name, "quantity": it.quantity, "price": it.price}
        for it in order.items
    ]
    # attach location if present
    loc = OrderLocation.query.filter_by(order_id=order.id).first()
    location = None
    if loc:
        location = {
            "latitude": loc.latitude,
            "longitude": loc.longitude,
            "status": loc.status,
            "updated_at": (loc.updated_at.isoformat() if loc.updated_at else None)
        }
    return jsonify({
        "id": order.id,
        "razorpay_order_id": order.razorpay_order_id,
        "total": order.total,
        "status": order.status,
        "address": order.address,
        "customer_name": order.customer_name,
        "customer_phone": order.customer_phone,
        "payment_id": order.payment_id,
        "items": items,
        "created_at": order.created_at.isoformat(),
        "location": location
    })


@app.route("/api/order/<int:order_id>/location", methods=["GET", "POST"])
def order_location(order_id: int):
    order = Order.query.get(order_id)
    if not order:
        return jsonify({"error": "Order not found"}), 404

    if request.method == "GET":
        loc = OrderLocation.query.filter_by(order_id=order_id).first()
        if not loc:
            return jsonify({"location": None})
        return jsonify({
            "order_id": order_id,
            "latitude": loc.latitude,
            "longitude": loc.longitude,
            "status": loc.status,
            "updated_at": (loc.updated_at.isoformat() if loc.updated_at else None)
        })

    # POST - update
    data = request.get_json() or {}
    lat = data.get("latitude")
    lng = data.get("longitude")
    status = data.get("status")
    loc = OrderLocation.query.filter_by(order_id=order_id).first()
    if not loc:
        loc = OrderLocation(order_id=order_id)
        db.session.add(loc)
    if lat is not None:
        try:
            loc.latitude = float(lat)
        except Exception:
            return jsonify({"error": "Invalid latitude"}), 400
    if lng is not None:
        try:
            loc.longitude = float(lng)
        except Exception:
            return jsonify({"error": "Invalid longitude"}), 400
    if status:
        loc.status = str(status)
    db.session.commit()
    return jsonify({"success": True})


@app.route("/api/webhook", methods=["POST"])
def webhook():
    # Verify webhook signature (Razorpay sends X-Razorpay-Signature)
    if not _razorpay_available:
        return jsonify({"error": "Payments disabled on server"}), 501
    signature = request.headers.get("X-Razorpay-Signature") or request.headers.get("x-razorpay-signature")
    raw = request.data  # bytes
    if not signature or not RAZORPAY_WEBHOOK_SECRET:
        return jsonify({"error": "Missing webhook signature or secret"}), 400

    expected = hmac.new(RAZORPAY_WEBHOOK_SECRET.encode(), raw, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature):
        print("Webhook signature mismatch")
        return jsonify({"error": "Invalid signature"}), 400

    payload = request.get_json()
    event = payload.get("event")
    # Example: payment.captured
    if event == "payment.captured":
        payment = payload.get("payload", {}).get("payment", {}).get("entity", {})
        order_id = payment.get("order_id")
        if order_id:
            order = Order.query.filter_by(razorpay_order_id=order_id).first()
            if order:
                order.status = "Paid"
                order.payment_id = payment.get("id")
                try:
                    existing = OrderLocation.query.filter_by(order_id=order.id).first()
                except Exception:
                    existing = None
                if not existing:
                    loc = OrderLocation(order_id=order.id, status="Preparing")
                    db.session.add(loc)
                db.session.commit()
    elif event == "payment.failed":
        payment = payload.get("payload", {}).get("payment", {}).get("entity", {})
        order_id = payment.get("order_id")
        if order_id:
            order = Order.query.filter_by(razorpay_order_id=order_id).first()
            if order:
                order.status = "Payment Failed"
                db.session.commit()

    return jsonify({"ok": True})


# --------------------
# Run + init
# --------------------
if __name__ == "__main__":
    with app.app_context():
        db.create_all()
        seed_products()
        seed_admin()
        seed_test_users()
        port = int(os.getenv("PORT", 5000))
        print(f"\n[Server] Starting on http://localhost:{port}")
        print("[Test Credentials]")
        print("   Admin: admin@freshmarket.com / admin123")
        print("   Customer: customer@test.com / test123")
        print("   Vendor: vendor@test.com / test123")
        print("-" * 50)
        app.run(host="0.0.0.0", port=port, debug=True)
