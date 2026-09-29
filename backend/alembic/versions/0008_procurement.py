"""phase 9 procurement tables

Revision ID: 0008_procurement
Revises: 0007_inventory
Create Date: 2025-01-23 00:00:00
"""
from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "0008_procurement"
down_revision = "0007_inventory"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── suppliers ─────────────────────────────────────────────────────────
    op.create_table(
        "suppliers",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column(
            "organization_id",
            sa.BigInteger,
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("code", sa.Text, nullable=False),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("contact_name", sa.Text),
        sa.Column("email", sa.Text),
        sa.Column("phone", sa.String(30)),
        sa.Column("address", sa.Text),
        sa.Column("category", sa.String(30)),
        sa.Column("payment_terms", sa.String(20)),
        sa.Column("lead_time_days", sa.Integer),
        sa.Column("tax_id", sa.String(60)),
        sa.Column("bank_account", sa.Text),
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
        sa.UniqueConstraint("organization_id", "code", name="uq_supplier_org_code"),
    )
    op.create_index("ix_supplier_org", "suppliers", ["organization_id"])
    op.create_index("ix_supplier_code", "suppliers", ["code"])
    op.create_index("ix_supplier_category", "suppliers", ["category"])

    # ── rfqs ──────────────────────────────────────────────────────────────
    op.create_table(
        "rfqs",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column(
            "organization_id",
            sa.BigInteger,
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("rfq_number", sa.Text, unique=True, nullable=False),
        sa.Column("title", sa.Text, nullable=False),
        sa.Column("status", sa.String(20), server_default="draft", nullable=False),
        sa.Column("due_date", sa.Date),
        sa.Column("currency", sa.String(3), server_default="USD", nullable=False),
        sa.Column("notes", sa.Text),
        sa.Column(
            "created_by", sa.BigInteger, sa.ForeignKey("users.id", ondelete="SET NULL")
        ),
        sa.Column("issued_at", sa.DateTime(timezone=True)),
        sa.Column("closed_at", sa.DateTime(timezone=True)),
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
    op.create_index("ix_rfq_org", "rfqs", ["organization_id"])
    op.create_index("ix_rfq_number", "rfqs", ["rfq_number"])
    op.create_index("ix_rfq_status", "rfqs", ["status"])

    # ── rfq_lines ─────────────────────────────────────────────────────────
    op.create_table(
        "rfq_lines",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column(
            "rfq_id",
            sa.BigInteger,
            sa.ForeignKey("rfqs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "stock_item_id",
            sa.BigInteger,
            sa.ForeignKey("stock_items.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("quantity", sa.Numeric(14, 3), nullable=False),
        sa.Column("target_unit_cost", sa.Numeric(14, 2)),
        sa.Column("notes", sa.Text),
    )
    op.create_index("ix_rfq_line_rfq", "rfq_lines", ["rfq_id"])
    op.create_index("ix_rfq_line_item", "rfq_lines", ["stock_item_id"])

    # ── supplier_quotes ───────────────────────────────────────────────────
    op.create_table(
        "supplier_quotes",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column(
            "organization_id",
            sa.BigInteger,
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "rfq_id",
            sa.BigInteger,
            sa.ForeignKey("rfqs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "supplier_id",
            sa.BigInteger,
            sa.ForeignKey("suppliers.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("status", sa.String(20), server_default="received", nullable=False),
        sa.Column("currency", sa.String(3), server_default="USD", nullable=False),
        sa.Column("subtotal", sa.Numeric(14, 2), server_default="0", nullable=False),
        sa.Column("tax_amount", sa.Numeric(14, 2), server_default="0", nullable=False),
        sa.Column("total_amount", sa.Numeric(14, 2), server_default="0", nullable=False),
        sa.Column("lead_time_days", sa.Integer),
        sa.Column("valid_until", sa.Date),
        sa.Column("notes", sa.Text),
        sa.Column(
            "received_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "purchase_order_id",
            sa.BigInteger,
            sa.ForeignKey("purchase_orders.id", ondelete="SET NULL"),
        ),
        sa.Column("decided_at", sa.DateTime(timezone=True)),
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
        sa.UniqueConstraint("rfq_id", "supplier_id", name="uq_quote_rfq_supplier"),
    )
    op.create_index("ix_quote_org", "supplier_quotes", ["organization_id"])
    op.create_index("ix_quote_rfq", "supplier_quotes", ["rfq_id"])
    op.create_index("ix_quote_supplier", "supplier_quotes", ["supplier_id"])
    op.create_index("ix_quote_status", "supplier_quotes", ["status"])
    op.create_index("ix_quote_po", "supplier_quotes", ["purchase_order_id"])

    # ── supplier_quote_lines ──────────────────────────────────────────────
    op.create_table(
        "supplier_quote_lines",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column(
            "quote_id",
            sa.BigInteger,
            sa.ForeignKey("supplier_quotes.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "rfq_line_id",
            sa.BigInteger,
            sa.ForeignKey("rfq_lines.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("quantity", sa.Numeric(14, 3), nullable=False),
        sa.Column("unit_cost", sa.Numeric(14, 2), nullable=False),
        sa.Column("line_total", sa.Numeric(14, 2), server_default="0", nullable=False),
        sa.Column("notes", sa.Text),
    )
    op.create_index("ix_quote_line_quote", "supplier_quote_lines", ["quote_id"])
    op.create_index("ix_quote_line_rfq_line", "supplier_quote_lines", ["rfq_line_id"])

    # ── purchase_order_approvals ──────────────────────────────────────────
    op.create_table(
        "purchase_order_approvals",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column(
            "purchase_order_id",
            sa.BigInteger,
            sa.ForeignKey("purchase_orders.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("sequence", sa.Integer, nullable=False),
        sa.Column(
            "approver_id",
            sa.BigInteger,
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("status", sa.String(20), server_default="pending", nullable=False),
        sa.Column("decided_at", sa.DateTime(timezone=True)),
        sa.Column("comments", sa.Text),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint(
            "purchase_order_id", "sequence", name="uq_po_approval_seq"
        ),
    )
    op.create_index("ix_po_approval_po", "purchase_order_approvals", ["purchase_order_id"])
    op.create_index("ix_po_approval_approver", "purchase_order_approvals", ["approver_id"])
    op.create_index("ix_po_approval_status", "purchase_order_approvals", ["status"])


def downgrade() -> None:
    op.drop_index("ix_po_approval_status", table_name="purchase_order_approvals")
    op.drop_index("ix_po_approval_approver", table_name="purchase_order_approvals")
    op.drop_index("ix_po_approval_po", table_name="purchase_order_approvals")
    op.drop_table("purchase_order_approvals")
    op.drop_index("ix_quote_line_rfq_line", table_name="supplier_quote_lines")
    op.drop_index("ix_quote_line_quote", table_name="supplier_quote_lines")
    op.drop_table("supplier_quote_lines")
    op.drop_index("ix_quote_po", table_name="supplier_quotes")
    op.drop_index("ix_quote_status", table_name="supplier_quotes")
    op.drop_index("ix_quote_supplier", table_name="supplier_quotes")
    op.drop_index("ix_quote_rfq", table_name="supplier_quotes")
    op.drop_index("ix_quote_org", table_name="supplier_quotes")
    op.drop_table("supplier_quotes")
    op.drop_index("ix_rfq_line_item", table_name="rfq_lines")
    op.drop_index("ix_rfq_line_rfq", table_name="rfq_lines")
    op.drop_table("rfq_lines")
    op.drop_index("ix_rfq_status", table_name="rfqs")
    op.drop_index("ix_rfq_number", table_name="rfqs")
    op.drop_index("ix_rfq_org", table_name="rfqs")
    op.drop_table("rfqs")
    op.drop_index("ix_supplier_category", table_name="suppliers")
    op.drop_index("ix_supplier_code", table_name="suppliers")
    op.drop_index("ix_supplier_org", table_name="suppliers")
    op.drop_table("suppliers")
