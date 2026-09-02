"""
models/auth.py — Pydantic request/response models for authentication endpoints.
"""
from pydantic import BaseModel, Field
from typing import Optional


class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=2, description="Full name")
    email: str = Field(..., description="Email address used to log in")
    password: str = Field(..., min_length=6, description="Password (min 6 characters)")
    income_frequency: str = Field("monthly", description="daily, weekly, or monthly")
    income_amount: Optional[float] = Field(None, description="Amount per frequency period")
    salary: float = Field(..., gt=0, description="Monthly salary (calculated or direct)")
    city: str = Field("Nairobi", description="City / town")
    country: str = Field("Kenya", description="Country")
    currency: str = Field("USD", description="Currency code")


class RegisterResponse(BaseModel):
    message: str
    email: str
    requires_verification: bool = True


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: Optional[str] = None
    token_type: str = "bearer"
    user_id: str
    name: str
    email: str


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=6, description="New password (min 6 chars)")


class SocialLoginRequest(BaseModel):
    provider: str = Field(..., description="google or github")
    provider_id: str = Field(..., description="Unique provider ID")
    email: str
    name: str
    income_frequency: Optional[str] = "monthly"
    income_amount: Optional[float] = 50000.0
    salary: Optional[float] = 50000.0
    city: Optional[str] = "Nairobi"
    currency: Optional[str] = "USD"


class SendOTPRequest(BaseModel):
    email: str
    purpose: str = Field("verification", description="verification, reset_password, or signup")


class VerifyOTPRequest(BaseModel):
    email: str
    otp_code: str = Field(..., min_length=4, max_length=10, description="OTP code")
    purpose: str = Field("verification", description="purpose of OTP verification")


class ResetPasswordOTPRequest(BaseModel):
    email: str
    otp_code: str = Field(..., min_length=4, max_length=10, description="OTP code")
    new_password: str = Field(..., min_length=6, description="New password (min 6 chars)")


class VerifyEmailRequest(BaseModel):
    token: str = Field(..., description="Email verification token from the link")


class ResendVerificationRequest(BaseModel):
    email: str = Field(..., description="Email address to resend verification to")


class ResendResetOtpRequest(BaseModel):
    email: str = Field(..., description="Email address to resend password reset OTP to")
