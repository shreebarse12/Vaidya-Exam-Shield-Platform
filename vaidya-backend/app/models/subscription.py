import uuid
from typing import Optional
from datetime import date, datetime
from decimal import Decimal
from sqlalchemy import String, Boolean, Date, DateTime, Numeric, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from app.models.base import UUIDMixin, TimestampMixin
from app.db.session import Base


class Subscription(UUIDMixin, TimestampMixin, Base):
    """
    One active subscription per tenant (B2B) or user (B2C).
    status lifecycle: trial → active → past_due → suspended → cancelled
    """
    __tablename__ = "subscriptions"

    # Either tenant_id (B2B) or user_id (B2C) will be set
    tenant_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=True, index=True
    )
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True
    )

    # b2c_free | b2c_premium | b2b_starter | b2b_enterprise
    plan_id: Mapped[str] = mapped_column(String(50), nullable=False)

    # active | trial | past_due | suspended | cancelled
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="trial")

    start_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    end_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    trial_end_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    auto_renew: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Razorpay subscription ID for recurring billing
    razorpay_subscription_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    razorpay_customer_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)


class Invoice(UUIDMixin, TimestampMixin, Base):
    """One invoice per billing cycle."""
    __tablename__ = "invoices"

    subscription_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("subscriptions.id", ondelete="CASCADE"), nullable=False
    )
    # INV-2026-04-0001
    invoice_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)

    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    tax_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)

    # paid | pending | failed
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")

    razorpay_payment_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    pdf_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    paid_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Institute billing details (captured at invoice time for legal/GST)
    gstin: Mapped[Optional[str]] = mapped_column(String(15), nullable=True)
    billing_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    billing_address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)