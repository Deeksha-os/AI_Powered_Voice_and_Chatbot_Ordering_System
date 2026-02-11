import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  QrCode, 
  CreditCard, 
  Smartphone, 
  Banknote, 
  Scan,
  CheckCircle,
  XCircle,
  Loader2,
  Camera
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type CartMap = { [id: number]: number };

const mockProducts = [
  { id: 1, name: "Fresh Tomatoes", price: 40, unit: "per kg" },
  { id: 2, name: "Organic Spinach", price: 30, unit: "per bunch" },
  { id: 3, name: "Sweet Bananas", price: 60, unit: "per dozen" },
  { id: 4, name: "Fresh Apples", price: 120, unit: "per kg" },
  { id: 5, name: "Whole Milk", price: 65, unit: "per litre" },
  { id: 6, name: "Greek Yogurt", price: 45, unit: "per cup" },
  { id: 7, name: "Basmati Rice", price: 85, unit: "per kg" },
  { id: 8, name: "Wheat Flour", price: 42, unit: "per kg" },
];

const Checkout = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cart, setCart] = useState<CartMap>({});
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "online" | "qr" | "card">("online");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<"pending" | "success" | "failed">("pending");
  const [upiId, setUpiId] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");

  useEffect(() => {
    try {
      const uRaw = localStorage.getItem("user");
      const u = uRaw ? JSON.parse(uRaw) : null;
      const cartKey = `cart:${u?.email || "guest"}`;
      const raw = localStorage.getItem(cartKey);
      if (raw) setCart(JSON.parse(raw));
      const addr = localStorage.getItem("addr");
      if (addr) setAddress(addr);
      const nm = localStorage.getItem("name");
      const ph = localStorage.getItem("phone");
      // Prefer current logged-in user's profile; fallback to saved values
      if (u?.name) setName(u.name); else if (nm) setName(nm);
      if (u?.phone) setPhone(u.phone); else if (ph) setPhone(ph);
    } catch {}
  }, []);

  const items = useMemo(() => Object.entries(cart).map(([id, qty]) => {
    const product = mockProducts.find(p => p.id === parseInt(id));
    return product ? { ...product, quantity: qty as number } : null;
  }).filter(Boolean) as Array<{id:number; name:string; price:number; unit:string; quantity:number}> , [cart]);

  const total = useMemo(() => items.reduce((sum, it) => sum + it.price * it.quantity, 0), [items]);

  // QR Code Scanner Functions
  const startScanning = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsScanning(true);
        scanQRCode();
      }
    } catch (err) {
      toast({
        title: "Camera Error",
        description: "Unable to access camera for QR scanning",
        variant: "destructive",
      });
    }
  };

  const stopScanning = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
  };

  const scanQRCode = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    const scan = () => {
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Simple QR code detection simulation
        // In a real app, you'd use a library like jsQR or qr-scanner
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const qrCode = detectQRCode(imageData);
        
        if (qrCode) {
          setScanResult(qrCode);
          stopScanning();
          processQRPayment(qrCode);
        } else if (isScanning) {
          requestAnimationFrame(scan);
        }
      } else if (isScanning) {
        requestAnimationFrame(scan);
      }
    };

    scan();
  };

  // Enhanced QR code detection for payment QR codes
  const detectQRCode = (imageData: ImageData): string | null => {
    // This is a mock implementation for demo purposes
    // In a real app, you'd use a library like jsQR or qr-scanner
    const data = imageData.data;
    let hasPattern = false;
    let qrCodeData = "";
    
    // Simulate detection of UPI QR codes
    // Look for patterns that might indicate a QR code
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] < 50 && data[i + 1] < 50 && data[i + 2] < 50) {
        hasPattern = true;
        break;
      }
    }
    
    if (hasPattern) {
      // Simulate different types of payment QR codes
      const qrTypes = [
        `upi://pay?pa=freshmarket@paytm&pn=FreshMarket&am=${total}&cu=INR&tn=Order Payment`,
        `upi://pay?pa=freshmarket@ybl&pn=FreshMarket&am=${total}&cu=INR&tn=Order Payment`,
        `upi://pay?pa=freshmarket@okaxis&pn=FreshMarket&am=${total}&cu=INR&tn=Order Payment`,
        `upi://pay?pa=freshmarket@paytm&pn=FreshMarket&am=${total}&cu=INR&tn=Order Payment&tr=ORDER${Date.now()}`,
      ];
      
      // Randomly select a QR code type for demo
      const randomIndex = Math.floor(Math.random() * qrTypes.length);
      qrCodeData = qrTypes[randomIndex];
    }
    
    return qrCodeData || null;
  };

  const processQRPayment = async (qrData: string) => {
    setPaymentStatus("pending");
    
    // Parse UPI QR code data
    const upiData = parseUPIQR(qrData);
    
    toast({
      title: "QR Code Detected",
      description: `Processing payment to ${upiData.merchantName}...`,
    });

    try {
      // Simulate payment processing with realistic delays
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const response = await fetch("/api/payment/scan-qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          qr_data: qrData, 
          order_id: `order_${Date.now()}`,
          amount: upiData.amount
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setPaymentStatus("success");
        toast({
          title: "Payment Successful!",
          description: `₹${upiData.amount} paid to ${upiData.merchantName}`,
        });
        // Proceed with order placement
        placeOrder();
      } else {
        setPaymentStatus("failed");
        toast({
          title: "Payment Failed",
          description: data.error || "Payment could not be processed. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      setPaymentStatus("failed");
      toast({
        title: "Payment Failed",
        description: "Network error. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Parse UPI QR code data
  const parseUPIQR = (qrData: string) => {
    try {
      const url = new URL(qrData);
      const params = new URLSearchParams(url.search);
      
      return {
        merchantName: params.get('pn') || 'Merchant',
        amount: params.get('am') || total.toString(),
        currency: params.get('cu') || 'INR',
        transactionNote: params.get('tn') || 'Payment',
        upiId: params.get('pa') || 'merchant@upi'
      };
    } catch (error) {
      return {
        merchantName: 'Merchant',
        amount: total.toString(),
        currency: 'INR',
        transactionNote: 'Payment',
        upiId: 'merchant@upi'
      };
    }
  };

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, []);

  // Generate dynamic UPI QR when selecting Online or when total changes
  useEffect(() => {
    const generateUPIQR = async () => {
      if (paymentMethod !== "online") return;
      try {
        const resp = await fetch("/api/payment/upi-qr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: total, order_id: `order_${Date.now()}` })
        });
        if (resp.ok) {
          const data = await resp.json();
          if (data?.qr_url) {
            setQrCodeUrl(data.qr_url);
            return;
          }
        }
      } catch {}
      const upiString = `upi://pay?pa=freshmarket@paytm&pn=FreshMarket&am=${total}&cu=INR&tn=Order%20Payment`;
      setQrCodeUrl(`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiString)}`);
    };
    generateUPIQR();
  }, [paymentMethod, total]);

  const placeOrder = async () => {
    setSubmitting(true);
    setError(null);
    try {
      localStorage.setItem("name", name);
      localStorage.setItem("phone", phone);
      localStorage.setItem("addr", address);

      const res = await fetch("/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cart, address, name, phone, total, paymentMethod, upiId })
      });
      const text = await res.text();
      let data: any = {};
      try { data = text ? JSON.parse(text) : {}; } catch {}
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || text || `HTTP ${res.status}`);
      }

      if (paymentMethod === "cod") {
        try {
          const uRaw = localStorage.getItem("user");
          const u = uRaw ? JSON.parse(uRaw) : null;
          const key = `lastOrderId:${u?.email || "guest"}`;
          localStorage.setItem(key, String(data.internalOrderId));
        } catch {}
        localStorage.removeItem("cart");
        setCart({});
        navigate(`/customer/success/${data.internalOrderId}`);
        return;
      }

      // For QR payments, the payment is already processed
      if (paymentMethod === "qr" && paymentStatus === "success") {
        try {
          const uRaw = localStorage.getItem("user");
          const u = uRaw ? JSON.parse(uRaw) : null;
          const key = `lastOrderId:${u?.email || "guest"}`;
          localStorage.setItem(key, String(data.internalOrderId));
        } catch {}
        localStorage.removeItem("cart");
        setCart({});
        navigate(`/customer/success/${data.internalOrderId}`);
        return;
      }

      if (data.testMode) {
        try {
          const uRaw = localStorage.getItem("user");
          const u = uRaw ? JSON.parse(uRaw) : null;
          const key = `lastOrderId:${u?.email || "guest"}`;
          localStorage.setItem(key, String(data.internalOrderId));
        } catch {}
        localStorage.removeItem("cart");
        setCart({});
        navigate(`/customer/success/${data.internalOrderId}`);
        return;
      }

      const options: any = {
        key: data.keyId,
        amount: Math.round(data.amount * 100),
        currency: "INR",
        name: "FreshMarket",
        description: "Order Payment",
        order_id: data.orderId,
        prefill: {
          name,
          contact: phone,
        },
        notes: {},
        handler: async function (resp: any) {
          try {
            const verifyRes = await fetch("/api/verify-payment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: resp.razorpay_order_id,
                razorpay_payment_id: resp.razorpay_payment_id,
                razorpay_signature: resp.razorpay_signature,
              })
            });
            const verifyText = await verifyRes.text();
            let verifyData: any = {};
            try { verifyData = verifyText ? JSON.parse(verifyText) : {}; } catch {}
            if (verifyRes.ok && verifyData.success) {
              try { localStorage.setItem("lastOrderId", String(data.internalOrderId)); } catch {}
              localStorage.removeItem("cart");
              setCart({});
              navigate(`/customer/success/${data.internalOrderId}`);
            } else {
              throw new Error(verifyData?.error || verifyText || `HTTP ${verifyRes.status}`);
            }
          } catch (e: any) {
            setError(e.message);
          }
        },
        theme: { color: "#16a34a" }
      };
      // For Card tab, explicitly open Razorpay only when Card is selected
      if (paymentMethod === "card" || paymentMethod === "online") {
      // @ts-ignore
      const rzp = new (window as any).Razorpay(options);
      rzp.open();
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle>Delivery Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input placeholder="Full Name" value={name} onChange={e => setName(e.target.value)} />
              <Input placeholder="Phone Number" value={phone} onChange={e => setPhone(e.target.value)} />
              <Input placeholder="Full Address" value={address} onChange={e => setAddress(e.target.value)} />
            </CardContent>
          </Card>

          <Card className="shadow-soft mt-6">
            <CardHeader>
              <CardTitle>Payment Method</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as any)}>
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="online" className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Online
                  </TabsTrigger>
                  <TabsTrigger value="qr" className="flex items-center gap-2">
                    <QrCode className="h-4 w-4" />
                    QR Scan
                  </TabsTrigger>
                  <TabsTrigger value="card" className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Card
                  </TabsTrigger>
                  <TabsTrigger value="cod" className="flex items-center gap-2">
                    <Banknote className="h-4 w-4" />
                    COD
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="online" className="space-y-4 mt-4">
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                      <div className="text-center p-4 border rounded-lg bg-white">
                        {qrCodeUrl ? (
                          <img src={qrCodeUrl} alt="UPI QR Code" className="mx-auto border rounded-md" />
                        ) : (
                          <div className="w-48 h-48 mx-auto border rounded-md flex items-center justify-center bg-muted">
                            <Loader2 className="h-8 w-8 animate-spin" />
                          </div>
                        )}
                        <p className="text-sm text-muted-foreground mt-2">Scan with any UPI app</p>
                        <p className="text-xs text-muted-foreground">Amount: ₹{total}</p>
                      </div>
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <p>Open any UPI app (GPay, PhonePe, Paytm) and scan the QR to pay.</p>
                        <p>Prefer cards? Switch to the Card tab to pay with credit/debit card.</p>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="card" className="space-y-4 mt-4">
                  <div className="space-y-3">
                    <Input 
                      placeholder="Card Number" 
                      value={cardNumber} 
                      onChange={(e) => setCardNumber(e.target.value)}
                      maxLength={19}
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <Input 
                        placeholder="MM/YY" 
                        value={cardExpiry} 
                        onChange={(e) => setCardExpiry(e.target.value)}
                        maxLength={5}
                      />
                      <Input 
                        placeholder="CVV" 
                        value={cardCvv} 
                        onChange={(e) => setCardCvv(e.target.value)}
                        maxLength={4}
                        type="password"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">You will complete payment securely via Razorpay.</p>
                  </div>
                </TabsContent>

                <TabsContent value="qr" className="space-y-4 mt-4">
                  <div className="space-y-4">
                    {!isScanning ? (
                      <div className="text-center space-y-6">
                        <div className="bg-gradient-to-br from-blue-50 to-green-50 p-6 rounded-xl border">
                          <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-blue-500 to-green-500 rounded-full flex items-center justify-center">
                            <QrCode className="h-8 w-8 text-white" />
                          </div>
                          <h3 className="text-lg font-semibold mb-2">Scan QR Code to Pay</h3>
                          <p className="text-sm text-muted-foreground mb-4">
                            Point your camera at any UPI QR code to pay instantly
                          </p>
                          <div className="bg-white p-3 rounded-lg border mb-4">
                            <p className="text-sm font-medium text-gray-700">Amount to Pay</p>
                            <p className="text-2xl font-bold text-green-600">₹{total}</p>
                          </div>
                          <Button onClick={startScanning} className="w-full bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600 text-white">
                            <Scan className="h-4 w-4 mr-2" />
                            Start Scanning
                          </Button>
                        </div>
                        <div className="text-xs text-muted-foreground space-y-1">
                          <p>• Works with Google Pay, PhonePe, Paytm, and other UPI apps</p>
                          <p>• Ensure good lighting and steady hands for best results</p>
                        </div>
                        
                        {/* Demo QR Code for Testing */}
                        <div className="mt-6 p-4 bg-gray-50 rounded-lg border">
                          <p className="text-sm font-medium mb-2">Demo QR Code (for testing)</p>
                          <div className="text-center">
                            <img 
                              src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`upi://pay?pa=freshmarket@paytm&pn=FreshMarket&am=${total}&cu=INR&tn=Order Payment`)}`}
                              alt="Demo QR Code" 
                              className="mx-auto border rounded-lg"
                            />
                            <p className="text-xs text-muted-foreground mt-2">
                              Scan this QR code to test the payment flow
                            </p>
                            <Button 
                              onClick={() => {
                                const demoQR = `upi://pay?pa=freshmarket@paytm&pn=FreshMarket&am=${total}&cu=INR&tn=Order Payment`;
                                processQRPayment(demoQR);
                              }}
                              variant="outline" 
                              size="sm" 
                              className="mt-2"
                            >
                              Simulate QR Scan
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="relative bg-black rounded-xl overflow-hidden">
                          <video 
                            ref={videoRef} 
                            autoPlay 
                            playsInline 
                            className="w-full h-80 object-cover"
                          />
                          <canvas ref={canvasRef} className="hidden" />
                          
                          {/* Scanning overlay */}
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-64 h-64 border-2 border-white rounded-lg relative">
                              {/* Corner markers */}
                              <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-white rounded-tl-lg"></div>
                              <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-white rounded-tr-lg"></div>
                              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-white rounded-bl-lg"></div>
                              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-white rounded-br-lg"></div>
                              
                              {/* Scanning line animation */}
                              <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-green-400 animate-pulse"></div>
                            </div>
                          </div>
                          
                          {/* Instructions */}
                          <div className="absolute bottom-4 left-4 right-4 bg-black/70 text-white p-3 rounded-lg">
                            <p className="text-sm font-medium text-center">Position QR code within the frame</p>
                          </div>
                        </div>
                        
                        <div className="flex gap-2">
                          <Button onClick={stopScanning} variant="outline" className="flex-1">
                            <XCircle className="h-4 w-4 mr-2" />
                            Cancel
                          </Button>
                          <Button onClick={startScanning} variant="outline" className="flex-1">
                            <Scan className="h-4 w-4 mr-2" />
                            Rescan
                          </Button>
                        </div>
                      </div>
                    )}
                    
                    {scanResult && (
                      <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-center gap-2 text-green-800">
                          <CheckCircle className="h-4 w-4" />
                          <span className="font-medium">QR Code Detected</span>
                        </div>
                        <div className="mt-2 space-y-1">
                          <p className="text-sm text-green-700">
                            Processing payment to {parseUPIQR(scanResult).merchantName}...
                          </p>
                          <p className="text-xs text-green-600">
                            Amount: ₹{parseUPIQR(scanResult).amount}
                          </p>
                        </div>
                      </div>
                    )}

                    {paymentStatus === "success" && (
                      <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-center gap-2 text-green-800">
                          <CheckCircle className="h-4 w-4" />
                          <span className="font-medium">Payment Successful!</span>
                        </div>
                      </div>
                    )}

                    {paymentStatus === "failed" && (
                      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                        <div className="flex items-center gap-2 text-red-800">
                          <XCircle className="h-4 w-4" />
                          <span className="font-medium">Payment Failed</span>
                        </div>
                        <p className="text-sm text-red-700 mt-1">
                          Please try scanning again or use another payment method.
                        </p>
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="cod" className="space-y-4 mt-4">
                  <div className="text-center space-y-2">
                    <Banknote className="h-12 w-12 mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Pay with cash when your order is delivered
                    </p>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {error && (
            <div className="text-sm text-red-600 mt-4">{error}</div>
          )}
        </div>

        <div className="lg:col-span-1">
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {items.map(it => (
                <div key={it.id} className="flex justify-between text-sm">
                  <div>
                    <div className="font-medium">{it.name}</div>
                    <div className="text-muted-foreground">x{it.quantity}</div>
                  </div>
                  <div>₹{it.price * it.quantity}</div>
                </div>
              ))}
              <div className="border-t pt-2 flex justify-between font-bold">
                <span>Total</span>
                <span>₹{total}</span>
              </div>
              <Button 
                className="w-full mt-2" 
                disabled={
                  submitting ||
                  items.length === 0 ||
                  (paymentMethod !== "cod" && (!name || !phone || !address)) ||
                  (paymentMethod === "qr" && paymentStatus !== "success") ||
                  (paymentMethod === "card" && (!cardNumber || !cardExpiry || !cardCvv))
                } 
                onClick={placeOrder}
              >
                {submitting ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing...
                  </div>
                ) : (
                  <>
                    {paymentMethod === "cod" && "Place Order (COD)"}
                    {paymentMethod === "online" && "Pay with UPI / Card"}
                    {paymentMethod === "card" && "Pay with Card"}
                    {paymentMethod === "qr" && paymentStatus === "success" && "Complete Order"}
                    {paymentMethod === "qr" && paymentStatus !== "success" && "Scan QR Code First"}
                  </>
                )}
              </Button>
              <Button variant="outline" className="w-full" onClick={() => navigate("/customer")}>Back to Shop</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Checkout;


