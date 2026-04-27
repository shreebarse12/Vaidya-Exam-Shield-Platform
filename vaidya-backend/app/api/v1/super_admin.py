"""
Super Admin routes — only accessible by role = super_admin.
Manages institutes (tenants), platform-wide stats, audit logs.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional

from app.db.session import get_db
from app.dependencies import require_super_admin
from app.models.tenant import Tenant
from app.models.user import User
from app.models.subscription import Subscription

router = APIRouter()


# ── Platform Dashboard ─────────────────────────────────────────────────────────
@router.get("/dashboard", summary="Platform-wide stats")
async def platform_dashboard(
    db: AsyncSession = Depends(get_db),
    _=Depends(require_super_admin),
):
    """
    The Super Admin home screen — shows:
    - Total active institutes
    - Total students on platform
    - Active subscriptions by tier
    """
    # Total institutes
    tenants_result = await db.execute(
        select(func.count(Tenant.id)).where(Tenant.status == "active")
    )
    total_institutes = tenants_result.scalar()

    # Total students
    students_result = await db.execute(
        select(func.count(User.id)).where(User.role == "student", User.is_active == True)
    )
    total_students = students_result.scalar()

    # Total faculty
    faculty_result = await db.execute(
        select(func.count(User.id)).where(User.role == "faculty", User.is_active == True)
    )
    total_faculty = faculty_result.scalar()

    # Subscriptions by plan
    subs_result = await db.execute(
        select(Subscription.plan_id, func.count(Subscription.id))
        .where(Subscription.status == "active")
        .group_by(Subscription.plan_id)
    )
    subscriptions_by_plan = {row[0]: row[1] for row in subs_result.fetchall()}

    return {
        "total_active_institutes": total_institutes,
        "total_students": total_students,
        "total_faculty": total_faculty,
        "subscriptions_by_plan": subscriptions_by_plan,
    }


# ── Tenant (Institute) Management ─────────────────────────────────────────────
@router.get("/tenants", summary="List all institutes")
async def list_tenants(
    status: Optional[str] = Query(None, description="Filter by: active | pending | suspended"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_super_admin),
):
    query = select(Tenant)
    if status:
        query = query.where(Tenant.status == status)

    query = query.order_by(Tenant.created_at.desc())
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)

    result = await db.execute(query)
    tenants = result.scalars().all()

    return [_tenant_to_dict(t) for t in tenants]


@router.get("/tenants/{tenant_id}", summary="Get institute details")
async def get_tenant(
    tenant_id: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_super_admin),
):
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Institute not found.")

    # Count users for this tenant
    users_result = await db.execute(
        select(func.count(User.id)).where(User.tenant_id == tenant_id)
    )
    user_count = users_result.scalar()

    data = _tenant_to_dict(tenant)
    data["total_users"] = user_count
    return data


@router.patch("/tenants/{tenant_id}/status", summary="Suspend or activate an institute")
async def update_tenant_status(
    tenant_id: str,
    status: str = Query(..., description="active | suspended | deleted"),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_super_admin),
):
    """
    Suspend = revoke access immediately but keep data.
    Delete = mark as deleted (data retained per retention policy).
    """
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Institute not found.")

    if status not in ("active", "suspended", "deleted"):
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Status must be active | suspended | deleted")

    tenant.status = status

    # If suspending, also deactivate the admin account
    if status == "suspended":
        admin_result = await db.execute(
            select(User).where(
                User.tenant_id == tenant_id,
                User.role == "institute_admin",
            )
        )
        for admin in admin_result.scalars().all():
            admin.is_active = False

    return {"message": f"Institute status updated to '{status}'.", "tenant_id": tenant_id}


@router.post("/tenants/{tenant_id}/approve", summary="Approve a pending institute registration")
async def approve_tenant(
    tenant_id: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_super_admin),
):
    """
    When an Institute Admin registers, the tenant is created with status='pending'.
    Super Admin reviews and approves → status becomes 'active'.
    """
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Institute not found.")

    tenant.status = "active"

    # Also activate the admin user
    admin_result = await db.execute(
        select(User).where(
            User.tenant_id == tenant_id,
            User.role == "institute_admin",
        )
    )
    for admin in admin_result.scalars().all():
        admin.is_active = True

    # TODO: Send welcome email to admin (via Celery task)
    # from app.tasks.email_tasks import send_welcome_email
    # send_welcome_email.delay(admin.email, admin.full_name, tenant.name)

    return {"message": f"Institute '{tenant.name}' approved successfully."}


# ── User Management ────────────────────────────────────────────────────────────
@router.get("/users", summary="List all users on the platform")
async def list_all_users(
    role: Optional[str] = Query(None),
    tenant_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_super_admin),
):
    query = select(User)
    if role:
        query = query.where(User.role == role)
    if tenant_id:
        query = query.where(User.tenant_id == tenant_id)

    offset = (page - 1) * page_size
    query = query.order_by(User.created_at.desc()).offset(offset).limit(page_size)

    result = await db.execute(query)
    users = result.scalars().all()

    return [
        {
            "id": str(u.id),
            "email": u.email,
            "full_name": u.full_name,
            "role": u.role,
            "tenant_id": str(u.tenant_id) if u.tenant_id else None,
            "is_active": u.is_active,
            "last_login": u.last_login,
            "created_at": u.created_at,
        }
        for u in users
    ]


# ── Helper ─────────────────────────────────────────────────────────────────────
def _tenant_to_dict(t: Tenant) -> dict:
    return {
        "id": str(t.id),
        "name": t.name,
        "subdomain": t.subdomain,
        "subscription_tier": t.subscription_tier,
        "status": t.status,
        "contact_email": t.contact_email,
        "gstin": t.gstin,
        "created_at": t.created_at,
    }