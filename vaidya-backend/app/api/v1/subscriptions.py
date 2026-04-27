from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.dependencies import get_current_user
from app.services import payment_service

router = APIRouter()


@router.get("/plans", summary="List all available subscription plans")
async def list_plans():
    return {
        "plans": [
            {"id": "b2c_free",       "name": "B2C Free",        "price_monthly": 0,       "students": 1},
            {"id": "b2c_premium",    "name": "B2C Premium",     "price_monthly": 299,     "students": 1},
            {"id": "b2b_starter",    "name": "B2B Starter",     "price_monthly": 2999,    "students": 200},
            {"id": "b2b_enterprise", "name": "B2B Enterprise",  "price_monthly": "Custom","students": "Unlimited"},
        ]
    }


@router.post("/create-order", summary="Create Razorpay payment order")
async def create_order(
    plan_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Step 1 of checkout: creates a Razorpay order.
    Frontend uses the returned order_id to open Razorpay checkout popup.
    """
    return await payment_service.create_order(plan_id, current_user, db)


@router.post("/webhook", summary="Razorpay payment webhook (called by Razorpay)")
async def payment_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Razorpay calls this after a payment is captured.
    No auth header — verified via HMAC signature instead.
    """
    return await payment_service.handle_webhook(request, db)