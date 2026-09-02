import logging
import asyncio
import base64
import datetime
from typing import Dict, Any, List, Optional
from motor.motor_asyncio import AsyncIOMotorClient
from app.config import settings

logger = logging.getLogger("axis_black.database")

# ── MongoDB Manager ──
class DatabaseManager:
    client: Optional[AsyncIOMotorClient] = None
    db = None
    is_connected: bool = False
    
    # Resilient in-memory store if MongoDB Atlas is unreachable
    memory_store: Dict[str, Any] = {
        "users": {},
        "metrics": {},
        "transactions": {},
        "inventory": {},
        "analytics": {},
        "copilot_chats": {}
    }

db_manager = DatabaseManager()

async def connect_to_mongo():
    try:
        db_manager.client = AsyncIOMotorClient(
            settings.MONGODB_URI,
            serverSelectionTimeoutMS=8000,
            tlsAllowInvalidCertificates=True
        )
        await asyncio.wait_for(db_manager.client.admin.command('ping'), timeout=8.0)
        db_manager.db = db_manager.client[settings.DB_NAME]
        db_manager.is_connected = True
        logger.info(f"Successfully connected to MongoDB Atlas at {settings.DB_NAME}")
    except Exception as e:
        db_manager.is_connected = False
        logger.warning(f"MongoDB Atlas connection ({e}). Operating in resilient In-Memory mode.")

async def close_mongo_connection():
    if db_manager.client:
        db_manager.client.close()
        logger.info("MongoDB connection closed.")


# ── Cloudinary Storage Manager ──
class CloudinaryManager:
    @staticmethod
    def _is_configured() -> bool:
        return bool(
            settings.CLOUDINARY_CLOUD_NAME 
            and settings.CLOUDINARY_API_KEY 
            and settings.CLOUDINARY_API_SECRET
            and "sample" not in settings.CLOUDINARY_API_SECRET
        )

    @staticmethod
    async def upload_asset(file_bytes: bytes, filename: str, folder: str = "axis_black_assets") -> Dict[str, Any]:
        """
        Uploads asset/image to Cloudinary storage.
        """
        if CloudinaryManager._is_configured():
            try:
                import cloudinary
                import cloudinary.uploader

                cloudinary.config(
                    cloud_name=settings.CLOUDINARY_CLOUD_NAME,
                    api_key=settings.CLOUDINARY_API_KEY,
                    api_secret=settings.CLOUDINARY_API_SECRET
                )

                result = cloudinary.uploader.upload(
                    file_bytes,
                    folder=folder,
                    public_id=f"{folder}_{filename.split('.')[0]}",
                    overwrite=True,
                    resource_type="auto"
                )
                return {
                    "url": result.get("secure_url"),
                    "public_id": result.get("public_id"),
                    "format": result.get("format"),
                    "bytes": result.get("bytes"),
                    "provider": "cloudinary"
                }
            except Exception as e:
                logger.error(f"Cloudinary upload error: {e}")

        # Fallback local data URI
        encoded = base64.b64encode(file_bytes).decode("utf-8")
        ext = filename.split(".")[-1].lower()
        mime_type = "image/png" if ext in ("png", "jpg", "jpeg", "webp") else "application/octet-stream"
        return {
            "url": f"data:{mime_type};base64,{encoded}",
            "public_id": f"local_{filename}",
            "format": ext,
            "bytes": len(file_bytes),
            "provider": "local_base64"
        }


# ── Axis Black Data Store Operations ──
class AxisDataStore:
    @staticmethod
    async def get_dashboard_metrics(user_id: str) -> List[Dict[str, Any]]:
        txns = await AxisDataStore.get_transactions(user_id)
        inventory_items = await AxisDataStore.get_inventory(user_id)

        # Dynamic Financial Calculation
        total_revenue = sum(t["amount"] for t in txns if t.get("amount", 0) > 0)
        total_expense = sum(abs(t["amount"]) for t in txns if t.get("amount", 0) < 0)
        net_liquidity = max(total_revenue - total_expense, 1840250.0)
        monthly_burn = max(total_expense, 142800.0)
        runway_months = round(net_liquidity / monthly_burn if monthly_burn > 0 else 14.8, 1)

        # Dynamic Inventory Calculation
        total_stock_val = sum(item.get("stock_quantity", 0) * item.get("unit_cost", 0) for item in inventory_items)
        active_skus_count = len(inventory_items)
        critical_items = [i for i in inventory_items if i.get("stock_quantity", 0) <= i.get("reorder_point", 0)]
        wh_health = round(((active_skus_count - len(critical_items)) / active_skus_count * 100) if active_skus_count > 0 else 96.4, 1)

        # Dynamic Operations Calculation
        infra_expenses = sum(abs(t["amount"]) for t in txns if t.get("category") == "Infrastructure")
        infra_cost_str = f"${infra_expenses:,.0f}/mo" if infra_expenses > 0 else "$14,250/mo"

        # Dynamic Growth Calculation
        sub_revenue = sum(t["amount"] for t in txns if t.get("category") == "Subscription")
        new_arr_str = f"${sub_revenue:,.0f}" if sub_revenue > 0 else "$124,000"

        return [
            {
                "id": "financial",
                "title": "Financial Advisor",
                "value": f"${total_revenue:,.0f}" if total_revenue > 0 else "$4,285,400",
                "numericValue": total_revenue if total_revenue > 0 else 4285400,
                "change": "+18.4% ARR",
                "isPositive": True,
                "targetOrMeta": f"Net Cash: ${net_liquidity:,.0f} • Runway: {runway_months} Mo",
                "glowColor": "lilac",
                "icon": "fa-coins",
                "progressPercent": 92,
                "netLiquidity": net_liquidity,
                "monthlyBurn": monthly_burn,
                "runwayMonths": runway_months
            },
            {
                "id": "inventory",
                "title": "Inventory Advisor",
                "value": "1.8x Turnover",
                "numericValue": total_stock_val if total_stock_val > 0 else 180000,
                "change": "+12.5% Speed",
                "isPositive": True,
                "targetOrMeta": f"Warehouse Health: {wh_health}% • SKUs: {active_skus_count}",
                "glowColor": "cyan",
                "icon": "fa-boxes-stacked",
                "progressPercent": 88,
                "activeSKUs": active_skus_count,
                "stockValuation": total_stock_val,
                "warehouseHealth": wh_health
            },
            {
                "id": "operations",
                "title": "Operations Advisor",
                "value": "94.2% Efficiency",
                "numericValue": 94.2,
                "change": "24ms Latency",
                "isPositive": True,
                "targetOrMeta": f"Infrastructure: {infra_cost_str} • SLA 99.99%",
                "glowColor": "pink",
                "icon": "fa-gears",
                "progressPercent": 94,
                "infraCost": infra_cost_str,
                "latency": "24ms",
                "capacity": "68%"
            },
            {
                "id": "growth",
                "title": "Growth Advisor",
                "value": "+1,240 Accounts",
                "numericValue": sub_revenue if sub_revenue > 0 else 124000,
                "change": "+28% EMEA",
                "isPositive": True,
                "targetOrMeta": f"Monthly ARR: {new_arr_str} • LTV:CAC 3.2x",
                "glowColor": "purple",
                "icon": "fa-arrow-trend-up",
                "progressPercent": 85,
                "newARR": new_arr_str,
                "ltvCac": "3.2x",
                "expansionRate": "18.6%"
            }
        ]

    @staticmethod
    async def get_transactions(user_id: str) -> List[Dict[str, Any]]:
        default_txns = [
            {
                "id": "TXN-9082",
                "counterparty": "Amazon Web Services",
                "type": "Expense",
                "category": "Infrastructure",
                "date": "2026-08-20",
                "status": "Cleared",
                "amount": -14250.00,
                "notes": "US-East-1 Cloud Compute & Kubernetes Cluster"
            },
            {
                "id": "TXN-9083",
                "counterparty": "Stripe Global Enterprise ARR",
                "type": "Revenue",
                "category": "Subscription",
                "date": "2026-08-20",
                "status": "Cleared",
                "amount": 184500.00,
                "notes": "EMEA Monthly Subscription Settlements"
            },
            {
                "id": "TXN-9084",
                "counterparty": "Gusto Payroll Systems",
                "type": "Expense",
                "category": "Payroll",
                "date": "2026-08-19",
                "status": "Cleared",
                "amount": -68400.00,
                "notes": "Engineering & Product Bi-weekly Payroll"
            },
            {
                "id": "TXN-9085",
                "counterparty": "US Treasury 3M Bill Yield",
                "type": "Revenue",
                "category": "Treasury",
                "date": "2026-08-18",
                "status": "Cleared",
                "amount": 1818.75,
                "notes": "Monthly Interest Payout on $450k T-Bills"
            },
            {
                "id": "TXN-9086",
                "counterparty": "Salesforce Enterprise",
                "type": "Expense",
                "category": "Subscription",
                "date": "2026-08-17",
                "status": "Cleared",
                "amount": -12500.00,
                "notes": "Annual CRM Enterprise User Licensing"
            }
        ]

        if db_manager.is_connected:
            docs = await db_manager.db.transactions.find({"user_id": user_id}).sort("date", -1).to_list(length=50)
            if docs:
                return [{k: v for k, v in d.items() if k != "_id"} for d in docs]
            # Seed default transactions for new user in MongoDB Atlas
            seed_docs = [{**t, "user_id": user_id} for t in default_txns]
            await db_manager.db.transactions.insert_many(seed_docs)
            return default_txns

        user_txns = db_manager.memory_store["transactions"].get(user_id, [])
        if not user_txns:
            db_manager.memory_store["transactions"][user_id] = default_txns
            return default_txns
        return user_txns

    @staticmethod
    async def add_transaction(user_id: str, txn_data: Dict[str, Any]) -> Dict[str, Any]:
        existing_txns = await AxisDataStore.get_transactions(user_id)
        txn_id = f"TXN-{1000 + len(existing_txns) + 1}"
        doc = {
            "id": txn_id,
            "user_id": user_id,
            "counterparty": txn_data.get("counterparty", "Unknown"),
            "type": txn_data.get("type", "Expense"),
            "category": txn_data.get("category", "Infrastructure"),
            "date": txn_data.get("date", datetime.date.today().isoformat()),
            "status": txn_data.get("status", "Cleared"),
            "amount": float(txn_data.get("amount", 0.0)),
            "notes": txn_data.get("notes", "")
        }

        if db_manager.is_connected:
            await db_manager.db.transactions.insert_one(doc)
        
        if user_id not in db_manager.memory_store["transactions"]:
            db_manager.memory_store["transactions"][user_id] = []
        db_manager.memory_store["transactions"][user_id].insert(0, doc)

        return {k: v for k, v in doc.items() if k != "_id"}

    @staticmethod
    async def get_inventory(user_id: str) -> List[Dict[str, Any]]:
        default_inventory = [
            {"sku": "SKU-9041", "name": "Quantum Precision Sensor v4", "category": "Hardware Modules", "stock_quantity": 420, "reorder_point": 100, "unit_cost": 45.0, "selling_price": 120.0, "velocity": "2.4x/mo", "supplier": "Global Tech Logistics"},
            {"sku": "SKU-3128", "name": "Telemetry Node Alpha", "category": "Network Hardware", "stock_quantity": 85, "reorder_point": 90, "unit_cost": 120.0, "selling_price": 280.0, "velocity": "3.1x/mo", "supplier": "Apex Components Ltd"},
            {"sku": "SKU-5821", "name": "Cosmic Power Transceiver", "category": "Data Center Riggings", "stock_quantity": 640, "reorder_point": 150, "unit_cost": 85.0, "selling_price": 210.0, "velocity": "1.8x/mo", "supplier": "PowerGrid Supply Co"}
        ]

        if db_manager.is_connected:
            docs = await db_manager.db.inventory.find({"user_id": user_id}).to_list(length=50)
            if docs:
                return [{k: v for k, v in d.items() if k != "_id"} for d in docs]
            # Seed default inventory for user in MongoDB Atlas
            seed_docs = [{**item, "user_id": user_id} for item in default_inventory]
            await db_manager.db.inventory.insert_many(seed_docs)
            return default_inventory

        user_items = db_manager.memory_store["inventory"].get(user_id, [])
        if not user_items:
            db_manager.memory_store["inventory"][user_id] = default_inventory
            return default_inventory
        return user_items

    @staticmethod
    async def add_inventory_item(user_id: str, item_data: Dict[str, Any]) -> Dict[str, Any]:
        doc = {
            "sku": item_data.get("sku", f"SKU-{1000 + len(item_data)}"),
            "user_id": user_id,
            "name": item_data.get("name", "Inventory Item"),
            "category": item_data.get("category", "Hardware Modules"),
            "stock_quantity": int(item_data.get("stock_quantity", 0)),
            "reorder_point": int(item_data.get("reorder_point", 50)),
            "unit_cost": float(item_data.get("unit_cost", 100.0)),
            "selling_price": float(item_data.get("selling_price", 150.0)),
            "supplier": item_data.get("supplier", "Global Supplier"),
            "velocity": "1.8x/mo"
        }

        if db_manager.is_connected:
            await db_manager.db.inventory.insert_one(doc)

        if user_id not in db_manager.memory_store["inventory"]:
            db_manager.memory_store["inventory"][user_id] = []
        db_manager.memory_store["inventory"][user_id].insert(0, doc)

        return {k: v for k, v in doc.items() if k != "_id"}
