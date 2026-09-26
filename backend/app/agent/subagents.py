import os
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger("axis_black.subagents")

SKILLS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "skills")

class AdvisorSubagent:
    """
    Specialist Subagent implementation following PAPGENT's LlmAgent subagent pattern.
    Each advisor subagent is configured with a name, model, domain description, and instructions
    loaded directly from its Markdown (.md) advisory skill file.
    """
    def __init__(
        self,
        name: str,
        description: str,
        md_filename: str,
        model: str = "gemini-2.5-flash"
    ):
        self.name = name
        self.description = description
        self.md_path = os.path.join(SKILLS_DIR, md_filename)
        self.model = model
        self._instruction: Optional[str] = None

    @property
    def instruction(self) -> str:
        if self._instruction is None:
            if os.path.exists(self.md_path):
                with open(self.md_path, "r", encoding="utf-8") as f:
                    self._instruction = f.read()
            else:
                logger.warning(f"Markdown instruction file for subagent '{self.name}' not found at {self.md_path}")
                self._instruction = f"You are the {self.name} specialist subagent for Axis Agent."
        return self._instruction

    def analyze(self, metrics: Any, query: str) -> Dict[str, Any]:
        """
        Executes domain subagent analysis on company business data.
        """
        adv_title = self.name.replace("_", " ").title()

        # Handle metrics passed as either a single metric dict, context dict, or list of metrics
        target: Dict[str, Any] = {}
        if isinstance(metrics, list):
            target = next((m for m in metrics if isinstance(m, dict) and self.name.split('_')[0] in m.get("id", "")), {})
        elif isinstance(metrics, dict):
            if "metrics" in metrics and isinstance(metrics["metrics"], list):
                target = next((m for m in metrics["metrics"] if isinstance(m, dict) and self.name.split('_')[0] in m.get("id", "")), {})
            else:
                target = metrics

        if "financial" in self.name:
            val = target.get("value", "$0")
            net_liq = target.get("netLiquidity", 0.0)
            runway = target.get("runwayMonths", 0.0)
            return {
                "subagent": self.name,
                "advisor": adv_title,
                "focus": "Capital Efficiency & Financial Health",
                "insight": f"Analysis for query '{query}': Tracked revenue stands at {val}, with verified net liquidity of ${net_liq:,.2f} and an operating runway of {runway} months.",
                "recommendations": [
                    "Maintain operating runway buffer before major capital expenditures.",
                    "Review recurring ledger entries to minimize unneeded overhead."
                ],
                "instruction_file": os.path.basename(self.md_path)
            }
        elif "inventory" in self.name:
            active_skus = target.get("activeSKUs", 0)
            stock_val = target.get("stockValuation", 0.0)
            wh_health = target.get("warehouseHealth", 100.0)
            return {
                "subagent": self.name,
                "advisor": adv_title,
                "focus": "Stock Valuation & Reorder Readiness",
                "insight": f"Analysis for query '{query}': Currently tracking {active_skus} active SKUs with total stock valuation of ${stock_val:,.2f} (Stock Health: {wh_health}%).",
                "recommendations": [
                    "Ensure items approaching reorder thresholds have purchase orders prepared.",
                    "Audit holding levels for slow-moving inventory to release liquidity."
                ],
                "instruction_file": os.path.basename(self.md_path)
            }
        elif "operations" in self.name:
            infra_cost = target.get("infraCost", "$0/mo")
            ops_eff = target.get("numericValue", 100.0)
            return {
                "subagent": self.name,
                "advisor": adv_title,
                "focus": "Operational Efficiency & Expense Optimization",
                "insight": f"Analysis for query '{query}': Operational efficiency is at {ops_eff}% with tracked operational costs of {infra_cost}.",
                "recommendations": [
                    "Audit recurring software subscriptions and infrastructure contracts quarterly.",
                    "Ensure ledger entries are categorized promptly to maintain real-time visibility."
                ],
                "instruction_file": os.path.basename(self.md_path)
            }
        elif "growth" in self.name:
            new_arr = target.get("newARR", "$0")
            return {
                "subagent": self.name,
                "advisor": adv_title,
                "focus": "Revenue Growth & Trajectory",
                "insight": f"Analysis for query '{query}': Tracked revenue expansion stands at {new_arr}.",
                "recommendations": [
                    "Focus acquisition on high-margin customer segments.",
                    "Track customer retention and repeat transactions in the ledger."
                ],
                "instruction_file": os.path.basename(self.md_path)
            }
        else:
            return {
                "subagent": self.name,
                "advisor": adv_title,
                "focus": "Business Data Analysis",
                "insight": f"Subagent analysis for query '{query}' based on ledger and inventory data.",
                "recommendations": ["Review business metrics in your ledger."],
                "instruction_file": os.path.basename(self.md_path)
            }

# Instantiating the 4 Specialist Advisor Subagents (PAPGENT Pattern)
financial_advisor_subagent = AdvisorSubagent(
    name="financial_advisor",
    description="Handles enterprise revenue growth, cash runway buffer, net liquidity optimization, burn rate trajectory, and treasury yield.",
    md_filename="financial_advisor.md"
)

inventory_advisor_subagent = AdvisorSubagent(
    name="inventory_advisor",
    description="Handles SKU stock movement, warehouse valuation, reorder point matrices, stockout prevention, and supply chain records.",
    md_filename="inventory_advisor.md"
)

operations_advisor_subagent = AdvisorSubagent(
    name="operations_advisor",
    description="Handles system efficiency scores, operations spend optimization, and SLA uptime records.",
    md_filename="operations_advisor.md"
)

growth_advisor_subagent = AdvisorSubagent(
    name="growth_advisor",
    description="Handles customer acquisition, account expansion, sales trajectory, and revenue acceleration.",
    md_filename="growth_advisor.md"
)

SUBAGENTS_REGISTRY = {
    "financial": financial_advisor_subagent,
    "financial_advisor": financial_advisor_subagent,
    "inventory": inventory_advisor_subagent,
    "inventory_advisor": inventory_advisor_subagent,
    "operations": operations_advisor_subagent,
    "operations_advisor": operations_advisor_subagent,
    "growth": growth_advisor_subagent,
    "growth_advisor": growth_advisor_subagent,
}
