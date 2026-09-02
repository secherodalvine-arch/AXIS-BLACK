from pydantic import BaseModel, Field
from typing import Optional

class TransactionCreate(BaseModel):
    title: str = Field(..., example="Lunch at Java")
    amount: float = Field(..., gt=0, example=500.0)
    category: str = Field("food", example="food") # food, transport, shelter, entertainment, utilities, education, healthcare, income, other
    type: str = Field("expense", example="expense") # expense, income
    date: Optional[str] = None
    description: Optional[str] = None

class TransactionResponse(TransactionCreate):
    id: str
    user_id: str
    date: str
    created_at: str
