from pydantic import BaseModel, Field
from typing import Optional, Dict, Any

class LocationModel(BaseModel):
    city: str = Field("", description="User current city or town")
    country: str = Field("Kenya", description="User country")

    latitude: Optional[float] = None
    longitude: Optional[float] = None

class SalaryUpdateModel(BaseModel):
    income_frequency: Optional[str] = Field("monthly", description="daily, weekly, or monthly")
    income_amount: Optional[float] = Field(None, description="Raw income per selected period")
    salary: float = Field(..., gt=0, description="Monthly total salary (calculated or direct)")
    other_income: float = Field(0.0, ge=0, description="Other monthly income")
    currency: str = Field("KSh", description="Currency symbol/code")

class UserProfileCreate(BaseModel):
    name: Optional[str] = "Tajiri User"
    income_frequency: Optional[str] = "monthly"
    income_amount: Optional[float] = None
    salary: float = Field(..., gt=0, description="Monthly salary")
    other_income: float = Field(0.0, ge=0)
    currency: str = "KSh"
    location: Optional[LocationModel] = Field(default_factory=lambda: LocationModel(city="Nairobi", country="Kenya"))

class UserProfileResponse(BaseModel):
    user_id: str
    name: str
    income_frequency: Optional[str] = "monthly"
    income_amount: Optional[float] = None
    salary: float
    other_income: float
    total_income: float
    currency: str
    location: LocationModel
    created_at: str
    updated_at: str


class UserProfileUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    company: Optional[str] = None
    currency: Optional[str] = None
    salary: Optional[float] = None
    income_frequency: Optional[str] = None
    income_amount: Optional[float] = None
    city: Optional[str] = None
    country: Optional[str] = None
    avatar_url: Optional[str] = None
    personality: Optional[str] = None

