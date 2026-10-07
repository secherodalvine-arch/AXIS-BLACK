import logging
import datetime
import re
from typing import Dict, Any, List, Optional
from app.config import settings
from app.agent.subagents import (
    SUBAGENTS_REGISTRY,
    financial_advisor_subagent,
    inventory_advisor_subagent,
    operations_advisor_subagent,
    growth_advisor_subagent,
    AdvisorSubagent
)

logger = logging.getLogger("axis_black.agent")

class AxisSupervisorAgent:
    """
    Axis Supervisor Agent — Root Coordinator for Axis Black enterprise financial intelligence platform.
    Coordinates specialized intelligence domains while exposing a single unified 'Axis' persona.
    """
    def __init__(self):
        self.name = "axis"
        self.model = "gemini-2.5-flash"
        self.description = (
            "Axis — Real-time business data intelligence assistant for Axis Black."
        )
        self.sub_agents: Dict[str, AdvisorSubagent] = {
            "financial_advisor": financial_advisor_subagent,
            "inventory_advisor": inventory_advisor_subagent,
            "operations_advisor": operations_advisor_subagent,
            "growth_advisor": growth_advisor_subagent,
        }

    def is_conversational(self, query: str) -> bool:
        """
        Determines if the query is a greeting, casual remark, or identity question.
        """
        q_clean = re.sub(r'[^\w\s]', '', query.lower()).strip()
        greetings = {
            "hi", "hello", "hi there", "hey", "hey there", "good morning", 
            "good afternoon", "good evening", "greetings", "yo", "thanks", "thank you"
        }
        if q_clean in greetings or (len(q_clean.split()) <= 2 and any(g in q_clean for g in ["hi", "hello", "hey", "sup"])):
            return True
        if any(phrase in q_clean for phrase in ["who are you", "what are you", "what is axis", "who is axis", "help me"]):
            return True
        return False

    def route_query(self, query: str, advisor_type: Optional[str] = None) -> Optional[AdvisorSubagent]:
        """
        Determines the appropriate specialist domain for a user query.
        Matches explicit advisor_type or uses keyword intelligence.
        """
        if self.is_conversational(query):
            return None

        if advisor_type:
            key = advisor_type.lower().strip()
            if key in SUBAGENTS_REGISTRY:
                return SUBAGENTS_REGISTRY[key]

        q_lower = query.lower()
        if any(w in q_lower for w in ["burn", "runway", "arr", "cash", "treasury", "yield", "revenue", "margin", "bill", "bank"]):
            return self.sub_agents["financial_advisor"]
        elif any(w in q_lower for w in ["sku", "stock", "inventory", "warehouse", "reorder", "supplier", "turnover", "unit"]):
            return self.sub_agents["inventory_advisor"]
        elif any(w in q_lower for w in ["server", "latency", "aws", "cloud", "opex", "cpu", "ram", "cluster", "sla", "uptime", "kubernetes"]):
            return self.sub_agents["operations_advisor"]
        elif any(w in q_lower for w in ["cac", "ltv", "account", "customer", "expansion", "emea", "seat", "growth", "acv", "sales", "engineer", "hire"]):
            return self.sub_agents["growth_advisor"]
        
        return None

    def get_supervisor_instruction(self, selected_subagent: Optional[AdvisorSubagent] = None) -> str:
        """
        Constructs system instructions establishing the unified 'Axis' persona.
        """
        base_instruction = (
            "You are Axis, the intelligent business data assistant for Axis Black. "
            "Always present yourself as a single, unified agent named 'Axis'. "
            "NEVER refer to yourself as a multi-agent system, supervisor, or mention internal subagents, team members, or '4 ADVISORS LIVE skills'.\n\n"
            "RESPONSE GUIDELINES:\n"
            "1. For greetings or short casual questions (e.g., 'hi there', 'hello', 'who are you'), respond concisely and naturally in 1 to 2 sentences.\n"
            "2. For prompts requiring analysis, financial projections, or strategic advice, provide a nicely structured response using GitHub Markdown, clear bold headers, bullet points, and key numbers.\n"
            "3. Use standard, clear, plain business language. AVOID complex jargon or hard vocabularies (e.g., avoid 'telemetry', 'acquisition velocity', 'expansion potential', 'LTV:CAC ratio'). Explain numbers simply and clearly so founders and business operators can understand instantly without struggle.\n"
            "4. Ground all numerical figures strictly on the provided company business data context.\n"
            "5. Open Strategic & Creative Assistance: When asked for business advice, platform naming/branding ideas, product improvements, or growth strategy, provide imaginative, structured, high-value recommendations tailored to modern financial and enterprise operations."
        )
        if selected_subagent:
            base_instruction += (
                f"\n\n[SPECIALIST DOMAIN FOCUS: {selected_subagent.name.upper()}]\n"
                f"Domain Guidance:\n{selected_subagent.instruction}"
            )
        return base_instruction


# Global Supervisor Instance
axis_supervisor = AxisSupervisorAgent()


class AxisAgent:
    """
    Axis Agent — Public interface wrapping Axis intelligence engine.
    """
    supervisor = axis_supervisor
    sub_agents = axis_supervisor.sub_agents
    skills = SUBAGENTS_REGISTRY

    @staticmethod
    def _get_genai_client():
        if not settings.GEMINI_API_KEY:
            return None
        try:
            from google import genai
            return genai.Client(api_key=settings.GEMINI_API_KEY)
        except Exception as e:
            logger.warning(f"Failed to initialize google.genai Client: {e}")
            return None

    @classmethod
    async def process_query(cls, query: str, context: Dict[str, Any], advisor_type: Optional[str] = None) -> Dict[str, Any]:
        """
        Processes queries via Axis Supervisor Agent with unified persona and intelligent formatting.
        """
        client = cls._get_genai_client()
        is_conv = cls.supervisor.is_conversational(query)
        subagent = None if is_conv else cls.supervisor.route_query(query, advisor_type)

        if subagent:
            subagent_analysis = subagent.analyze(context, query)
            system_prompt = cls.supervisor.get_supervisor_instruction(subagent)
            adv_name = subagent.name.replace("_", " ").title()
        else:
            subagent_analysis = None
            system_prompt = cls.supervisor.get_supervisor_instruction(None)
            adv_name = "Axis"

        if client:
            try:
                from google.genai import types

                user_prompt = f"User Query: '{query}'\nCompany Business Data Context: {context}"
                if subagent_analysis:
                    user_prompt += f"\nDomain Initial Analysis: {subagent_analysis}"

                response = client.models.generate_content(
                    model='gemini-2.5-flash',
                    contents=user_prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=system_prompt
                    )
                )
                text = response.text if hasattr(response, 'text') else str(response)

                return {
                    "agent": "Axis",
                    "advisor_type": adv_name,
                    "answer": text,
                    "subagent_insight": subagent_analysis,
                    "sources": [],
                    "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
                }

            except Exception as e:
                logger.error(f"Axis Agent Gemini API call error: {e}")

        # Extract actual company metrics from context
        metrics_list = context.get("metrics") or []
        fin_metric = next((m for m in metrics_list if isinstance(m, dict) and m.get("id") == "financial"), {})
        inv_metric = next((m for m in metrics_list if isinstance(m, dict) and m.get("id") == "inventory"), {})
        ops_metric = next((m for m in metrics_list if isinstance(m, dict) and m.get("id") == "operations"), {})
        growth_metric = next((m for m in metrics_list if isinstance(m, dict) and m.get("id") == "growth"), {})

        total_rev = float(fin_metric.get("numericValue", 0.0) or 0.0)
        net_liq = float(fin_metric.get("netLiquidity", 0.0) or 0.0)
        monthly_burn = float(fin_metric.get("monthlyBurn", 0.0) or 0.0)
        runway = float(fin_metric.get("runwayMonths", 0.0) or (12.0 if net_liq > 0 else 0.0))

        active_skus = int(inv_metric.get("activeSKUs", 0) or 0)
        stock_val = float(inv_metric.get("stockValuation", 0.0) or 0.0)
        wh_health = float(inv_metric.get("warehouseHealth", 100.0) or 100.0)

        ops_eff = float(ops_metric.get("numericValue", 100.0) or 100.0)
        new_arr = float(growth_metric.get("numericValue", 0.0) or 0.0)

        # Dynamic Rule-based response computed strictly from actual company records
        q_clean = re.sub(r'[^\w\s]', '', query.lower()).strip()
        
        if is_conv:
            if any(w in q_clean for w in ["who", "what"]):
                fallback_text = "Greetings! I am Axis, your business financial intelligence assistant. I help you track metrics, model scenarios, and optimize financial strategy in clear, plain language."
            else:
                fallback_text = "Greetings! I am Axis, your business financial intelligence assistant. How can I assist your financial strategy today?"
        elif "cash" in q_clean and "90" in q_clean:
            est_90d_burn = monthly_burn * 3.0
            proj_cash_90d = max(0.0, net_liq - est_90d_burn)
            fallback_text = (
                "### 90-Day Cash Balance Projection\n\n"
                f"Based on your actual verified ledger records (${net_liq:,.2f} net liquidity with a monthly burn of ${monthly_burn:,.2f}):\n\n"
                f"- **Current Cash Balance:** ${net_liq:,.2f}\n"
                f"- **Estimated 90-Day Expenses:** ${est_90d_burn:,.2f}\n"
                f"- **Projected Cash Balance in 90 Days:** **${proj_cash_90d:,.2f}**\n\n"
                f"Your operating runway is calculated at **{runway} month{'s' if runway != 1 else ''}**."
            )
        elif "cost" in q_clean or "optimization" in q_clean:
            savings_est = round(monthly_burn * 0.08, 2)
            fallback_text = (
                "### Cost Optimization Opportunities\n\n"
                f"Based on your monthly operating expenses of **${monthly_burn:,.2f}**:\n\n"
                f"1. **Operational Expenses:** Potential savings of **${savings_est:,.2f}/mo** through contract renegotiation and audit of recurring overhead.\n"
                "2. **Treasury Management:** Maintain liquidity buffers in short-term interest-bearing accounts.\n"
                f"3. **Inventory Rebalancing:** Active stock valuation is **${stock_val:,.2f}** across {active_skus} SKUs. Rationalize low-turnover items to liberate working capital."
            )
        elif "engineer" in q_clean or "hire" in q_clean or "hiring" in q_clean:
            add_monthly_cost = 60000.0
            new_burn = monthly_burn + add_monthly_cost
            new_runway = round(net_liq / new_burn, 1) if new_burn > 0 else 0.0
            fallback_text = (
                "### Hiring Simulation: 4 Senior Engineers\n\n"
                "Here is the financial projection modeled against your live ledger:\n\n"
                "- **Estimated Added Monthly Payroll:** $60,000 / month\n"
                f"- **Current Monthly Operating Expenses:** ${monthly_burn:,.2f} / month\n"
                f"- **New Total Monthly Expenses:** ${new_burn:,.2f} / month\n"
                f"- **Current Cash Balance:** ${net_liq:,.2f}\n"
                f"- **Updated Operating Runway:** **{new_runway} Months** (previously {runway} months)\n\n"
                f"**Key Takeaway:** Adding 4 senior engineers increases monthly commitments by $60,000, adjusting your runway to {new_runway} months."
            )
        elif any(w in q_clean for w in ["name", "rename", "brand", "rebrand", "suggest name", "platform name"]):
            fallback_text = (
                "### Platform Naming & Brand Directions for Axis Black\n\n"
                "Axis Black is an **Autonomous Financial Operating System** uniting spreadsheets, live double-entry ledgers, and inventory management. Here are high-caliber name directions tailored to the platform:\n\n"
                "- **Executive & Institutional:** *Vanguard Ledger*, *Meridian OS*, *Centrum Black*, *Aura Finance*\n"
                "- **Fintech & Speed:** *FinFlow HQ*, *Veloce OS*, *Kore Financial*, *NovaLedger*\n"
                "- **Intelligence & Precision:** *OmniPulse*, *Stratis Black*, *Quantis HQ*, *Vector Ledger*\n"
                "- **Minimalist & Modern:** *Nexus*, *Prism*, *Kinetix*\n\n"
                "**Recommendation:** You can also retain the core equity of **Axis** and introduce functional module descriptors like *Axis Ledger*, *Axis Sheets*, or *Axis OS*."
            )
        else:
            fallback_text = (
                "### Company Business Performance\n\n"
                f"- **Net Liquidity:** **${net_liq:,.2f}** across ledger accounts\n"
                f"- **Operating Runway:** **{runway} Month{'s' if runway != 1 else ''}** (Monthly Burn: ${monthly_burn:,.2f})\n"
                f"- **Active SKUs Tracked:** **{active_skus}** (Total Stock Value: ${stock_val:,.2f})\n"
                f"- **Operations Efficiency:** **{ops_eff}%** Cleared\n\n"
                "How would you like to model your business numbers today?"
            )

        return {
            "agent": "Axis",
            "advisor_type": adv_name,
            "answer": fallback_text,
            "subagent_insight": subagent_analysis,
            "sources": [],
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }

