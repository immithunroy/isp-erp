from fastapi import APIRouter

from app.api.v1 import (
    audit,
    auth,
    customers,
    health,
    hrm,
    mobile,
    network,
    organizations,
    roles,
    settings,
    trace,
    users,
)

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
# Customers + Field Service
api_router.include_router(customers.customers_router)
api_router.include_router(customers.customer_locations_router)
api_router.include_router(customers.customer_visits_router)
api_router.include_router(customers.work_orders_router)
api_router.include_router(customers.work_order_events_router)
# Network GIS
api_router.include_router(network.assets_router)
api_router.include_router(network.fiber_router)
api_router.include_router(network.fiber_cores_router)
api_router.include_router(network.splices_router)
api_router.include_router(network.splitter_ports_router)
api_router.include_router(network.customer_links_router)
api_router.include_router(network.map_router)
# Network Trace
api_router.include_router(trace.router)
