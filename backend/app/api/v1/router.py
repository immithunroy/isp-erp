from fastapi import APIRouter

from app.api.v1 import audit, auth, health, hrm, mobile, organizations, roles, settings, users

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
# HRM
api_router.include_router(hrm.designations_router)
api_router.include_router(hrm.employees_router)
api_router.include_router(hrm.shifts_router)
api_router.include_router(hrm.holidays_router)
api_router.include_router(hrm.leave_types_router)
api_router.include_router(hrm.leave_balances_router)
api_router.include_router(hrm.leave_requests_router)
api_router.include_router(hrm.attendance_router)
# Mobile
api_router.include_router(mobile.router)
