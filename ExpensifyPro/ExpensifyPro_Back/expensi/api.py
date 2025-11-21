from ninja import Router
from pydantic import BaseModel
from typing import List

from .gemini_client import ask_expensi

router = Router(tags=["Expensi"])


class ChatMessageIn(BaseModel):
    role: str       # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessageIn]


class ChatResponse(BaseModel):
    reply: str


@router.post("/chat", response=ChatResponse)
def expensi_chat(request, payload: ChatRequest):
    """
    Receives the conversation from the frontend,
    passes it to Expensi (Gemini),
    and returns the reply.
    """
    reply = ask_expensi([m.dict() for m in payload.messages])
    return ChatResponse(reply=reply)
