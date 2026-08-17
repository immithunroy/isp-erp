"""phase 6 network gis tables

Revision ID: 0005_network
Revises: 0004_customers
Create Date: 2025-01-20 00:00:00
"""
from __future__ import annotations

import geoalchemy2 as ga2
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0005_network"
down_revision = "0004_customers"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── network_assets (point assets: olt, pop, odf, tj_box, enclosure, etc.) ──
    op.create_table(
        "network_assets",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column(
            "organization_id",
            sa.BigInteger,
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("asset_code", sa.Text, unique=True, nullable=False),
        sa.Column("asset_type", sa.String(30), nullable=False),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("status", sa.String(20), server_default="active", nullable=False),
        sa.Column("latitude", sa.Float),
        sa.Column("longitude", sa.Float),
        sa.Column("gps_accuracy", sa.Numeric(6, 2)),
        # PostGIS geometry column — only on PostgreSQL
        sa.Column(
            "geog",
            ga2.Geometry("POINT", srid=4326),
            nullable=True,
        ),
        sa.Column("installed_at", sa.Date),
        sa.Column("owner", sa.Text),
        sa.Column(
            "department_id",
            sa.BigInteger,
            sa.ForeignKey("departments.id", ondelete="SET NULL"),
        ),
        sa.Column(
            "parent_asset_id",
            sa.BigInteger,
            sa.ForeignKey("network_assets.id", ondelete="SET NULL"),
        ),
        sa.Column("capacity", sa.Integer),
        sa.Column("photos", postgresql.JSONB),
        sa.Column("documents", postgresql.JSONB),
        sa.Column("notes", sa.Text),
        sa.Column("is_active", sa.Boolean, server_default="true", nullable=False),
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
    op.create_index("ix_net_assets_org", "network_assets", ["organization_id"])
    op.create_index("ix_net_assets_type", "network_assets", ["asset_type"])
    op.create_index("ix_net_assets_status", "network_assets", ["status"])
    op.create_index("ix_net_assets_parent", "network_assets", ["parent_asset_id"])
    # GiST spatial index on geog
    op.execute(
        "CREATE INDEX ix_net_assets_geog ON network_assets USING GIST (geog);"
    )

    # ── fiber_cables ─────────────────────────────────────────────────────
    op.create_table(
        "fiber_cables",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column(
            "organization_id",
            sa.BigInteger,
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("cable_code", sa.Text, unique=True, nullable=False),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("cable_type", sa.String(50)),
        sa.Column("core_count", sa.Integer, nullable=False),
        sa.Column(
            "start_asset_id",
            sa.BigInteger,
            sa.ForeignKey("network_assets.id", ondelete="SET NULL"),
        ),
        sa.Column(
            "end_asset_id",
            sa.BigInteger,
            sa.ForeignKey("network_assets.id", ondelete="SET NULL"),
        ),
        # Route geometry as GeoJSON in JSON for portability
        sa.Column("route_geojson", postgresql.JSONB),
        # PostGIS LineString geometry column
        sa.Column(
            "route_geog",
            ga2.Geometry("LINESTRING", srid=4326),
            nullable=True,
        ),
        sa.Column("length_m", sa.Numeric(10, 2)),
        sa.Column("installed_at", sa.Date),
        sa.Column("status", sa.String(20), server_default="active", nullable=False),
        sa.Column("owner", sa.Text),
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
    )
    op.create_index("ix_fiber_org", "fiber_cables", ["organization_id"])
    op.create_index("ix_fiber_code", "fiber_cables", ["cable_code"])
    op.create_index("ix_fiber_start", "fiber_cables", ["start_asset_id"])
    op.create_index("ix_fiber_end", "fiber_cables", ["end_asset_id"])
    op.execute(
        "CREATE INDEX ix_fiber_route ON fiber_cables USING GIST (route_geog);"
    )

    # ── fiber_cores ───────────────────────────────────────────────────────
    op.create_table(
        "fiber_cores",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column(
            "cable_id",
            sa.BigInteger,
            sa.ForeignKey("fiber_cables.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("core_number", sa.Integer, nullable=False),
        sa.Column("color", sa.String(50)),
        sa.Column("status", sa.String(20), server_default="available", nullable=False),
        sa.Column(
            "source_asset_id",
            sa.BigInteger,
            sa.ForeignKey("network_assets.id", ondelete="SET NULL"),
        ),
        sa.Column(
            "destination_asset_id",
            sa.BigInteger,
            sa.ForeignKey("network_assets.id", ondelete="SET NULL"),
        ),
        sa.Column(
            "related_customer_id",
            sa.BigInteger,
            sa.ForeignKey("customers.id", ondelete="SET NULL"),
        ),
        sa.Column("notes", sa.Text),
        sa.UniqueConstraint("cable_id", "core_number", name="uq_fiber_core_cable_num"),
    )
    op.create_index("ix_fiber_core_cable", "fiber_cores", ["cable_id"])
    op.create_index("ix_fiber_core_status", "fiber_cores", ["status"])

    # ── splices ─────────────────────────────────────────────────────────
    op.create_table(
        "splices",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column(
            "enclosure_asset_id",
            sa.BigInteger,
            sa.ForeignKey("network_assets.id", ondelete="SET NULL"),
        ),
        sa.Column(
            "source_core_id",
            sa.BigInteger,
            sa.ForeignKey("fiber_cores.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "destination_core_id",
            sa.BigInteger,
            sa.ForeignKey("fiber_cores.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("splice_loss", sa.Numeric(5, 2)),
        sa.Column(
            "technician_id",
            sa.BigInteger,
            sa.ForeignKey("employees.id", ondelete="SET NULL"),
        ),
        sa.Column(
            "spliced_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("notes", sa.Text),
    )
    op.create_index("ix_splice_enclosure", "splices", ["enclosure_asset_id"])
    op.create_index("ix_splice_src", "splices", ["source_core_id"])
    op.create_index("ix_splice_dst", "splices", ["destination_core_id"])

    # ── splitter_ports ───────────────────────────────────────────────────
    op.create_table(
        "splitter_ports",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column(
            "splitter_asset_id",
            sa.BigInteger,
            sa.ForeignKey("network_assets.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("port_kind", sa.String(10), nullable=False),
        sa.Column("port_index", sa.Integer, nullable=False),
        sa.Column(
            "connected_core_id",
            sa.BigInteger,
            sa.ForeignKey("fiber_cores.id", ondelete="SET NULL"),
        ),
        sa.Column("status", sa.String(20), server_default="available", nullable=False),
        sa.Column("notes", sa.Text),
        sa.UniqueConstraint(
            "splitter_asset_id", "port_kind", "port_index",
            name="uq_splitter_port",
        ),
    )
    op.create_index("ix_splitter_asset", "splitter_ports", ["splitter_asset_id"])

    # ── customer_network_links ───────────────────────────────────────────
    op.create_table(
        "customer_network_links",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column(
            "customer_id",
            sa.BigInteger,
            sa.ForeignKey("customers.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("link_kind", sa.String(20), nullable=False),
        sa.Column(
            "target_asset_id",
            sa.BigInteger,
            sa.ForeignKey("network_assets.id", ondelete="SET NULL"),
        ),
        sa.Column(
            "target_core_id",
            sa.BigInteger,
            sa.ForeignKey("fiber_cores.id", ondelete="SET NULL"),
        ),
        sa.Column("target_port_index", sa.Integer),
        sa.Column("notes", sa.Text),
    )
    op.create_index("ix_cnl_customer", "customer_network_links", ["customer_id"])


def downgrade() -> None:
    op.drop_index("ix_cnl_customer", table_name="customer_network_links")
    op.drop_table("customer_network_links")
    op.drop_index("ix_splitter_asset", table_name="splitter_ports")
    op.drop_table("splitter_ports")
    op.drop_index("ix_splice_dst", table_name="splices")
    op.drop_index("ix_splice_src", table_name="splices")
    op.drop_index("ix_splice_enclosure", table_name="splices")
    op.drop_table("splices")
    op.drop_index("ix_fiber_core_status", table_name="fiber_cores")
    op.drop_index("ix_fiber_core_cable", table_name="fiber_cores")
    op.drop_table("fiber_cores")
    op.execute("DROP INDEX IF EXISTS ix_fiber_route;")
    op.drop_index("ix_fiber_end", table_name="fiber_cables")
    op.drop_index("ix_fiber_start", table_name="fiber_cables")
    op.drop_index("ix_fiber_code", table_name="fiber_cables")
    op.drop_index("ix_fiber_org", table_name="fiber_cables")
    op.drop_table("fiber_cables")
    op.execute("DROP INDEX IF EXISTS ix_net_assets_geog;")
    op.drop_index("ix_net_assets_parent", table_name="network_assets")
    op.drop_index("ix_net_assets_status", table_name="network_assets")
    op.drop_index("ix_net_assets_type", table_name="network_assets")
    op.drop_index("ix_net_assets_org", table_name="network_assets")
    op.drop_table("network_assets")
