from datetime import datetime


from uuid import UUID


from sqlalchemy import Column, String, Integer, Boolean, Text, TIMESTAMP, Date, DECIMAL                                                                                                                                                                                                                                                       
from sqlalchemy.dialects.postgresql import UUID, JSONB                                                                                                                                                                                                                                                                                        
from sqlalchemy.sql import func                                                                                                                                                                                                                                                                                                               
import uuid

from app.database import Base

class User(Base):
    __tablename__ = "users" # we do this so that sqlalchemy knows what table to use

    id = Column[UUID](UUID[UUID](as_uuid=True), primary_key=True, default=uuid.uuid4)
    clerk_id = Column[str](String(255), unique=True, nullable=False)
    email = Column[str](String(255), unique=True, nullable=False)
    name = Column[str](String(255), nullable=False)
    bio = Column[str](Text)
    avatar_url = Column[str](String(500))

    # Onboarding fields
    role_intent = Column[str](String(50))  # founder, cofounder, early_employee
    stage_preference = Column[str](String(50))  # idea, mvp, revenue, growth
    commitment = Column[str](String(50))  # full_time, part_time, exploratory
    location = Column[str](String(255))
    working_style = Column[str](String(50))  # structured, chaotic, flexible
    communication_preference = Column[str](String(50))  # async, sync, mixed
    experience_years = Column[int](Integer)
    previous_startups = Column[int](Integer)
    github_url = Column[str](String(500))
    portfolio_url = Column[str](String(500))
    linkedin_url = Column[str](String(500))

    created_at = Column[datetime](TIMESTAMP, default=func.now())
    updated_at = Column[datetime](TIMESTAMP, default=func.now(), onupdate=func.now())

    def __repr__(self):
        return f"<User {self.name}>"