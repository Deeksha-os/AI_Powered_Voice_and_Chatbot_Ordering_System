import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const OrderSuccess = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-xl mx-auto">
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle>Order Placed Successfully</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>Your order has been placed.</div>
            <div className="text-sm text-muted-foreground">Order ID: #{orderId}</div>
            <div className="flex gap-2">
              <Button onClick={() => navigate(`/customer/track/${orderId}`)}>Track Order</Button>
              <Button variant="outline" onClick={() => navigate("/customer")}>Continue Shopping</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default OrderSuccess;


