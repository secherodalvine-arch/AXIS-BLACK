from pydantic import BaseModel, Field


class SupportMessageRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: str = Field(..., min_length=5, max_length=255)
    message: str = Field(..., min_length=5, max_length=4000)
    subject: str = Field(default="Support Message", max_length=140)
    label: str = Field(default="support", max_length=40)


class SupportMessageResponse(BaseModel):
    message: str
    label: str
