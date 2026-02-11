import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNavigate } from "react-router-dom";
import { formatIST } from "@/utils/dateUtils";
import {
  Store,
  Plus,
  Edit,
  Trash2,
  Bell,
  TrendingUp,
  Package,
  AlertTriangle,
  Leaf,
  ArrowLeft,
  User,
  Users,
  LogOut,
  AlertCircle,
  CheckCircle,
  X,
  RefreshCw
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type VendorProduct = { id:number; name:string; price:number; stock:number; category:string; demand:string; status:string };

type StockNotification = {
  id: string;
  productId: number;
  productName: string;
  type: 'out_of_stock' | 'low_stock' | 'restocked';
  message: string;
  timestamp: Date;
  read: boolean;
  priority: 'high' | 'medium' | 'low';
};

type CustomerRequestType = {
  id: number;
  customer_email: string;
  customer_name: string;
  product_id: number;
  product_name: string;
  quantity: number;
  status: string;
  created_at: string;
  read?: boolean;
};

const VendorApp = () => {
  const [products, setProducts] = useState<VendorProduct[]>([]);
  const [customerRequests, setCustomerRequests] = useState<CustomerRequestType[]>([]);
  const [stockNotifications, setStockNotifications] = useState<StockNotification[]>([]);
  const [previousStock, setPreviousStock] = useState<{[key: number]: number}>({});
  const [newProduct, setNewProduct] = useState({
    name: "",
    price: "",
    stock: "",
    category: "vegetables"
  });
  const navigate = useNavigate();
  const { toast } = useToast();

  const loadProducts = async () => {
    try {
      const res = await fetch("/api/products");
      const data = await res.json();
      if (Array.isArray(data)) {
        const mapped: VendorProduct[] = data.map((p: any) => ({
          id: p.id,
          name: p.name,
          price: p.price,
          stock: p.stock,
          category: p.category || "",
          demand: p.stock <= 0 ? "High" : p.stock < 10 ? "Medium" : "Low",
          status: p.stock <= 0 ? "Out of Stock" : p.stock < 10 ? "Low Stock" : "In Stock",
        }));
        
        // Check for stock changes and generate notifications
        checkStockChanges(mapped);
        setProducts(mapped);
      }
    } catch (e) {
      console.error('Error loading products:', e);
    }
  };

  const loadCustomerRequests = async () => {
    try {
      const res = await fetch("/api/vendor/customer-requests");
      const data = await res.json();
      if (data.success && Array.isArray(data.requests)) {
        // Add read flag to track unread requests
        const requestsWithRead = data.requests.map((req: any) => ({
          ...req,
          read: false
        }));
        setCustomerRequests(requestsWithRead);
      }
    } catch (e) {
      console.error('Error loading customer requests:', e);
    }
  };

  // Add a function to force refresh stock data
  const refreshStockData = async () => {
    await loadProducts();
    toast({
      title: "Stock Data Refreshed",
      description: "Latest stock information has been updated",
    });
  };

  const checkStockChanges = (newProducts: VendorProduct[]) => {
    const newNotifications: StockNotification[] = [];
    
    newProducts.forEach(product => {
      const prevStock = previousStock[product.id];
      const currentStock = product.stock;
      
      // Skip if this is the first load (no previous stock data)
      if (prevStock === undefined) {
        setPreviousStock(prev => ({ ...prev, [product.id]: currentStock }));
        return;
      }
      
      // Enhanced stock change detection with more granular thresholds
      if (prevStock > 0 && currentStock === 0) {
        // Product went out of stock
        newNotifications.push({
          id: `out-${product.id}-${Date.now()}`,
          productId: product.id,
          productName: product.name,
          type: 'out_of_stock',
          message: `🚨 ${product.name} is now OUT OF STOCK!`,
          timestamp: new Date(),
          read: false,
          priority: 'high'
        });
      } else if (prevStock > 5 && currentStock <= 5 && currentStock > 0) {
        // Product went to critical low stock (5 or less)
        newNotifications.push({
          id: `critical-${product.id}-${Date.now()}`,
          productId: product.id,
          productName: product.name,
          type: 'low_stock',
          message: `⚠️ ${product.name} is critically low (${currentStock} remaining)`,
          timestamp: new Date(),
          read: false,
          priority: 'high'
        });
      } else if (prevStock > 10 && currentStock <= 10 && currentStock > 5) {
        // Product went to low stock (6-10)
        newNotifications.push({
          id: `low-${product.id}-${Date.now()}`,
          productId: product.id,
          productName: product.name,
          type: 'low_stock',
          message: `📉 ${product.name} is running low (${currentStock} remaining)`,
          timestamp: new Date(),
          read: false,
          priority: 'medium'
        });
      } else if (prevStock === 0 && currentStock > 0) {
        // Product was restocked
        newNotifications.push({
          id: `restock-${product.id}-${Date.now()}`,
          productId: product.id,
          productName: product.name,
          type: 'restocked',
          message: `✅ ${product.name} has been restocked (${currentStock} available)`,
          timestamp: new Date(),
          read: false,
          priority: 'low'
        });
      } else if (prevStock <= 5 && currentStock > 5) {
        // Product went from critical to normal stock
        newNotifications.push({
          id: `recovered-${product.id}-${Date.now()}`,
          productId: product.id,
          productName: product.name,
          type: 'restocked',
          message: `🔄 ${product.name} stock recovered (${currentStock} available)`,
          timestamp: new Date(),
          read: false,
          priority: 'low'
        });
      }
      
      // Update previous stock
      setPreviousStock(prev => ({ ...prev, [product.id]: currentStock }));
    });
    
    // Add new notifications
    if (newNotifications.length > 0) {
      setStockNotifications(prev => [...newNotifications, ...prev]);
      
      // Show toast for high priority notifications
      newNotifications.forEach(notification => {
        if (notification.priority === 'high') {
          toast({
            title: "🚨 Stock Alert",
            description: notification.message,
            variant: "destructive"
          });
        } else if (notification.priority === 'medium') {
          toast({
            title: "⚠️ Low Stock Warning",
            description: notification.message,
            variant: "default"
          });
        }
      });
    }
  };

  const markNotificationAsRead = (notificationId: string) => {
    setStockNotifications(prev => 
      prev.map(notification => 
        notification.id === notificationId 
          ? { ...notification, read: true }
          : notification
      )
    );
  };

  const dismissNotification = (notificationId: string) => {
    setStockNotifications(prev => 
      prev.filter(notification => notification.id !== notificationId)
    );
  };

  const markAllNotificationsAsRead = () => {
    setStockNotifications(prev => 
      prev.map(notification => ({ ...notification, read: true }))
    );
    toast({
      title: "All Notifications Marked as Read",
      description: "All stock alerts have been marked as read",
    });
  };

  const clearAllNotifications = () => {
    setStockNotifications([]);
    toast({
      title: "Notifications Cleared",
      description: "All stock notifications have been cleared",
    });
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'out_of_stock':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'low_stock':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'restocked':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      default:
        return <Bell className="h-4 w-4 text-blue-500" />;
    }
  };

  const getNotificationPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'border-l-red-500 bg-red-50';
      case 'medium':
        return 'border-l-yellow-500 bg-yellow-50';
      case 'low':
        return 'border-l-green-500 bg-green-50';
      default:
        return 'border-l-blue-500 bg-blue-50';
    }
  };

  useEffect(() => { 
    loadProducts();
    loadCustomerRequests();
    
    // Set up more frequent stock monitoring (every 10 seconds for better responsiveness)
    const interval = setInterval(loadProducts, 10000);
    
    // Load customer requests every 15 seconds
    const requestsInterval = setInterval(loadCustomerRequests, 15000);
    
    return () => {
      clearInterval(interval);
      clearInterval(requestsInterval);
    };
  }, []);

  // Add a separate effect to monitor stock changes more aggressively
  useEffect(() => {
    const stockMonitorInterval = setInterval(() => {
      // Check for critical stock levels every 5 seconds
      const criticalProducts = products.filter(p => p.stock <= 5);
      if (criticalProducts.length > 0) {
        // Force a product reload to get latest stock data
        loadProducts();
      }
    }, 5000);

    return () => clearInterval(stockMonitorInterval);
  }, [products]);

  // Add real-time stock monitoring for all products
  useEffect(() => {
    const realTimeMonitor = setInterval(() => {
      // Check if any products are at critical levels or out of stock
      const hasCriticalStock = products.some(p => p.stock <= 5);
      const hasOutOfStock = products.some(p => p.stock === 0);
      
      if (hasCriticalStock || hasOutOfStock) {
        // More frequent monitoring for critical situations
        loadProducts();
      }
    }, 3000); // Check every 3 seconds for critical situations

    return () => clearInterval(realTimeMonitor);
  }, [products]);

  const addProduct = async () => {
    if (!newProduct.name || !newProduct.price || !newProduct.stock) {
      toast({
        title: "Error",
        description: "Please fill all fields",
        variant: "destructive",
      });
      return;
    }

    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newProduct.name,
          price: parseFloat(newProduct.price),
          stock: parseInt(newProduct.stock),
          category: newProduct.category,
        })
      });
      if (!res.ok) throw new Error("Failed to add product");
      await loadProducts();
    } catch (e:any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
      return;
    }
    setNewProduct({ name: "", price: "", stock: "", category: "vegetables" });

    toast({
      title: "Product Added",
      description: `Product has been added to your inventory`,
    });
  };

  const updateStock = async (productId: number, newStock: number) => {
    try {
      const res = await fetch(`/api/products/${productId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stock: newStock })
      });
      if (!res.ok) throw new Error("Failed to update stock");
      await loadProducts();
      toast({ title: "Stock Updated", description: "Product stock has been updated successfully" });
    } catch (e:any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const updatePrice = async (productId: number, newPrice: number) => {
    try {
      const res = await fetch(`/api/products/${productId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ price: newPrice })
      });
      if (!res.ok) throw new Error("Failed to update price");
      await loadProducts();
      toast({ title: "Price Updated", description: "Product price has been updated successfully" });
    } catch (e:any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const deleteProduct = (productId: number) => {
    setProducts(products.filter(product => product.id !== productId));
    toast({
      title: "Product Deleted",
      description: "Product has been removed from your inventory",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "In Stock": return "bg-success text-success-foreground";
      case "Low Stock": return "bg-warning text-warning-foreground";
      case "Out of Stock": return "bg-destructive text-destructive-foreground";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getDemandColor = (demand: string) => {
    switch (demand) {
      case "Very High": return "bg-destructive text-destructive-foreground";
      case "High": return "bg-warning text-warning-foreground";
      case "Medium": return "bg-accent text-accent-foreground";
      default: return "bg-muted text-muted-foreground";
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
    
    // Show success message
    toast({ 
      title: "Logged Out", 
      description: "You have been successfully logged out" 
    });
    
    // Navigate to home page
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-dashboard-bg">
      {/* Header */}
      <header className="bg-secondary text-secondary-foreground p-4 shadow-medium">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              onClick={() => navigate("/")}
              className="text-secondary-foreground hover:bg-secondary-light"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Home
            </Button>
            <div className="flex items-center">
              <Leaf className="h-8 w-8 mr-2" />
              <span className="text-2xl font-bold">FreshMarket Vendor</span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              onClick={refreshStockData}
              className="text-secondary-foreground hover:bg-secondary-light"
              title="Refresh Stock Data"
            >
              <RefreshCw className="h-5 w-5 mr-2" />
              Refresh
            </Button>
            <Button
              variant="ghost"
              onClick={handleLogout}
              className="text-secondary-foreground hover:bg-secondary-light"
            >
              <LogOut className="h-5 w-5 mr-2" />
              Logout
            </Button>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" className="text-secondary-foreground hover:bg-secondary-light relative">
                  <Bell className="h-6 w-6" />
                  {(customerRequests.filter(r => !r.read).length > 0 || stockNotifications.filter(n => !n.read).length > 0) && (
                    <Badge className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground">
                      {customerRequests.filter(r => !r.read).length + stockNotifications.filter(n => !n.read).length}
                    </Badge>
                  )}
                  {stockNotifications.filter(n => n.priority === 'high' && !n.read).length > 0 && (
                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                  )}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg max-h-[600px]">
                <DialogHeader>
                  <DialogTitle className="flex items-center justify-between">
                    <span>Notifications</span>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={markAllNotificationsAsRead}
                        disabled={stockNotifications.every(n => n.read)}
                      >
                        Mark All Read
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={clearAllNotifications}
                        disabled={stockNotifications.length === 0}
                      >
                        Clear All
                      </Button>
                    </div>
                  </DialogTitle>
                </DialogHeader>
                <Tabs defaultValue="customer-requests" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="customer-requests">
                      Customer Requests ({customerRequests.length})
                    </TabsTrigger>
                    <TabsTrigger value="stock-alerts">
                      Stock Alerts ({stockNotifications.length})
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="customer-requests" className="space-y-3 max-h-[400px] overflow-y-auto">
                    {customerRequests.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No customer requests</p>
                        <p className="text-sm">Customers will request items when they're out of stock</p>
                      </div>
                    ) : (
                      customerRequests.map(request => (
                        <div 
                          key={request.id} 
                          className="p-3 border-l-4 border-primary bg-blue-50 rounded-lg"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="font-semibold text-sm">{request.customer_name}</p>
                                <Badge className="text-xs">Customer Request</Badge>
                              </div>
                              <p className="text-xs text-muted-foreground mb-1">
                                <strong>Requesting:</strong> {request.quantity}x {request.product_name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatIST.relative(new Date(request.created_at))}
                              </p>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={async () => {
                                  try {
                                    const res = await fetch(`/api/vendor/customer-requests/${request.id}/mark-notified`, {
                                      method: "PUT"
                                    });
                                    if (res.ok) {
                                      // Remove the request from the list
                                      setCustomerRequests(prev => prev.filter(r => r.id !== request.id));
                                      toast({
                                        title: "Request Acknowledged",
                                        description: "Customer request marked as notified"
                                      });
                                    }
                                  } catch (e) {
                                    console.error('Error marking request as notified:', e);
                                  }
                                }}
                                className="text-xs"
                              >
                                Mark Notified
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </TabsContent>

                  <TabsContent value="stock-alerts" className="space-y-3 max-h-[400px] overflow-y-auto">
                    {stockNotifications.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No stock notifications</p>
                      <p className="text-sm">You'll receive alerts when products go out of stock</p>
                    </div>
                  ) : (
                    stockNotifications.map(notification => (
                      <div 
                        key={notification.id} 
                        className={`p-3 border-l-4 rounded-lg ${
                          notification.read ? 'opacity-60' : ''
                        } ${getNotificationPriorityColor(notification.priority)}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-2">
                            {getNotificationIcon(notification.type)}
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="font-semibold text-sm">{notification.productName}</p>
                                <Badge 
                                  variant={notification.priority === 'high' ? 'destructive' : 
                                          notification.priority === 'medium' ? 'default' : 'secondary'}
                                  className="text-xs"
                                >
                                  {notification.priority}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground mb-1">
                                {notification.message}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatIST.notification(notification.timestamp)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {!notification.read && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => markNotificationAsRead(notification.id)}
                                className="text-xs"
                              >
                                Mark Read
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => dismissNotification(notification.id)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                      ))
                  )}
                  </TabsContent>
                </Tabs>
              </DialogContent>
            </Dialog>
            <Button variant="ghost" className="text-secondary-foreground hover:bg-secondary-light">
              <User className="h-5 w-5 mr-2" />
              Vendor Dashboard
            </Button>
            <Badge variant="outline" className="text-xs">
              IST (UTC+5:30)
            </Badge>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <Card className="shadow-soft">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground">Total Products</p>
                  <p className="text-3xl font-bold">{products.length}</p>
                </div>
                <Package className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground">Low Stock Items</p>
                  <p className="text-3xl font-bold text-warning">
                    {products.filter(p => p.status === "Low Stock").length}
                  </p>
                </div>
                <AlertTriangle className="h-8 w-8 text-warning" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground">Out of Stock</p>
                  <p className="text-3xl font-bold text-destructive">
                    {products.filter(p => p.status === "Out of Stock").length}
                  </p>
                </div>
                <Store className="h-8 w-8 text-destructive" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground">Stock Alerts</p>
                  <p className="text-3xl font-bold text-accent">
                    {stockNotifications.filter(n => !n.read).length}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stockNotifications.filter(n => n.priority === 'high' && !n.read).length} critical
                  </p>
                </div>
                <div className="relative">
                  <Bell className="h-8 w-8 text-accent" />
                  {stockNotifications.filter(n => n.priority === 'high' && !n.read).length > 0 && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground">Customer Requests</p>
                  <p className="text-3xl font-bold text-accent">{customerRequests.length}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-accent" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="inventory" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="inventory">Inventory</TabsTrigger>
            <TabsTrigger value="add-product">Add Product</TabsTrigger>
            <TabsTrigger value="notifications">Stock Alerts</TabsTrigger>
            <TabsTrigger value="requests">Customer Requests</TabsTrigger>
            <TabsTrigger value="insights">AI Insights</TabsTrigger>
          </TabsList>

          {/* Inventory Management */}
          <TabsContent value="inventory">
            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle>Product Inventory</CardTitle>
                <CardDescription>
                  Manage your product catalog and stock levels
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {products.map(product => (
                    <div key={product.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div>
                          <h3 className="font-semibold">{product.name}</h3>
                          <p className="text-sm text-muted-foreground">₹{product.price} • {product.category}</p>
                        </div>
                        {/* Show alert indicator for products with stock issues */}
                        {product.stock <= 5 && (
                          <div className="relative">
                            <AlertTriangle className="h-4 w-4 text-yellow-500" />
                            {product.stock === 0 && (
                              <AlertCircle className="h-4 w-4 text-red-500 absolute -top-1 -right-1" />
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center space-x-4">
                        <Badge className={getStatusColor(product.status)}>
                          {product.status}
                        </Badge>
                        <Badge className={getDemandColor(product.demand)}>
                          {product.demand} Demand
                        </Badge>
                        <div className="flex items-center space-x-2">
                          <Label>Stock:</Label>
                          <Input
                            type="number"
                            value={product.stock}
                            onChange={(e) => updateStock(product.id, parseInt(e.target.value) || 0)}
                            className="w-20"
                          />
                        </div>
                        <div className="flex items-center space-x-2">
                          <Label>Price (₹):</Label>
                          <Input
                            type="number"
                            step="0.01"
                            defaultValue={product.price}
                            onBlur={(e) => updatePrice(product.id, parseFloat(e.target.value) || 0)}
                            className="w-24"
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteProduct(product.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Add Product */}
          <TabsContent value="add-product">
            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle>Add New Product</CardTitle>
                <CardDescription>
                  Add a new product to your inventory
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="product-name">Product Name</Label>
                    <Input
                      id="product-name"
                      value={newProduct.name}
                      onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
                      placeholder="Enter product name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="product-price">Price (₹)</Label>
                    <Input
                      id="product-price"
                      type="number"
                      value={newProduct.price}
                      onChange={(e) => setNewProduct({...newProduct, price: e.target.value})}
                      placeholder="Enter price"
                    />
                  </div>
                  <div>
                    <Label htmlFor="product-stock">Stock Quantity</Label>
                    <Input
                      id="product-stock"
                      type="number"
                      value={newProduct.stock}
                      onChange={(e) => setNewProduct({...newProduct, stock: e.target.value})}
                      placeholder="Enter stock quantity"
                    />
                  </div>
                  <div>
                    <Label htmlFor="product-category">Category</Label>
                    <select
                      id="product-category"
                      value={newProduct.category}
                      onChange={(e) => setNewProduct({...newProduct, category: e.target.value})}
                      className="w-full p-2 border rounded"
                    >
                      <option value="vegetables">Vegetables</option>
                      <option value="fruits">Fruits</option>
                      <option value="dairy">Dairy</option>
                      <option value="staples">Staples</option>
                    </select>
                  </div>
                </div>
                <Button onClick={addProduct} className="bg-secondary hover:bg-secondary-light">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Product
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Customer Requests */}
          <TabsContent value="requests">
            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle>Customer Requests</CardTitle>
                <CardDescription>
                  Track customer requests for out-of-stock items
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {customerRequests.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No customer requests yet</p>
                      <p className="text-sm">Customers will request items when they're out of stock</p>
                    </div>
                  ) : (
                    customerRequests.map(request => (
                      <div key={request.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <h3 className="font-semibold">{request.product_name}</h3>
                          <p className="text-sm text-muted-foreground">
                            Requested by {request.customer_name} ({request.customer_email}) • Quantity: {request.quantity}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatIST.relative(new Date(request.created_at))}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button 
                            size="sm" 
                            variant="destructive"
                            onClick={async () => {
                              try {
                                const res = await fetch(`/api/vendor/customer-requests/${request.id}/mark-notified`, {
                                  method: "PUT"
                                });
                                if (res.ok) {
                                  setCustomerRequests(prev => prev.filter(r => r.id !== request.id));
                                  toast({
                                    title: "Request Acknowledged",
                                    description: "Customer request marked as notified"
                                  });
                                }
                              } catch (e) {
                                console.error('Error marking request as notified:', e);
                              }
                            }}
                          >
                            Mark Notified
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Stock Notifications */}
          <TabsContent value="notifications">
            <Card className="shadow-soft">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Bell className="h-5 w-5" />
                      Stock Notifications
                    </CardTitle>
                    <CardDescription>
                      Real-time alerts for stock changes and inventory management
                    </CardDescription>
                  </div>
                  {stockNotifications.length > 0 && (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={markAllNotificationsAsRead}
                        disabled={stockNotifications.every(n => n.read)}
                      >
                        Mark All Read
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={clearAllNotifications}
                      >
                        Clear All
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {stockNotifications.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No stock notifications yet</p>
                      <p className="text-sm">You'll receive alerts when products go out of stock or run low</p>
                    </div>
                  ) : (
                    stockNotifications.map(notification => (
                      <div 
                        key={notification.id} 
                        className={`p-4 border-l-4 rounded-lg transition-all ${
                          notification.read ? 'opacity-60' : ''
                        } ${getNotificationPriorityColor(notification.priority)}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            {getNotificationIcon(notification.type)}
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold">{notification.productName}</h3>
                                <Badge 
                                  variant={notification.priority === 'high' ? 'destructive' : 
                                          notification.priority === 'medium' ? 'default' : 'secondary'}
                                >
                                  {notification.priority}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground mb-2">
                                {notification.message}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatIST.notification(notification.timestamp)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {!notification.read && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => markNotificationAsRead(notification.id)}
                              >
                                Mark Read
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => dismissNotification(notification.id)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* AI Insights */}
          <TabsContent value="insights">
            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle>AI Demand Forecasting</CardTitle>
                <CardDescription>
                  AI-powered insights to optimize your inventory
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="p-4 bg-accent/10 rounded-lg">
                    <h3 className="font-semibold mb-2">📊 Weekly Forecast</h3>
                    <ul className="space-y-2 text-sm">
                      <li>• <strong>Tomatoes</strong>: Expected 40% increase in demand</li>
                      <li>• <strong>Milk</strong>: Steady high demand, consider stocking extra</li>
                      <li>• <strong>Bananas</strong>: 3 customer requests in last hour - restock urgently</li>
                    </ul>
                  </div>

                  <div className="p-4 bg-warning/10 rounded-lg">
                    <h3 className="font-semibold mb-2">⚠️ Stock Alerts</h3>
                    <ul className="space-y-2 text-sm">
                      <li>• Organic Spinach running low (5 units left)</li>
                      <li>• Sweet Bananas out of stock with high demand</li>
                    </ul>
                  </div>

                  <div className="p-4 bg-success/10 rounded-lg">
                    <h3 className="font-semibold mb-2">💡 Optimization Tips</h3>
                    <ul className="space-y-2 text-sm">
                      <li>• Consider bundling Milk + Bread for increased sales</li>
                      <li>• Seasonal fruits demand will increase by 25% next week</li>
                      <li>• Stock vegetables in morning hours for better freshness perception</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default VendorApp;