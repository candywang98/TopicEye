from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User, UserRole
from app.repositories.app_setting_repo import AppSettingRepository
from app.repositories.user_repo import UserRepository

LOCAL_WORKSPACE_EMAIL = "admin@topiceye.local"
LOCAL_WORKSPACE_DISPLAY_NAME = "本地工作区"


async def get_local_workspace_user(db: AsyncSession) -> User:
    """Return the startup-seeded local identity without mutating request state."""
    user = await UserRepository(db).get_by_email(LOCAL_WORKSPACE_EMAIL)
    if user is None or not user.is_active:
        raise RuntimeError("Local workspace identity is not initialized")
    return user


async def ensure_local_workspace(db: AsyncSession) -> User:
    """Create or repair the persistent identity used by local no-login mode."""
    repo = UserRepository(db)
    user = await repo.get_by_email(LOCAL_WORKSPACE_EMAIL)
    if user is None:
        user = await repo.create(
            email=LOCAL_WORKSPACE_EMAIL,
            password_hash=None,
            display_name=LOCAL_WORKSPACE_DISPLAY_NAME,
            plan="pro",
            role=UserRole.ADMIN.value,
            is_active=True,
        )
    else:
        changed = False
        required_values = {
            "password_hash": None,
            "plan": "pro",
            "role": UserRole.ADMIN.value,
            "is_active": True,
        }
        for field, value in required_values.items():
            if getattr(user, field) != value:
                setattr(user, field, value)
                changed = True
        if not user.display_name:
            user.display_name = LOCAL_WORKSPACE_DISPLAY_NAME
            changed = True
        if changed:
            user.updated_at = datetime.now(UTC)
            await db.flush()
            await db.refresh(user)

    await AppSettingRepository(db).upsert_feature_flags({"webnovel_module": True})
    return user
