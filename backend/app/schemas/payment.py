from pydantic import BaseModel


class CreateOrderResponse(BaseModel):
    order_id: str
    amount: int


class VerifyPaymentResponse(BaseModel):
    status: str
    weightage_granted: int
