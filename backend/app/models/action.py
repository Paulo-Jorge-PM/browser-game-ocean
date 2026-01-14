from datetime import datetime
from typing import Optional, Literal, Any
from pydantic import BaseModel, Field


ActionType = Literal["build", "upgrade", "research", "send_troops", "diplomacy"]
ActionStatus = Literal["pending", "in_progress", "completed", "cancelled", "failed"]


class ActionData(BaseModel):
    """Flexible data structure for different action types."""

    # Build actions
    base_type: Optional[str] = None
    position: Optional[dict[str, int]] = None  # {x: int, y: int}
    base_id: Optional[str] = None

    # Research actions
    tech_id: Optional[str] = None

    # Troops actions
    troop_type: Optional[str] = None
    troop_count: Optional[int] = None
    target_city_id: Optional[str] = None
    target_position: Optional[dict[str, int]] = None

    # Generic metadata
    extra: Optional[dict[str, Any]] = None


class PendingAction(BaseModel):
    """Model for actions currently in progress."""

    id: Optional[str] = None  # Set after insert
    city_id: str
    player_id: str
    action_type: ActionType
    started_at: datetime
    ends_at: datetime
    duration_seconds: int
    data: ActionData
    status: ActionStatus = "in_progress"
    created_at: datetime = Field(default_factory=lambda: datetime.now())


class CompletedAction(BaseModel):
    """Model for completed actions (audit trail)."""

    id: Optional[str] = None
    original_action_id: str
    city_id: str
    player_id: str
    action_type: ActionType
    started_at: datetime
    completed_at: datetime
    duration_seconds: int
    data: ActionData
    result: Optional[dict[str, Any]] = None  # What changed


class ActionStartRequest(BaseModel):
    """Request to start a new action."""

    city_id: str
    action_type: ActionType
    data: ActionData


class ActionCompleteRequest(BaseModel):
    """Request to complete an action."""

    action_id: str


class ActionCompleteResponse(BaseModel):
    """Response from action completion attempt."""

    status: Literal["completed", "pending", "failed"]
    remaining_seconds: Optional[int] = None
    error: Optional[str] = None
    # Included when status is "completed"
    action_id: Optional[str] = None
    completed_at: Optional[datetime] = None


class PendingActionResponse(BaseModel):
    """Response format for pending actions."""

    action_id: str
    action_type: ActionType
    started_at: datetime
    ends_at: datetime
    duration_seconds: int
    data: ActionData
    status: ActionStatus
