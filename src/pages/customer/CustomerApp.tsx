import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { formatIST } from "@/utils/dateUtils";
import {
  ShoppingCart,
  Search,
  Mic,
  MessageSquare,
  Plus,
  Minus,
  Leaf,
  ArrowLeft,
  User,
  MicOff,
  LogOut
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AudioAssistant } from "@/components/AudioAssistant";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";

type Product = { id:number; name:string; price:number; unit:string; category:string; stock:number; image?:string };

const categories = ["All", "Vegetables", "Fruits", "Dairy", "Staples"];

const CustomerApp = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [cart, setCart] = useState<{[key: number]: number}>({});
  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [isVoiceSearching, setIsVoiceSearching] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [orderLookupId, setOrderLookupId] = useState("");
  const [orderInfo, setOrderInfo] = useState<any>(null);
  const [orderLoading, setOrderLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const {
    transcript,
    isListening,
    startListening,
    stopListening,
    resetTranscript,
    browserSupportsSpeechRecognition,
  } = useSpeechRecognition();

  useEffect(() => {
    // fetch products from backend
    (async () => {
      try {
        const res = await fetch("/api/products");
        const data = await res.json();
        if (Array.isArray(data)) setProducts(data as Product[]);
      } catch {}
    })();
  }, []);

  // Load signed-in user info and cart from localStorage
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  useEffect(() => {
    try {
      const u = localStorage.getItem("user");
      const parsedUser = u ? JSON.parse(u) : null;
      if (parsedUser) setUser(parsedUser);
      
      // Load cart per-user from localStorage
      const cartKey = `cart:${parsedUser?.email || "guest"}`;
      const savedCart = localStorage.getItem(cartKey);
      if (savedCart) {
        const parsedCart = JSON.parse(savedCart);
        setCart(parsedCart);
      }
      setIsInitialLoad(false);
    } catch {}
  }, []);

  // Sync cart to localStorage whenever it changes (but not on initial load)
  useEffect(() => {
    if (!isInitialLoad) {
      try {
        const u = localStorage.getItem("user");
        const parsedUser = u ? JSON.parse(u) : null;
        const cartKey = `cart:${parsedUser?.email || "guest"}`;
        localStorage.setItem(cartKey, JSON.stringify(cart));
      } catch {}
    }
  }, [cart, isInitialLoad]);

  const fetchOrder = async (idOrRazorId: string) => {
    if (!idOrRazorId) return;
    setOrderLoading(true);
    setOrderInfo(null);
    try {
      const currentUser = (() => { try { return JSON.parse(localStorage.getItem("user") || "null"); } catch { return null; } })();
      const params = new URLSearchParams();
      if (currentUser?.name) params.set("name", currentUser.name);
      if (currentUser?.phone) params.set("phone", currentUser.phone);
      const res = await fetch(`/api/order-status/${encodeURIComponent(idOrRazorId)}?${params.toString()}`);
      const data = await res.json();
      if (!res.ok || data?.error) throw new Error(data?.error || "Failed to fetch order");
      setOrderInfo(data);
    } catch (e:any) {
      setOrderInfo({ error: e.message });
    } finally {
      setOrderLoading(false);
    }
  };

  const filteredProducts = products.filter(product => {
    const matchesCategory = selectedCategory === "All" ||
      product.category === selectedCategory.toLowerCase();
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const addToCart = async (productId: number) => {
    try {
      const res = await fetch("/api/cart/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: productId, quantity: 1 })
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        // Show a friendly message when stock is insufficient
        toast({ title: "Out of stock", description: data?.error || "Insufficient stock", variant: "destructive" });
        return;
      }

      setCart(prev => {
        const next = { ...prev, [productId]: (prev[productId] || 0) + 1 };
        try {
          const u = localStorage.getItem("user");
          const parsedUser = u ? JSON.parse(u) : null;
          const cartKey = `cart:${parsedUser?.email || "guest"}`;
          localStorage.setItem(cartKey, JSON.stringify(next));
        } catch {}
        return next;
      });

      // reflect new stock in UI
      setProducts(prev => prev.map(p => p.id === productId ? { ...p, stock: data.product.stock } : p));

      toast({ title: "Added to cart", description: `${data.product.name} added to cart` });
      if (data.product.stock === 0) {
        toast({ title: "Stock Alert", description: `${data.product.name} is now out of stock` });
      }
    } catch (e:any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const bulkAddToCart = async (items: Array<{productId: number, quantity: number}>) => {
    try {
      console.log("Bulk adding items:", items);
      const res = await fetch("/api/cart/bulk-add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          items: items.map(item => ({ 
            product_id: item.productId, 
            quantity: item.quantity 
          }))
        })
      });
      const data = await res.json();
      console.log("Bulk add response:", data);
      
      if (!res.ok || !data?.success) {
        const errorMsg = data?.error || data?.errors?.join(", ") || "Failed to add items to cart";
        toast({ 
          title: "Bulk Add Failed", 
          description: errorMsg, 
          variant: "destructive" 
        });
        return;
      }
      
      // Check for partial success (some items added, some failed)
      if (data?.partial_success && data?.errors?.length > 0) {
        toast({
          title: "Some items couldn't be added",
          description: data.errors.join(", "),
          variant: "default"
        });
      }

      // Update cart state
      setCart(prev => {
        const newCart = { ...prev };
        data.results.forEach((result: any) => {
          const productId = result.product_id;
          newCart[productId] = (newCart[productId] || 0) + result.quantity;
        });
        try {
          localStorage.setItem("cart", JSON.stringify(newCart));
        } catch {}
        return newCart;
      });

      // Update product stock in UI
      setProducts(prev => prev.map(p => {
        const updatedProduct = data.results.find((r: any) => r.product_id === p.id);
        return updatedProduct ? { ...p, stock: updatedProduct.product.stock } : p;
      }));

      const itemNames = data.results.map((r: any) => r.product.name).join(', ');
      // Only show success toast if not partial_success (we already showed a warning)
      if (!data?.partial_success) {
        toast({ 
          title: "Items Added", 
          description: `Added ${data.items_added} items: ${itemNames}` 
        });
      }

    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const removeFromCart = async (productId: number) => {
    try {
      const res = await fetch("/api/cart/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: productId, quantity: 1 })
      });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.error || "Failed to remove from cart");

      setCart(prev => {
        const newCart = { ...prev } as any;
        if (newCart[productId] > 1) newCart[productId] -= 1; else delete newCart[productId];
        try {
          const u = localStorage.getItem("user");
          const parsedUser = u ? JSON.parse(u) : null;
          const cartKey = `cart:${parsedUser?.email || "guest"}`;
          localStorage.setItem(cartKey, JSON.stringify(newCart));
        } catch {}
        return newCart;
      });
      const prevProducts = (p: Product) => p;
      let becameAvailable = false;
      setProducts(prev => prev.map(p => {
        if (p.id === productId) {
          if (p.stock === 0 && data.product.stock > 0) becameAvailable = true;
          return { ...p, stock: data.product.stock };
        }
        return p;
      }));
      if (becameAvailable) {
        const name = data?.product?.name || "Item";
        toast({ title: "Back in stock", description: `${name} is available again` });
      }
    } catch (e:any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const getCartTotal = () => {
    return Object.entries(cart).reduce((total, [productId, quantity]) => {
      const product = products.find(p => p.id === parseInt(productId));
      return total + (product ? product.price * quantity : 0);
    }, 0);
  };

  const getCartItemCount = () => {
    return Object.values(cart).reduce((total, quantity) => total + quantity, 0);
  };

  const handleChatSubmit = () => {
    if (!chatInput.trim()) return;

    // Enhanced AI processing for multiple items
    toast({
      title: "AI Assistant Processing",
      description: "Analyzing your request for multiple items...",
    });

    // Parse multiple items from chat input (robust; up to 15)
    const parseMultipleItems = (input: string) => {
      const STOP_WORDS = new Set([
        'fresh','organic','whole','sweet','some','add','get','need','want','please','a','an','the','and','kg','dozen','cup','cups','litre','liter','per'
      ]);
      const singularize = (w: string) => {
        if (w.endsWith('ies')) return w.slice(0, -3) + 'y';
        if (w.endsWith('es')) return w.slice(0, -2);
        if (w.endsWith('s') && w.length > 3) return w.slice(0, -1);
        return w;
      };
      const tokenize = (text: string) => text
        .toLowerCase()
        .replace(/[^a-z\s\d]/g, ' ')
        .split(/\s+/)
        .map(singularize)
        .filter(t => t && !STOP_WORDS.has(t));

      // Split by separators with optional spaces (commas, and, &, plus, with, +)
      const parts = input.split(/\s*(?:,|\band\b|&|\+|\bplus\b|\bwith\b)\s*/i)
        .map(p => p.trim())
        .filter(Boolean);

      const aggregated: Record<number, number> = {};
      const unavailable: string[] = [];

      parts.forEach(part => {
        // Determine quantity
        let quantity = 1;
        const numericMatch = part.match(/(\d+)/);
        if (numericMatch) {
          quantity = parseInt(numericMatch[1]);
        } else {
          const quantityMap: Record<string, number> = {
            one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
            seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
          };
          const tokens = tokenize(part);
          for (const t of tokens) {
            if (quantityMap[t] !== undefined) { quantity = quantityMap[t]; break; }
          }
        }
        if (quantity < 1) quantity = 1;

        // Prepare tokens excluding numeric tokens and quantity words
        const partTokens = new Set(tokenize(part).filter(t => !/^\d+$/.test(t)));
        ['one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve'].forEach(q => partTokens.delete(q));

        // Score products by token overlap
        const scored = products.map(p => {
          const nameTokens = new Set(tokenize(p.name));
          let score = 0;
          nameTokens.forEach(t => { if (partTokens.has(t)) score += 1; });
          return { productId: p.id, score };
        }).sort((a,b) => b.score - a.score);

        const best = scored[0];
        if (best && best.score > 0) {
          aggregated[best.productId] = (aggregated[best.productId] || 0) + quantity;
        } else {
          unavailable.push(part);
        }
      });

      // Convert to array and cap to 15
      const items = Object.entries(aggregated).map(([pid, qty]) => ({ productId: parseInt(pid), quantity: qty }));
      return { items: items.slice(0, 15), unavailable };
    };

    const parsed = parseMultipleItems(chatInput);
    let itemsToAdd = parsed.items;
    if (parsed.unavailable.length > 0) {
      toast({ title: "Some items not available", description: parsed.unavailable.slice(0, 5).join(', ') });
    }
    
    if (itemsToAdd.length > 1) {
      // Use bulk add for multiple items
      bulkAddToCart(itemsToAdd);
      toast({
        title: "Multiple Items Added",
        description: `Added ${itemsToAdd.length} different items to your cart!`,
      });
    } else if (itemsToAdd.length === 1) {
      // Respect quantity for single item too
      bulkAddToCart(itemsToAdd);
      toast({
        title: "Item Added",
        description: `Added ${itemsToAdd[0].quantity} item(s) to your cart!`,
      });
    } else {
      // Nothing matched at all
      toast({ title: "Items Not Available", description: "No matching products were found.", variant: "destructive" });
    }

    setChatInput("");
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const searchQuery = transcript || searchTerm;
    if (searchQuery) {
      setSearchTerm(searchQuery);
      resetTranscript();
    }
    toast({
      title: "Search Results",
      description: `Found ${filteredProducts.length} products`,
    });
  };

  const toggleVoiceSearch = () => {
    if (isListening) {
      stopListening();
      setIsVoiceSearching(false);
    } else {
      startListening();
      setIsVoiceSearching(true);
      toast({
        title: "Voice Search Active",
        description: "Speak your product search...",
      });
    }
  };

  // Update search term when transcript changes
  useEffect(() => {
    if (transcript && isVoiceSearching) {
      setSearchTerm(transcript);
    }
  }, [transcript, isVoiceSearching]);

  const handleCheckout = async () => {
    const total = getCartTotal();
    if (total <= 0) return;
    try {
      const response = await fetch("/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cart, address: "", total })
      });
      const createText = await response.text();
      let data: any = {};
      try { data = createText ? JSON.parse(createText) : {}; } catch { /* ignore non-JSON */ }
      if (!response.ok || !data?.orderId || !data?.keyId) {
        const errMsg = data?.error || createText || `HTTP ${response.status}`;
        throw new Error(errMsg || "Failed to create payment order");
      }

      if (data.testMode) {
        // In test mode, payment is already marked Paid server-side.
        navigate(`/customer/track/${data.internalOrderId}`);
        return;
      }

      const options: any = {
        key: data.keyId,
        amount: Math.round(data.amount * 100),
        currency: "INR",
        name: "FreshMarket",
        description: "Order Payment",
        order_id: data.orderId,
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
            try { verifyData = verifyText ? JSON.parse(verifyText) : {}; } catch { /* ignore */ }
            if (verifyRes.ok && verifyData.success) {
              // redirect to tracking using internal order id
              navigate(`/customer/track/${data.internalOrderId}`);
            } else {
              const errMsg = verifyData?.error || verifyText || `HTTP ${verifyRes.status}`;
              throw new Error(errMsg || "Payment verification failed");
            }
          } catch (err: any) {
            toast({ title: "Payment error", description: err.message, variant: "destructive" });
          }
        },
        theme: { color: "#16a34a" }
      };
      // @ts-ignore
      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (err: any) {
      toast({ title: "Checkout failed", description: err.message, variant: "destructive" });
    }
  };

  const handleLogout = async () => {
    try {
      // Optional: Log logout activity to server
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      if (user.email) {
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            email: user.email, 
            name: user.name || user.email.split('@')[0], 
            role: user.role 
          })
        });
      }
    } catch (e) {
      // Ignore logout API errors
    }

    // Clear user data from localStorage
    localStorage.removeItem("user");
    localStorage.removeItem("isAuthenticated");
    localStorage.removeItem("cart");
    
    // Clear cart state
    setCart({});
    
    // Show success message
    toast({ 
      title: "Logged Out", 
      description: "You have been successfully logged out" 
    });
    
    // Navigate to home page
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-primary text-primary-foreground p-4 shadow-medium">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              onClick={() => navigate("/")}
              className="text-primary-foreground hover:bg-primary-light"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Home
            </Button>
            <div className="flex items-center">
              <Leaf className="h-8 w-8 mr-2" />
              <span className="text-2xl font-bold">FreshMarket</span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              onClick={handleLogout}
              className="text-primary-foreground hover:bg-primary-light"
            >
              <LogOut className="h-5 w-5 mr-2" />
              Logout
            </Button>
            <Badge variant="outline" className="text-xs">
              IST (UTC+5:30)
            </Badge>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" className="text-primary-foreground hover:bg-primary-light">
                  <User className="h-5 w-5 mr-2" />
                  Customer
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Customer Details</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Sign-in Info</CardTitle>
                      <CardDescription>Your current session details</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      {user ? (
                        <>
                          <div className="flex justify-between"><span className="text-muted-foreground">Name</span><span>{user.name || "-"}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span>{user.email || "-"}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Phone</span><span>{user.phone || "-"}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Role</span><span className="capitalize">{user.role || "-"}</span></div>
                        </>
                  ) : (
                    <div className="text-muted-foreground">Not signed in. Go to Customer Login to sign in.</div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Order Status</CardTitle>
                  <CardDescription>Lookup your latest order</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <Input
                      placeholder="Enter Order ID or Razorpay Order ID"
                      value={orderLookupId}
                      onChange={(e) => setOrderLookupId(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button 
                        onClick={() => {
                          try {
                            const uRaw = localStorage.getItem("user");
                            const u = uRaw ? JSON.parse(uRaw) : null;
                            const key = `lastOrderId:${u?.email || "guest"}`;
                            const last = localStorage.getItem(key);
                            if (!orderLookupId) return;
                            if (last && orderLookupId !== last) {
                              toast({ title: "Not your order", description: "You can only view your own latest order status.", variant: "destructive" });
                              return;
                            }
                            fetchOrder(orderLookupId);
                          } catch {
                            fetchOrder(orderLookupId);
                          }
                        }} 
                        disabled={orderLoading || !orderLookupId}
                      >
                        Fetch Status
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          try {
                            const uRaw = localStorage.getItem("user");
                            const u = uRaw ? JSON.parse(uRaw) : null;
                            const key = `lastOrderId:${u?.email || "guest"}`;
                            const last = localStorage.getItem(key);
                            if (last) {
                              setOrderLookupId(last);
                              fetchOrder(last);
                            }
                          } catch {}
                        }}
                      >
                        Use Last Order
                      </Button>
                    </div>
                  </div>

                  {orderLoading && <div className="text-sm text-muted-foreground">Loading...</div>}
                  {orderInfo && !orderInfo.error && (
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-muted-foreground">Order #</span><span>{orderInfo.id}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span>{orderInfo.status}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Total</span><span>₹{orderInfo.total}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Placed</span><span>{formatIST.orderTime(orderInfo.created_at)}</span></div>
                      {orderInfo.location && (
                        <div className="flex justify-between"><span className="text-muted-foreground">Stage</span><span>{orderInfo.location.status}</span></div>
                      )}
                    </div>
                  )}
                  {orderInfo?.error && (
                    <div className="text-sm text-red-600">{orderInfo.error}</div>
                  )}
                </CardContent>
              </Card>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="ghost" className="text-primary-foreground hover:bg-primary-light relative">
              <ShoppingCart className="h-6 w-6" />
              {getCartItemCount() > 0 && (
                <Badge className="absolute -top-2 -right-2 bg-secondary text-secondary-foreground">
                  {getCartItemCount()}
                </Badge>
              )}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Shopping Cart</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {getCartItemCount() === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Your cart is empty</p>
                </div>
              ) : (
                <>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {Object.entries(cart).map(([productId, quantity]) => {
                      const product = products.find(p => p.id === parseInt(productId));
                      if (!product) return null;
                      const totalPrice = product.price * quantity;
                      return (
                        <div key={productId} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex-1">
                            <p className="font-medium">{product.name}</p>
                            <p className="text-sm text-muted-foreground">₹{product.price} × {quantity} = ₹{totalPrice}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => removeFromCart(product.id)}
                              disabled={product.stock === 0}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <span className="w-8 text-center">{quantity}</span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => addToCart(product.id)}
                              disabled={product.stock === 0}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="border-t pt-4">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-lg font-semibold">Total:</span>
                      <span className="text-xl font-bold text-primary">
                        ₹{Object.entries(cart).reduce((sum, [productId, quantity]) => {
                          const product = products.find(p => p.id === parseInt(productId));
                          return sum + (product ? product.price * quantity : 0);
                        }, 0)}
                      </span>
                    </div>
                    <Button 
                      className="w-full bg-primary hover:bg-primary-light"
                      onClick={() => navigate("/customer/checkout")}
                    >
                      Proceed to Checkout
                    </Button>
                  </div>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Categories Sidebar */}
        <div className="lg:col-span-1">
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle>Categories</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {categories.map(category => (
                <Button
                  key={category}
                  variant={selectedCategory === category ? "default" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => setSelectedCategory(category)}
                >
                  {category}
                </Button>
              ))}
            </CardContent>
          </Card>

          {/* Cart Summary */}
          {getCartItemCount() > 0 && (
            <Card className="shadow-soft mt-6">
              <CardHeader>
                <CardTitle>Cart Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(cart).map(([productId, quantity]) => {
                    const product = products.find(p => p.id === parseInt(productId));
                    return product ? (
                      <div key={productId} className="flex justify-between items-center">
                        <span className="text-sm">{product.name}</span>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFromCart(product.id)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span>{quantity}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => addToCart(product.id)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ) : null;
                  })}
                  <div className="border-t pt-2 font-bold">
                    Total: ₹{getCartTotal()}
                  </div>
                  <Button className="w-full bg-secondary hover:bg-secondary-light" onClick={() => navigate("/customer/checkout")}>
                    Checkout
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          {/* Search Bar */}
          <Card className="shadow-soft mb-6">
            <CardContent className="p-4">
              <form onSubmit={handleSearch} className="flex space-x-2">
                <div className="flex-1 relative">
                  <Input
                    placeholder="Search for groceries..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pr-10"
                  />
                  <Button
                    type="submit"
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2"
                  >
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
                <Button
                  variant={isListening ? "destructive" : "outline"}
                  type="button"
                  onClick={toggleVoiceSearch}
                  disabled={!browserSupportsSpeechRecognition}
                >
                  {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setShowChat(!showChat)}
                >
                  <MessageSquare className="h-4 w-4" />
                  AI Assistant
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Voice Search Feedback */}
          {isListening && (
            <Card className="shadow-soft mb-6 border-primary">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-primary">
                  <Mic className="h-4 w-4 animate-pulse" />
                  <span className="font-medium">Listening for search...</span>
                  {transcript && (
                    <Badge variant="secondary" className="ml-2">
                      "{transcript}"
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* AI Assistant */}
          {showChat && (
            <div className="mb-6 space-y-4">
              <AudioAssistant onAddToCart={addToCart} onBulkAddToCart={bulkAddToCart} products={products} />
              
              {/* Text-based Chatbot */}
              <Card className="shadow-soft">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Text Assistant
                  </CardTitle>
                  <CardDescription>
                    Type your grocery list: "2 apples, 3 bananas, milk"
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex space-x-2">
                    <Input
                      placeholder="Type your grocery list here..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleChatSubmit()}
                    />
                    <Button onClick={handleChatSubmit} disabled={!chatInput.trim()}>
                      Add Items
                    </Button>
                  </div>
                  <div className="text-xs text-muted-foreground mt-2">
                    <p><strong>Examples:</strong></p>
                    <p>• "2 apples, 3 bananas, milk"</p>
                    <p>• "five tomatoes and two onions"</p>
                    <p>• "rice, 4 flour, and 2 milk"</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Products Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProducts.map(product => (
              <Card key={product.id} className="shadow-soft hover:shadow-medium transition-shadow">
                <CardContent className="p-4">
                  <div className="text-center mb-4">
                    <div className="text-4xl mb-2">{product.image}</div>
                    <h3 className="font-semibold text-lg">{product.name}</h3>
                    <p className="text-muted-foreground text-sm">{product.unit}</p>
                  </div>

                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <span className="text-2xl font-bold text-primary">₹{product.price}</span>
                      {product.stock === 0 ? (
                      <p className="text-xs text-destructive font-semibold">Out of Stock</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">Stock: {product.stock}</p>
                    )}
                    </div>
                    <Badge variant="outline" className="capitalize">
                      {product.category}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between">
                    {product.stock === 0 ? (
                      <Button disabled className="w-full bg-destructive/20 text-destructive cursor-not-allowed">
                        Out of Stock
                      </Button>
                    ) : cart[product.id] ? (
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => removeFromCart(product.id)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="px-3">{cart[product.id]}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => addToCart(product.id)}
                          disabled={product.stock === 0}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        onClick={() => addToCart(product.id)}
                        className="bg-primary hover:bg-primary-light"
                        disabled={product.stock === 0}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add to Cart
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerApp;