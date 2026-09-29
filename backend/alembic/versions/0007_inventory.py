"""phase 8 inventory tables

Revision ID: 0007_inventory
Revises: 0006_fix_ip_columns
Create Date: 2025-01-22 00:00:00
"""
from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "0007_inventory"
down_revision = "0006_fix_ip_columns"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── warehouses ────────────────────────────────────────────────────────
    op.create_table(
        "warehouses",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column(
            "organization_id",
            sa.BigInteger,
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("code", sa.Text, nullable=False),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("address", sa.Text),
        sa.Column("latitude", sa.Float),
        sa.Column("longitude", sa.Float),
        sa.Column(
            "manager_id",
            sa.BigInteger,
            sa.ForeignKey("employees.id", ondelete="SET NULL"),
        ),
        sa.Column("is_active", sa.Boolean, server_default="true", nullable=False),
        sa.Column("notes", sa.Text),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint("organization_id", "code", name="uq_warehouse_org_code"),
    )
    op.create_index("ix_warehouse_org", "warehouses", ["organization_id"])
    op.create_index("ix_warehouse_code", "warehouses", ["code"])

    # ── stock_items ───────────────────────────────────────────────────────
    op.create_table(
        "stock_items",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column(
            "organization_id",
            sa.BigInteger,
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("sku", sa.Text, nullable=False),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("category", sa.String(50)),
        sa.Column("unit", sa.String(20), server_default="pcs", nullable=False),
        sa.Column("unit_cost", sa.Numeric(14, 2)),
        sa.Column("reorder_level", sa.Numeric(14, 3), server_default="0", nullable=False),
        sa.Column("asset_class", sa.String(30)),
        sa.Column("is_active", sa.Boolean, server_default="true", nullable=False),
        sa.Column("notes", sa.Text),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint("organization_id", "sku", name="uq_stock_item_org_sku"),
    )
    op.create_index("ix_stock_item_org", "stock_items", ["organization_id"])
    op.create_index("ix_stock_item_sku", "stock_items", ["sku"])
    op.create_index("ix_stock_item_category", "stock_items", ["category"])

    # ── stock_levels ──────────────────────────────────────────────────────
    op.create_table(
        "stock_levels",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column(
            "warehouse_id",
            sa.BigInteger,
            sa.ForeignKey("warehouses.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "item_id",
            sa.BigInteger,
            sa.ForeignKey("stock_items.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("quantity", sa.Numeric(14, 3), server_default="0", nullable=False),
        sa.Column(
            "reserved_quantity", sa.Numeric(14, 3), server_default="0", nullable=False
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint("warehouse_id", "item_id", name="uq_stock_level_wh_item"),
    )
    op.create_index("ix_stock_level_wh", "stock_levels", ["warehouse_id"])
    op.create_index("ix_stock_level_item", "stock_levels", ["item_id"])

    # ── stock_movements ───────────────────────────────────────────────────
    op.create_table(
        "stock_movements",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column(
            "organization_id",
            sa.BigInteger,
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("movement_type", sa.String(20), nullable=False),
        sa.Column(
            "item_id",
            sa.BigInteger,
            sa.ForeignKey("stock_items.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "warehouse_id",
            sa.BigInteger,
            sa.ForeignKey("warehouses.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "to_warehouse_id",
            sa.BigInteger,
            sa.ForeignKey("warehouses.id", ondelete="SET NULL"),
        ),
        sa.Column("quantity", sa.Numeric(14, 3), nullable=False),
        sa.Column("signed_delta", sa.Numeric(14, 3), nullable=False),
        sa.Column("balance_after", sa.Numeric(14, 3)),
        sa.Column(
            "network_asset_id",
            sa.BigInteger,
            sa.ForeignKey("network_assets.id", ondelete="SET NULL"),
        ),
        sa.Column(
            "work_order_id",
            sa.BigInteger,
            sa.ForeignKey("work_orders.id", ondelete="SET NULL"),
        ),
        sa.Column("reference_type", sa.String(30)),
        sa.Column("reference_id", sa.BigInteger),
        sa.Column("reason", sa.Text),
        sa.Column(
            "moved_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "created_by",
            sa.BigInteger,
            sa.ForeignKey("users.id", ondelete="SET NULL"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_stock_move_org", "stock_movements", ["organization_id"])
    op.create_index("ix_stock_move_item", "stock_movements", ["item_id"])
    op.create_index("ix_stock_move_wh", "stock_movements", ["warehouse_id"])
    op.create_index("ix_stock_move_type", "stock_movements", ["movement_type"])
    op.create_index("ix_stock_move_asset", "stock_movements", ["network_asset_id"])
    op.create_index("ix_stock_move_ref", "stock_movements", ["reference_type", "reference_id"])
    op.create_index("ix_stock_move_moved", "stock_movements", ["moved_at"])

    # ── purchase_orders ───────────────────────────────────────────────────
    op.create_table(
        "purchase_orders",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column(
            "organization_id",
            sa.BigInteger,
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("po_number", sa.Text, unique=True, nullable=False),
        sa.Column("supplier_name", sa.Text, nullable=False),
        sa.Column("supplier_contact", sa.Text),
        sa.Column("supplier_email", sa.Text),
        sa.Column("status", sa.String(20), server_default="draft", nullable=False),
        sa.Column(
            "warehouse_id",
            sa.BigInteger,
            sa.ForeignKey("warehouses.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("order_date", sa.Date, server_default=sa.text("CURRENT_DATE"), nullable=False),
        sa.Column("expected_date", sa.Date),
        sa.Column("currency", sa.String(3), server_default="USD", nullable=False),
        sa.Column("subtotal", sa.Numeric(14, 2), server_default="0", nullable=False),
        sa.Column("tax_amount", sa.Numeric(14, 2), server_default="0", nullable=False),
        sa.Column("total_amount", sa.Numeric(14, 2), server_default="0", nullable=False),
        sa.Column("notes", sa.Text),
        sa.Column(
            "created_by", sa.BigInteger, sa.ForeignKey("users.id", ondelete="SET NULL")
        ),
        sa.Column(
            "approved_by", sa.BigInteger, sa.ForeignKey("users.id", ondelete="SET NULL")
        ),
        sa.Column("approved_at", sa.DateTime(timezone=True)),
        sa.Column("received_at", sa.DateTime(timezone=True)),
        sa.Column("cancelled_at", sa.DateTime(timezone=True)),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_po_org", "purchase_orders", ["organization_id"])
    op.create_index("ix_po_number", "purchase_orders", ["po_number"])
    op.create_index("ix_po_status", "purchase_orders", ["status"])
    op.create_index("ix_po_warehouse", "purchase_orders", ["warehouse_id"])
    op.create_index("ix_po_supplier", "purchase_orders", ["supplier_name"])

    # ── purchase_order_lines ──────────────────────────────────────────────
    op.create_table(
        "purchase_order_lines",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column(
            "purchase_order_id",
            sa.BigInteger,
            sa.ForeignKey("purchase_orders.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "item_id",
            sa.BigInteger,
            sa.ForeignKey("stock_items.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("quantity", sa.Numeric(14, 3), nullable=False),
        sa.Column(
            "received_quantity", sa.Numeric(14, 3), server_default="0", nullable=False
        ),
        sa.Column("unit_cost", sa.Numeric(14, 2), server_default="0", nullable=False),
        sa.Column("line_total", sa.Numeric(14, 2), server_default="0", nullable=False),
        sa.Column("notes", sa.Text),
    )
    op.create_index("ix_po_line_po", "purchase_order_lines", ["purchase_order_id"])
    op.create_index("ix_po_line_item", "purchase_order_lines", ["item_id"])


def downgrade() -> None:
    op.drop_index("ix_po_line_item", table_name="purchase_order_lines")
    op.drop_index("ix_po_line_po", table_name="purchase_order_lines")
    op.drop_table("purchase_order_lines")
    op.drop_index("ix_po_supplier", table_name="purchase_orders")
    op.drop_index("ix_po_warehouse", table_name="purchase_orders")
    op.drop_index("ix_po_status", table_name="purchase_orders")
    op.drop_index("ix_po_number", table_name="purchase_orders")
    op.drop_index("ix_po_org", table_name="purchase_orders")
    op.drop_table("purchase_orders")
    op.drop_index("ix_stock_move_moved", table_name="stock_movements")
    op.drop_index("ix_stock_move_ref", table_name="stock_movements")
    op.drop_index("ix_stock_move_asset", table_name="stock_movements")
    op.drop_index("ix_stock_move_type", table_name="stock_movements")
    op.drop_index("ix_stock_move_wh", table_name="stock_movements")
    op.drop_index("ix_stock_move_item", table_name="stock_movements")
    op.drop_index("ix_stock_move_org", table_name="stock_movements")
    op.drop_table("stock_movements")
    op.drop_index("ix_stock_level_item", table_name="stock_levels")
    op.drop_index("ix_stock_level_wh", table_name="stock_levels")
    op.drop_table("stock_levels")
    op.drop_index("ix_stock_item_category", table_name="stock_items")
    op.drop_index("ix_stock_item_sku", table_name="stock_items")
    op.drop_index("ix_stock_item_org", table_name="stock_items")
    op.drop_table("stock_items")
    op.drop_index("ix_warehouse_code", table_name="warehouses")
    op.drop_index("ix_warehouse_org", table_name="warehouses")
    op.drop_table("warehouses")
