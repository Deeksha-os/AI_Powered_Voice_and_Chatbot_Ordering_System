import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Location = {
  latitude?: number | null;
  longitude?: number | null;
  status?: string;
  updated_at?: string | null;
} | null;

const OrderTracking = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<string>("Loading...");
  const [location, setLocation] = useState<Location>(null);
  const [items, setItems] = useState<Array<{product_id:number; product_name:string; quantity:number; price:number}>>([]);
  const [total, setTotal] = useState<number>(0);
  const [address, setAddress] = useState<string>("");
  const [custName, setCustName] = useState<string>("");
  const [custPhone, setCustPhone] = useState<string>("");

  const load = async () => {
    if (!orderId) return;
    try {
      const res = await fetch(`/api/order-status/${orderId}`);
      const data = await res.json();
      if (res.ok) {
        setStatus(data.status || "Unknown");
        setLocation(data.location || null);
        setItems(data.items || []);
        setTotal(data.total || 0);
        setAddress(data.address || "");
        setCustName(data.customer_name || "");
        setCustPhone(data.customer_phone || "");
      } else {
        setStatus(data?.error || "Not found");
      }
    } catch (e) {
      setStatus("Error fetching status");
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [orderId]);

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto">
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle>Order Tracking</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Order</div>
                <div className="font-semibold">#{orderId}</div>
              </div>
              <Badge variant="outline" className="capitalize">{status}</Badge>
            </div>

            {(custName || custPhone || address) && (
              <div className="border rounded-md p-3 space-y-1">
                <div className="text-sm text-muted-foreground mb-1">Delivery Details</div>
                {custName && <div className="text-sm">Name: {custName}</div>}
                {custPhone && <div className="text-sm">Phone: {custPhone}</div>}
                {address && <div className="text-sm">Address: {address}</div>}
              </div>
            )}

            <div className="border rounded-md p-3">
              <div className="text-sm text-muted-foreground mb-1">Courier Location</div>
              {location?.latitude && location?.longitude ? (
                <div className="text-sm">
                  Lat: {location.latitude}, Lng: {location.longitude}
                  {location.updated_at && (
                    <div className="text-xs text-muted-foreground mt-1">Updated: {new Date(location.updated_at).toLocaleString()}</div>
                  )}
                  <div className="mt-2">
                    <a
                      className="text-primary underline text-sm"
                      href={`https://www.google.com/maps?q=${location.latitude},${location.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open in Google Maps
                    </a>
                  </div>
                </div>
              ) : (
                <div className="text-sm">Not available yet.</div>
              )}
            </div>

            {items && items.length > 0 && (
              <div className="border rounded-md p-3">
                <div className="text-sm text-muted-foreground mb-2">Items</div>
                <div className="space-y-1">
                  {items.map((it, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <div>{it.product_name} × {it.quantity}</div>
                      <div>₹{it.price * it.quantity}</div>
                    </div>
                  ))}
                </div>
                <div className="border-t mt-2 pt-2 flex justify-between font-semibold">
                  <span>Total</span>
                  <span>₹{total}</span>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate("/customer")}>Back to Shop</Button>
              <Button onClick={load}>Refresh</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default OrderTracking;


