from app.models.core import (
    AuditLog,
    Branch,
    Department,
    Organization,
    Permission,
    RefreshToken,
    Role,
    RolePermission,
    SystemSetting,
    User,
)
from app.models.customers import (
    Customer,
    CustomerLocation,
    CustomerVisit,
    WorkOrder,
    WorkOrderEvent,
)
from app.models.hrm import (
    Attendance,
    AttendanceCorrection,
    Designation,
    Employee,
    EmployeeShift,
    Holiday,
    LeaveBalance,
    LeaveRequest,
    LeaveType,
    Shift,
)
from app.models.mobile import GpsRecord, SyncQueue

__all__ = [
    # core
    "AuditLog",
    "Branch",
    "Department",
    "Organization",
    "Permission",
    "RefreshToken",
    "Role",
    "RolePermission",
    "SystemSetting",
    "User",
    # hrm
    "Attendance",
    "AttendanceCorrection",
    "Designation",
    "Employee",
    "EmployeeShift",
    "Holiday",
    "LeaveBalance",
    "LeaveRequest",
    "LeaveType",
    "Shift",
    # mobile
    "GpsRecord",
    "SyncQueue",
    # customers + field service
    "Customer",
    "CustomerLocation",
    "CustomerVisit",
    "WorkOrder",
    "WorkOrderEvent",
]
