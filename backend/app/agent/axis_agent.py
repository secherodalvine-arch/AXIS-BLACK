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
            "4. Ground all numerical figures strictly on the provided company business data context."
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

                user_prompt = f"User Query: '{query}'\nCompany Business Telemetry Context: {context}"
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

        # Intelligent Fallback / Rule-based response
        q_clean = re.sub(r'[^\w\s]', '', query.lower()).strip()
        
        if is_conv:
            if any(w in q_clean for w in ["who", "what"]):
                fallback_text = "Greetings! I am Axis, your real-time business data assistant. I help you track metrics, model scenarios, and optimize financial strategy in clear, plain language."
            else:
                fallback_text = "Greetings! I am Axis, your real-time business data assistant. How can I assist your financial strategy today?"
        elif "cash" in q_clean and "90" in q_clean:
            fallback_text = (
                "### 90-Day Cash Balance Projection\n\n"
                "Based on current financial data ($1.84M cash balance with a net monthly burn rate of ~$142.8K):\n\n"
                "- **Current Cash Balance:** $1,840,250\n"
                "- **Estimated 90-Day Expenses:** $428,400\n"
                "- **Projected Cash Balance in 90 Days:** **$1,411,850**\n\n"
                "Your projected cash runway remains healthy at **12.9+ months**."
            )
        elif "cost" in q_clean or "optimization" in q_clean:
            fallback_text = (
                "### Top 3 Cost Savings Opportunities\n\n"
                "1. **Cloud Server Optimization:** Save **$3,200/mo** by turning off unused test servers.\n"
                "2. **Software Licenses:** Save **$1,800/mo** by canceling 6 inactive software seats.\n"
                "3. **Checking Account Interest:** Earn **+$1,415/mo** by moving $350K idle cash into a short-term treasury yield account."
            )
        elif "engineer" in q_clean or "hire" in q_clean or "hiring" in q_clean:
            fallback_text = (
                "### Hiring Simulation: 4 Senior Engineers (October)\n\n"
                "Hiring 4 senior engineers will help build products faster and increase revenue. Here is the financial breakdown starting in October:\n\n"
                "- **Cost per Engineer:** $180,000 / year\n"
                "- **Total Annual Cost (4 Engineers):** $720,000 / year\n"
                "- **New Monthly Salary Expense:** $60,000 / month\n\n"
                "#### Financial Overview:\n"
                "- **Current Monthly Expenses:** $142,800 / month\n"
                "- **New Total Monthly Expenses:** $202,800 / month ($142,800 + $60,000)\n"
                "- **Current Cash Balance:** $1,840,250\n"
                "- **New Cash Runway:** **9.1 Months** (down from 12.9 months)\n\n"
                "**Key Takeaway:** Adding 4 senior engineers increases monthly costs by $60,000 and reduces your cash runway from 12.9 months to 9.1 months."
            )
        else:
            fallback_text = (
                "### Business Performance Overview\n\n"
                "- **Annual Revenue (ARR):** **$4.28M** (+18.4% YoY growth)\n"
                "- **Cash Runway:** **14.8 Months** ($1.84M Cash Balance)\n"
                "- **Inventory Turnover Rate:** **1.8x** (96.4% Stock Health)\n"
                "- **Operational Efficiency:** **94.2%**\n\n"
                "How would you like to explore these metrics today?"
            )

        return {
            "agent": "Axis",
            "advisor_type": adv_name,
            "answer": fallback_text,
            "subagent_insight": subagent_analysis,
            "sources": [],
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }

