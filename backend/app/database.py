import logging
import asyncio
import base64
import datetime
import json
from pathlib import Path
from typing import Dict, Any, List, Optional
from motor.motor_asyncio import AsyncIOMotorClient
from app.config import settings

try:
    from bson import ObjectId
    from fastapi.encoders import ENCODERS_BY_TYPE
    ENCODERS_BY_TYPE[ObjectId] = str
except Exception:
    pass

logger = logging.getLogger("axis_black.database")

# ── MongoDB Manager ──
class DatabaseManager:
    client: Optional[AsyncIOMotorClient] = None
    db = None
    is_connected: bool = False
    data_file = Path(__file__).resolve().parent.parent / "local_store.json"
    
    # Resilient in-memory store if MongoDB Atlas is unreachable
    memory_store: Dict[str, Any] = {
        "users": {},
        "metrics": {},
        "transactions": {},
        "inventory": {},
        "analytics": {},
        "copilot_chats": {},
        "spreadsheets": {},
        "payments": {},
        "usage": {}
    }


    def load_memory_store(self):
        try:
            if self.data_file.exists():
                with open(self.data_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    for k in self.memory_store:
                        if k in data and isinstance(data[k], dict):
                            self.memory_store[k] = data[k]
                logger.info(f"Loaded local data store from {self.data_file}")
        except Exception as e:
            logger.warning(f"Could not load local data store: {e}")

    def save_memory_store(self):
        try:
            with open(self.data_file, "w", encoding="utf-8") as f:
                json.dump(self.memory_store, f, indent=2, default=str)
        except Exception as e:
            logger.warning(f"Could not save local data store: {e}")

db_manager = DatabaseManager()
db_manager.load_memory_store()

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
        db_manager.load_memory_store()
        logger.warning(f"MongoDB Atlas connection ({e}). Operating in resilient In-Memory mode with local disk persistence.")

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
    async def get_dashboard_metrics(user_id: str, branch_id: Optional[str] = None) -> List[Dict[str, Any]]:
        txns = await AxisDataStore.get_transactions(user_id)
        inventory_items = await AxisDataStore.get_inventory(user_id)

        if branch_id:
            try:
                from app.routers.business import get_business_doc
                biz_doc = await get_business_doc(user_id)
                branches = biz_doc.get("branches", [])
                is_main_or_only = len(branches) <= 1 or (branches and (next((b for b in branches if b.get("is_main")), branches[0]).get("id") == branch_id))
                txns = [t for t in txns if t.get("branch_id") == branch_id or (is_main_or_only and not t.get("branch_id"))]
                inventory_items = [i for i in inventory_items if i.get("branch_id") == branch_id or (is_main_or_only and not i.get("branch_id"))]
            except Exception:
                txns = [t for t in txns if t.get("branch_id") == branch_id or not t.get("branch_id")]
                inventory_items = [i for i in inventory_items if i.get("branch_id") == branch_id or not i.get("branch_id")]

        # Dynamic Financial Calculation from real transactions
        total_revenue = sum(t["amount"] for t in txns if t.get("amount", 0) > 0)
        total_expense = sum(abs(t["amount"]) for t in txns if t.get("amount", 0) < 0)
        net_liquidity = total_revenue - total_expense
        monthly_burn = total_expense
        runway_months = round(net_liquidity / monthly_burn, 1) if (monthly_burn > 0 and net_liquidity > 0) else (12.0 if net_liquidity > 0 else 0.0)

        # Dynamic Inventory Calculation from real inventory SKUs
        total_stock_val = sum(item.get("stock_quantity", 0) * item.get("unit_cost", 0) for item in inventory_items)
        active_skus_count = len(inventory_items)
        critical_items = [i for i in inventory_items if i.get("stock_quantity", 0) <= i.get("reorder_point", 0)]
        wh_health = round(((active_skus_count - len(critical_items)) / active_skus_count * 100), 1) if active_skus_count > 0 else 100.0

        # Dynamic Operations Calculation from live ledger
        infra_expenses = sum(abs(t["amount"]) for t in txns if any(k in (t.get("category") or "").lower() for k in ["infra", "cloud", "tech", "operations", "equipment"]))
        infra_cost_str = f"${infra_expenses:,.0f}/mo" if infra_expenses > 0 else "$0/mo"
        cleared_txns = [t for t in txns if t.get("status") == "Cleared"]
        ops_efficiency = round((len(cleared_txns) / len(txns) * 100), 1) if txns else 100.0

        # Dynamic Growth Calculation from live ledger
        sub_revenue = sum(t["amount"] for t in txns if any(k in (t.get("category") or "").lower() for k in ["sub", "revenue", "sales", "arr"]) and t.get("amount", 0) > 0)
        new_arr_str = f"${sub_revenue:,.0f}" if sub_revenue > 0 else "$0"
        net_margin_pct = round(((total_revenue - total_expense) / total_revenue * 100), 1) if total_revenue > 0 else 0.0

        return [
            {
                "id": "financial",
                "title": "Financial Advisor",
                "value": f"${total_revenue:,.0f}" if total_revenue > 0 else "$0",
                "numericValue": total_revenue,
                "change": f"Net Margin {net_margin_pct}%" if total_revenue > 0 else "0% Margin",
                "isPositive": total_revenue >= total_expense,
                "targetOrMeta": f"Net Cash: ${net_liquidity:,.0f} • Runway: {runway_months} Mo" if monthly_burn > 0 else f"Net Cash: ${net_liquidity:,.0f}",
                "glowColor": "lilac",
                "icon": "fa-coins",
                "progressPercent": min(100, max(10, int((net_liquidity / max(total_revenue, 1)) * 100))) if total_revenue > 0 else 50,
                "netLiquidity": net_liquidity,
                "monthlyBurn": monthly_burn,
                "runwayMonths": runway_months
            },
            {
                "id": "inventory",
                "title": "Inventory Advisor",
                "value": f"{active_skus_count} Active SKUs" if active_skus_count > 0 else "0 Active SKUs",
                "numericValue": total_stock_val,
                "change": f"{len(critical_items)} Needs Reorder" if critical_items else "Stock Optimal",
                "isPositive": len(critical_items) == 0,
                "targetOrMeta": f"Warehouse Health: {wh_health}% • Stock Val: ${total_stock_val:,.0f}" if active_skus_count > 0 else "No inventory items tracked yet",
                "glowColor": "cyan",
                "icon": "fa-boxes-stacked",
                "progressPercent": int(wh_health) if active_skus_count > 0 else 0,
                "activeSKUs": active_skus_count,
                "stockValuation": total_stock_val,
                "warehouseHealth": wh_health
            },
            {
                "id": "operations",
                "title": "Operations Advisor",
                "value": f"{ops_efficiency}% Cleared" if txns else "Ready",
                "numericValue": ops_efficiency if txns else 0.0,
                "change": f"{len(cleared_txns)} Cleared" if txns else "Active Monitoring",
                "isPositive": True,
                "targetOrMeta": f"Operations: {infra_cost_str} • {len(cleared_txns)}/{len(txns)} Cleared" if txns else "No operational ledger entries yet",
                "glowColor": "pink",
                "icon": "fa-gears",
                "progressPercent": int(ops_efficiency) if txns else 100,
                "infraCost": infra_cost_str,
                "latency": "Real-time",
                "capacity": f"{len(txns)} Entries"
            },
            {
                "id": "growth",
                "title": "Growth Advisor",
                "value": f"${sub_revenue:,.0f} ARR" if sub_revenue > 0 else "$0 ARR",
                "numericValue": sub_revenue,
                "change": "Active" if sub_revenue > 0 else "Standby",
                "isPositive": sub_revenue > 0,
                "targetOrMeta": f"Tracked ARR: {new_arr_str} • Growth Active" if sub_revenue > 0 else "Log revenue to track ARR growth",
                "glowColor": "purple",
                "icon": "fa-arrow-trend-up",
                "progressPercent": min(100, max(10, int((sub_revenue / max(total_revenue, 1)) * 100))) if total_revenue > 0 else 20,
                "newARR": new_arr_str,
                "ltvCac": "Active",
                "expansionRate": "Live"
            }
        ]

    @staticmethod
    async def get_transactions(user_id: str) -> List[Dict[str, Any]]:
        if db_manager.is_connected:
            docs = await db_manager.db.transactions.find({"user_id": user_id}).sort("date", -1).to_list(length=100)
            if docs:
                return [{k: v for k, v in d.items() if k != "_id"} for d in docs]
            return []

        user_txns = db_manager.memory_store["transactions"].get(user_id, [])
        return user_txns

    @staticmethod
    async def add_transaction(user_id: str, txn_data: Dict[str, Any]) -> Dict[str, Any]:
        target_id = str(txn_data.get("id") or "").strip()
        if not target_id or target_id.lower() in ("undefined", "null", "none"):
            existing_txns = await AxisDataStore.get_transactions(user_id)
            target_id = f"TXN-{1000 + len(existing_txns) + 1}"
        doc = {
            "id": target_id,
            "user_id": user_id,
            "counterparty": txn_data.get("counterparty", "Unknown"),
            "type": txn_data.get("type", "Expense"),
            "category": txn_data.get("category", "Infrastructure"),
            "date": txn_data.get("date", datetime.date.today().isoformat()),
            "status": txn_data.get("status", "Cleared"),
            "amount": float(txn_data.get("amount", 0.0)),
            "notes": txn_data.get("notes", ""),
            "branch_id": txn_data.get("branch_id"),
            "created_by": txn_data.get("created_by"),
            "created_by_name": txn_data.get("created_by_name"),
            "created_at": txn_data.get("created_at") or datetime.datetime.now(datetime.timezone.utc).isoformat()
        }

        if db_manager.is_connected:
            existing = await db_manager.db.transactions.find_one({"user_id": user_id, "id": target_id})
            if existing:
                await db_manager.db.transactions.update_one({"user_id": user_id, "id": target_id}, {"$set": doc})
                return {k: v for k, v in doc.items() if k != "_id"}
            await db_manager.db.transactions.insert_one(doc)
        
        if user_id not in db_manager.memory_store["transactions"]:
            db_manager.memory_store["transactions"][user_id] = []
        
        txns = db_manager.memory_store["transactions"][user_id]
        for idx, t in enumerate(txns):
            if t.get("id") == target_id:
                txns[idx].update(doc)
                db_manager.save_memory_store()
                return txns[idx]

        txns.insert(0, doc)
        db_manager.save_memory_store()

        return {k: v for k, v in doc.items() if k != "_id"}

    @staticmethod
    async def get_inventory(user_id: str) -> List[Dict[str, Any]]:
        if db_manager.is_connected:
            docs = await db_manager.db.inventory.find({"user_id": user_id}).to_list(length=100)
            if docs:
                return [{k: v for k, v in d.items() if k != "_id"} for d in docs]
            return []

        user_items = db_manager.memory_store["inventory"].get(user_id, [])
        return user_items

    @staticmethod
    async def add_inventory_item(user_id: str, item_data: Dict[str, Any]) -> Dict[str, Any]:
        target_sku = str(item_data.get("sku") or f"SKU-{1000 + len(item_data)}").strip()
        doc = {
            "sku": target_sku,
            "user_id": user_id,
            "name": item_data.get("name", "Inventory Item"),
            "category": item_data.get("category", "Hardware & Devices"),
            "stock_quantity": int(item_data.get("stock_quantity", 0)),
            "reorder_point": int(item_data.get("reorder_point", 50)),
            "unit_cost": float(item_data.get("unit_cost", 100.0)),
            "selling_price": float(item_data.get("selling_price", 150.0)),
            "supplier": item_data.get("supplier", "Global Supplier"),
            "velocity": item_data.get("velocity", "1.8x/mo"),
            "branch_id": item_data.get("branch_id"),
            "created_by": item_data.get("created_by"),
            "created_by_name": item_data.get("created_by_name"),
            "created_at": item_data.get("created_at") or datetime.datetime.now(datetime.timezone.utc).isoformat()
        }

        if db_manager.is_connected:
            existing = await db_manager.db.inventory.find_one({"user_id": user_id, "sku": target_sku})
            if existing:
                await db_manager.db.inventory.update_one({"user_id": user_id, "sku": target_sku}, {"$set": doc})
                return {k: v for k, v in doc.items() if k != "_id"}
            await db_manager.db.inventory.insert_one(doc)

        if user_id not in db_manager.memory_store["inventory"]:
            db_manager.memory_store["inventory"][user_id] = []

        items = db_manager.memory_store["inventory"][user_id]
        for idx, item in enumerate(items):
            if item.get("sku") == target_sku:
                items[idx].update(doc)
                db_manager.save_memory_store()
                return items[idx]

        db_manager.memory_store["inventory"][user_id].insert(0, doc)
        db_manager.save_memory_store()

        return {k: v for k, v in doc.items() if k != "_id"}

    @staticmethod
    async def update_inventory_item(user_id: str, sku: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        updates["updated_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
        if db_manager.is_connected:
            await db_manager.db.inventory.update_one(
                {"user_id": user_id, "sku": sku},
                {"$set": updates}
            )
            item = await db_manager.db.inventory.find_one({"user_id": user_id, "sku": sku})
            if item:
                item.pop("_id", None)
                return item

        items = db_manager.memory_store.get("inventory", {}).get(user_id, [])
        for i, item in enumerate(items):
            if item.get("sku") == sku:
                items[i].update(updates)
                db_manager.save_memory_store()
                return items[i]
        return None

    @staticmethod
    async def delete_inventory_item(user_id: str, sku: str) -> bool:
        if db_manager.is_connected:
            res = await db_manager.db.inventory.delete_one({"user_id": user_id, "sku": sku})
            return res.deleted_count > 0
        items = db_manager.memory_store.get("inventory", {}).get(user_id, [])
        before = len(items)
        db_manager.memory_store["inventory"][user_id] = [i for i in items if i.get("sku") != sku]
        db_manager.save_memory_store()
        return len(db_manager.memory_store["inventory"][user_id]) < before

    @staticmethod
    async def update_transaction(user_id: str, txn_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        updates["updated_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
        if "amount" in updates and updates["amount"] is not None:
            updates["amount"] = float(updates["amount"])
            
        if db_manager.is_connected:
            await db_manager.db.transactions.update_one(
                {"user_id": user_id, "id": txn_id},
                {"$set": updates}
            )
            item = await db_manager.db.transactions.find_one({"user_id": user_id, "id": txn_id})
            if item:
                item.pop("_id", None)
                return item

        txns = db_manager.memory_store.get("transactions", {}).get(user_id, [])
        for i, t in enumerate(txns):
            if t.get("id") == txn_id:
                txns[i].update(updates)
                db_manager.save_memory_store()
                return txns[i]
        return None

    @staticmethod
    async def delete_transaction(user_id: str, txn_id: str) -> bool:
        if db_manager.is_connected:
            res = await db_manager.db.transactions.delete_one({"user_id": user_id, "id": txn_id})
            return res.deleted_count > 0
        txns = db_manager.memory_store.get("transactions", {}).get(user_id, [])
        before = len(txns)
        db_manager.memory_store["transactions"][user_id] = [t for t in txns if t.get("id") != txn_id]
        db_manager.save_memory_store()
        return len(db_manager.memory_store["transactions"][user_id]) < before

    @staticmethod
    async def get_custom_spreadsheets(user_id: str) -> List[Dict[str, Any]]:
        if db_manager.is_connected:
            docs = await db_manager.db.spreadsheets.find({"user_id": user_id}).to_list(length=100)
            if docs:
                return [{k: v for k, v in d.items() if k != "_id"} for d in docs]
            return []
        return db_manager.memory_store.get("spreadsheets", {}).get(user_id, [])

    @staticmethod
    async def save_custom_spreadsheet(user_id: str, sheet_data: Dict[str, Any]) -> Dict[str, Any]:
        sheet_id = sheet_data.get("id") or f"SHEET-{datetime.datetime.now().strftime('%Y%m%d%H%M%S')}"
        sheet_data["id"] = sheet_id
        sheet_data["user_id"] = user_id
        sheet_data["updated_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()

        if db_manager.is_connected:
            await db_manager.db.spreadsheets.update_one(
                {"user_id": user_id, "id": sheet_id},
                {"$set": sheet_data},
                upsert=True
            )

        if "spreadsheets" not in db_manager.memory_store:
            db_manager.memory_store["spreadsheets"] = {}
        if user_id not in db_manager.memory_store["spreadsheets"]:
            db_manager.memory_store["spreadsheets"][user_id] = []

        sheets = db_manager.memory_store["spreadsheets"][user_id]
        idx = next((i for i, s in enumerate(sheets) if s.get("id") == sheet_id), None)
        if idx is not None:
            sheets[idx] = sheet_data
        else:
            sheets.append(sheet_data)
        db_manager.save_memory_store()
        return sheet_data

    @staticmethod
    async def delete_custom_spreadsheet(user_id: str, sheet_id: str) -> bool:
        if db_manager.is_connected:
            res = await db_manager.db.spreadsheets.delete_one({"user_id": user_id, "id": sheet_id})
            return res.deleted_count > 0
        sheets = db_manager.memory_store.get("spreadsheets", {}).get(user_id, [])
        before = len(sheets)
        db_manager.memory_store["spreadsheets"][user_id] = [s for s in sheets if s.get("id") != sheet_id]
        db_manager.save_memory_store()
        return len(db_manager.memory_store["spreadsheets"][user_id]) < before

    # ── Activity Audit Logging ──
    @staticmethod
    async def log_activity(
        owner_id: str,
        actor_id: str,
        actor_name: str,
        actor_role: str,
        action: str,
        title: str,
        details: str,
        branch_id: Optional[str] = None,
        branch_name: Optional[str] = None
    ) -> Dict[str, Any]:
        import uuid
        doc = {
            "id": f"act-{uuid.uuid4().hex[:10]}",
            "owner_id": owner_id,
            "actor_id": actor_id,
            "actor_name": actor_name,
            "actor_role": actor_role,
            "action": action,
            "title": title,
            "details": details,
            "branch_id": branch_id,
            "branch_name": branch_name,
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }
        if db_manager.is_connected:
            await db_manager.db.activities.insert_one(doc)
        if "activities" not in db_manager.memory_store:
            db_manager.memory_store["activities"] = {}
        if owner_id not in db_manager.memory_store["activities"]:
            db_manager.memory_store["activities"][owner_id] = []
        db_manager.memory_store["activities"][owner_id].insert(0, doc)
        db_manager.save_memory_store()
        return {k: v for k, v in doc.items() if k != "_id"}

    @staticmethod
    async def get_activities(owner_id: str, branch_id: Optional[str] = None, limit: int = 150) -> List[Dict[str, Any]]:
        if db_manager.is_connected:
            q: Dict[str, Any] = {"owner_id": owner_id}
            if branch_id:
                q["branch_id"] = branch_id
            docs = await db_manager.db.activities.find(q).sort("timestamp", -1).to_list(length=limit)
            return [{k: v for k, v in d.items() if k != "_id"} for d in docs]
        all_acts = db_manager.memory_store.get("activities", {}).get(owner_id, [])
        if branch_id:
            return [a for a in all_acts if a.get("branch_id") == branch_id][:limit]
        return all_acts[:limit]

    # ── Real-Time Notifications Storage ──
    @staticmethod
    async def add_notification(
        recipient_id: str,
        title: str,
        message: str,
        notif_type: str = "info",
        meta: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        import uuid
        doc = {
            "id": f"notif-{uuid.uuid4().hex[:10]}",
            "recipient_id": recipient_id,
            "title": title,
            "message": message,
            "type": notif_type,
            "read": False,
            "meta": meta or {},
            "time": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }
        if db_manager.is_connected:
            await db_manager.db.notifications.insert_one(doc)
        if "notifications" not in db_manager.memory_store:
            db_manager.memory_store["notifications"] = {}
        if recipient_id not in db_manager.memory_store["notifications"]:
            db_manager.memory_store["notifications"][recipient_id] = []
        db_manager.memory_store["notifications"][recipient_id].insert(0, doc)
        db_manager.save_memory_store()
        return {k: v for k, v in doc.items() if k != "_id"}

    @staticmethod
    async def get_notifications(recipient_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        if db_manager.is_connected:
            docs = await db_manager.db.notifications.find({"recipient_id": recipient_id}).sort("time", -1).to_list(length=limit)
            return [{k: v for k, v in d.items() if k != "_id"} for d in docs]
        return db_manager.memory_store.get("notifications", {}).get(recipient_id, [])[:limit]

    @staticmethod
    async def mark_notification_read(recipient_id: str, notif_id: str) -> bool:
        if db_manager.is_connected:
            await db_manager.db.notifications.update_one(
                {"recipient_id": recipient_id, "id": notif_id},
                {"$set": {"read": True}}
            )
        items = db_manager.memory_store.get("notifications", {}).get(recipient_id, [])
        for item in items:
            if item["id"] == notif_id:
                item["read"] = True
        db_manager.save_memory_store()
        return True
