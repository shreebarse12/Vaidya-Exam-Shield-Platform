"""
Payment Service — Razorpay Integration.

Flow:
1. Frontend calls POST /subscriptions/create-order → we create a Razorpay order
2. Frontend shows Razorpay checkout popup
3. User pays → Razorpay sends webhook to POST /subscriptions/webhook
4. We verify webhook signature → activate subscription → generate invoice
"""

import hashlib
import hmac
import json
from datetime import date, timedelta, datetime, timezone
from decimal import Decimal

import razorpay
from fastapi import HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.config import settings
from app.models.subscription import Subscription, Invoice
from app.models.tenant import Tenant
from app.models.user import User

# Razorpay plan pricing (in paisa — 1 INR = 100 paisa)
PLANS = {
    "b2c_free":       {"price": 0,         "gst_rate": 0.18, "students": 1},
    "b2c_premium":    {"price": 29900,     "gst_rate": 0.18, "students": 1},
    "b2b_starter":    {"price": 299900,    "gst_rate": 0.18, "students": 200},
    "b2b_enterprise": {"price": 2500000,   "gst_rate": 0.18, "students": -1},  # -1 = unlimited
}

razorpay_client = razorpay.Client(
    auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET)
)


async def create_order(plan_id: str, current_user: User, db: AsyncSession) -> dict:
    """Create a Razorpay order for the selected plan."""
    plan = PLANS.get(plan_id)
    if not plan:
        raise HTTPException(status_code=400, detail=f"Invalid plan: {plan_id}")

    if plan["price"] == 0:
        # Free plan — activate directly without payment
        return await activate_free_plan(plan_id, current_user, db)

    amount = plan["price"]
    order = razorpay_client.order.create({
        "amount": amount,
        "currency": "INR",
        "receipt": f"order_{current_user.id}_{plan_id}",
        "notes": {
            "plan_id": plan_id,
            "user_id": str(current_user.id),
            "tenant_id": str(current_user.tenant_id) if current_user.tenant_id else "",
        },
    })

    return {
        "order_id": order["id"],
        "amount": amount,
        "currency": "INR",
        "razorpay_key": settings.RAZORPAY_KEY_ID,
        "plan_id": plan_id,
    }


async def activate_free_plan(plan_id: str, user: User, db: AsyncSession) -> dict:
    """Activate a free plan without going through Razorpay."""
    subscription = Subscription(
        tenant_id=user.tenant_id,
        user_id=user.id if not user.tenant_id else None,
        plan_id=plan_id,
        status="active",
        start_date=date.today(),
        end_date=None,  # Free plans don't expire
        auto_renew=False,
    )
    db.add(subscription)
    await db.flush()
    return {"message": "Free plan activated successfully.", "subscription_id": str(subscription.id)}


async def handle_webhook(request: Request, db: AsyncSession) -> dict:
    """
    Handle Razorpay payment webhook.
    Called by Razorpay after successful payment.

    Security: Verify HMAC signature before processing.
    Without this, anyone could fake a payment webhook.
    """
    body = await request.body()
    signature = request.headers.get("x-razorpay-signature", "")

    # Verify webhook signature
    expected = hmac.new(
        settings.RAZORPAY_KEY_SECRET.encode(),
        body,
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(expected, signature):
        raise HTTPException(status_code=400, detail="Invalid webhook signature.")

    payload = json.loads(body)
    event = payload.get("event")

    if event == "payment.captured":
        payment = payload["payload"]["payment"]["entity"]
        notes = payment.get("notes", {})

        plan_id = notes.get("plan_id")
        user_id = notes.get("user_id")
        tenant_id = notes.get("tenant_id") or None

        if not plan_id:
            return {"status": "ignored"}

        # Activate subscription
        plan = PLANS.get(plan_id, {})
        subscription = Subscription(
            tenant_id=tenant_id,
            user_id=user_id if not tenant_id else None,
            plan_id=plan_id,
            status="active",
            start_date=date.today(),
            end_date=date.today() + timedelta(days=30),
            razorpay_payment_id=payment["id"],
            auto_renew=True,
        )
        db.add(subscription)
        await db.flush()

        # Generate invoice
        amount_paisa = payment["amount"]
        amount_inr = Decimal(amount_paisa) / 100
        gst_rate = Decimal(str(plan.get("gst_rate", 0.18)))
        gst_amount = amount_inr * gst_rate / (1 + gst_rate)
        base_amount = amount_inr - gst_amount

        from datetime import date as d
        invoice_number = f"INV-{d.today().strftime('%Y-%m')}-{payment['id'][-6:]}"

        invoice = Invoice(
            subscription_id=subscription.id,
            invoice_number=invoice_number,
            amount=base_amount.quantize(Decimal("0.01")),
            tax_amount=gst_amount.quantize(Decimal("0.01")),
            total_amount=amount_inr.quantize(Decimal("0.01")),
            status="paid",
            razorpay_payment_id=payment["id"],
            paid_at=datetime.now(timezone.utc),
        )
        db.add(invoice)

    return {"status": "processed"}