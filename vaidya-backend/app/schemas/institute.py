from typing import Optional, List
from pydantic import BaseModel, EmailStr


class AddStudentRequest(BaseModel):
    email: EmailStr
    first_name: str
    last_name: str
    phone: Optional[str] = None
    batch_id: Optional[str] = None


class AddFacultyRequest(BaseModel):
    email: EmailStr
    first_name: str
    last_name: str
    phone: Optional[str] = None
    subjects: Optional[List[str]] = None


class CreateBatchRequest(BaseModel):
    name: str
    description: Optional[str] = None
    faculty_id: Optional[str] = None
    student_ids: Optional[List[str]] = None


class BulkStudentImportResult(BaseModel):
    total_rows: int
    successful: int
    failed: int
    errors: List[dict]


class UserResponse(BaseModel):
    id: str
    email: str
    first_name: Optional[str]
    last_name: Optional[str]
    phone: Optional[str]
    role: str
    is_active: bool
    model_config = {"from_attributes": True}


class BatchResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    faculty_id: Optional[str]
    model_config = {"from_attributes": True}