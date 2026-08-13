from fastapi import APIRouter

from app.api.v1 import audit, auth, health, organizations, roles, settings, users

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(organizations.router)
api_router.include_router(organizations.branch_router)
api_router.include_router(organizations.dept_router)
api_router.include_router(roles.roles_router)
api_router.include_router(roles.perms_router)
api_router.include_router(audit.router)
api_router.include_router(settings.router)
