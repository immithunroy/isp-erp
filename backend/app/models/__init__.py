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
from app.models.inventory import (
    PurchaseOrder,
    PurchaseOrderLine,
    StockItem,
    StockLevel,
    StockMovement,
    Warehouse,
)
from app.models.mobile import GpsRecord, SyncQueue
from app.models.network import (
    CustomerNetworkLink,
    FiberCable,
    FiberCore,
    NetworkAsset,
    Splice,
    SplitterPort,
)
from app.models.procurement import (
    PurchaseOrderApproval,
    Rfq,
    RfqLine,
    Supplier,
    SupplierQuote,
    SupplierQuoteLine,
)

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
    # network gis
    "NetworkAsset",
    "FiberCable",
    "FiberCore",
    "Splice",
    "SplitterPort",
    "CustomerNetworkLink",
    # inventory
    "Warehouse",
    "StockItem",
    "StockLevel",
    "StockMovement",
    "PurchaseOrder",
    "PurchaseOrderLine",
    # procurement
    "Supplier",
    "Rfq",
    "RfqLine",
    "SupplierQuote",
    "SupplierQuoteLine",
    "PurchaseOrderApproval",
]
