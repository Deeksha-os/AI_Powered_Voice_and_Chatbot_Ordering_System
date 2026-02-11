import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { formatIST } from "@/utils/dateUtils";
import {
  Users,
  Store,
  Package,
  TrendingUp,
  AlertTriangle,
  AlertCircle,
  BarChart3,
  Shield,
  Leaf,
  ArrowLeft,
  User,
  Database,
  LogOut,
  CheckCircle,
  XCircle,
  Clock,
  Bell,
  RefreshCw
} from "lucide-react";

// Dynamic statistics type
type AdminStatistics = {
  total_users: number;
  total_customers: number;
  total_vendors: number;
  total_admins: number;
  approved_vendors: number;
  total_products: number;
  out_of_stock_products: number;
  low_stock_products: number;
  total_orders: number;
  active_orders: number;
  completed_orders: number;
  total_revenue: number;
  active_orders_value: number;
  today_revenue: number;
  pending_verifications: number;
  system_uptime: string;
  recent_activity: number;
};

type Activity = { name?:string; email:string; role:string; action:string; created_at:string };

type VendorVerification = {
  id: number;
  vendor_email: string;
  vendor_name: string;
  store_name: string;
  owner_name: string;
  phone?: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_notes?: string;
  created_at: string;
  reviewed_at?: string;
  reviewed_by?: string;
};

const systemAlerts = [
  { id: 1, message: "High customer demand for Bananas across 5 vendors", type: "demand", severity: "high", time: "2 mins ago" },
  { id: 2, message: "Vendor 'Fresh Store' inventory low on multiple items", type: "inventory", severity: "medium", time: "15 mins ago" },
  { id: 3, message: "Payment gateway response time increased by 15%", type: "system", severity: "low", time: "1 hour ago" },
];

const vendorPerformance = [
  { id: 1, name: "Fresh Grocery Store", revenue: 15600, orders: 89, rating: 4.8, status: "Excellent" },
  { id: 2, name: "Green Valley Market", revenue: 12300, orders: 67, rating: 4.6, status: "Good" },
  { id: 3, name: "Organic Corner", revenue: 9800, orders: 45, rating: 4.5, status: "Good" },
];

const AdminApp = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [vendorVerifications, setVendorVerifications] = useState<VendorVerification[]>([]);
  const [statistics, setStatistics] = useState<AdminStatistics>({
    total_users: 0,
    total_customers: 0,
    total_vendors: 0,
    total_admins: 0,
    approved_vendors: 0,
    total_products: 0,
    out_of_stock_products: 0,
    low_stock_products: 0,
    total_orders: 0,
    active_orders: 0,
    completed_orders: 0,
    total_revenue: 0,
    today_revenue: 0,
    pending_verifications: 0,
    system_uptime: "99.8%",
    recent_activity: 0
  });
  const [userStats, setUserStats] = useState<{active_customers:number; new_registrations:number; retention_percent:number}>({ active_customers: 0, new_registrations: 0, retention_percent: 0 });
  const [vendorPerf, setVendorPerf] = useState<Array<{email:string; name:string; store_name:string; orders:number; revenue:number; status?:string}>>([]);

  const loadActivities = async () => {
    try {
      const res = await fetch('/api/admin/recent-activity?limit=100');
      const data = await res.json();
      if (Array.isArray(data?.items)) setActivities(data.items);
    } catch {}
  };

  const loadStatistics = async () => {
    try {
      const res = await fetch('/api/admin/statistics');
      const data = await res.json();
      if (data.success && data.statistics) {
        setStatistics(data.statistics);
      }
    } catch (e) {
      console.error('Error loading statistics:', e);
    }
  };

  const refreshAllData = async () => {
    await Promise.all([
      loadActivities(),
      loadVendorVerifications(),
      loadStatistics(),
      loadUserStats(),
      loadVendorPerformance(),
    ]);
    toast({
      title: "Data Refreshed",
      description: "All admin data has been updated",
    });
  };

  const loadVendorVerifications = async () => {
    try {
      const res = await fetch('/api/admin/vendor-verifications');
      const data = await res.json();
      if (data.success && Array.isArray(data.verifications)) {
        setVendorVerifications(data.verifications);
      }
    } catch (e) {
      console.error('Error loading vendor verifications:', e);
    }
  };

  const loadUserStats = async () => {
    try {
      const res = await fetch('/api/admin/user-stats');
      const data = await res.json();
      if (data.success && data.stats) {
        setUserStats({
          active_customers: data.stats.active_customers,
          new_registrations: data.stats.new_registrations,
          retention_percent: data.stats.retention_percent,
        });
      }
    } catch {}
  };

  const loadVendorPerformance = async () => {
    try {
      const res = await fetch('/api/admin/vendor-performance');
      const data = await res.json();
      if (data.success && Array.isArray(data.vendors)) {
        setVendorPerf(data.vendors);
      }
    } catch {}
  };

  const handleVendorVerification = async (verificationId: number, status: 'approved' | 'rejected', notes: string = '') => {
    try {
      const res = await fetch(`/api/admin/vendor-verifications/${verificationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          status, 
          admin_notes: notes,
          admin_email: 'admin@freshmarket.com' // In real app, get from session
        })
      });
      
      const data = await res.json();
      if (data.success) {
        toast({
          title: `Vendor ${status}`,
          description: `Vendor verification ${status} successfully`,
        });
        await loadVendorVerifications(); // Refresh the list
      } else {
        throw new Error(data.error || 'Failed to update verification');
      }
    } catch (e: any) {
      toast({
        title: "Error",
        description: e.message || "Failed to update vendor verification",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    loadActivities();
    loadVendorVerifications();
    loadStatistics();
    const id = setInterval(() => {
      loadActivities();
      loadVendorVerifications();
      loadStatistics(); // Refresh statistics every 10 seconds
    }, 10000); // Check every 10 seconds
    return () => clearInterval(id);
  }, []);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "high": return "bg-destructive text-destructive-foreground";
      case "medium": return "bg-warning text-warning-foreground";
      case "low": return "bg-accent text-accent-foreground";
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
      <header className="bg-dashboard-sidebar text-dashboard-sidebar-foreground p-4 shadow-medium">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              onClick={() => navigate("/")}
              className="text-dashboard-sidebar-foreground hover:bg-white/10"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Home
            </Button>
            <div className="flex items-center">
              <Shield className="h-8 w-8 mr-2" />
              <span className="text-2xl font-bold">FreshMarket Admin</span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              onClick={refreshAllData}
              className="text-dashboard-sidebar-foreground hover:bg-white/10"
              title="Refresh All Data"
            >
              <RefreshCw className="h-5 w-5 mr-2" />
              Refresh
            </Button>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" className="text-dashboard-sidebar-foreground hover:bg-white/10 relative">
                  <Bell className="h-6 w-6" />
                  {vendorVerifications.filter(v => v.status === 'pending').length > 0 && (
                    <Badge className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground">
                      {vendorVerifications.filter(v => v.status === 'pending').length}
                    </Badge>
                  )}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl max-h-[600px]">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Pending Vendor Verifications
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {vendorVerifications.filter(v => v.status === 'pending').length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No pending vendor verifications</p>
                      <p className="text-sm">All vendors have been reviewed</p>
                    </div>
                  ) : (
                    vendorVerifications
                      .filter(v => v.status === 'pending')
                      .map(verification => (
                        <div 
                          key={verification.id} 
                          className="p-4 border-l-4 border-yellow-500 bg-yellow-50 rounded-lg"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h3 className="font-semibold">{verification.store_name}</h3>
                                <Badge className="bg-yellow-100 text-yellow-800">
                                  <Clock className="h-3 w-3 mr-1" />
                                  PENDING
                                </Badge>
                              </div>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm mb-2">
                                <div>
                                  <p><strong>Owner:</strong> {verification.owner_name}</p>
                                  <p><strong>Email:</strong> {verification.vendor_email}</p>
                                  <p><strong>Phone:</strong> {verification.phone || 'Not provided'}</p>
                                </div>
                                <div>
                                  <p><strong>Submitted:</strong> {formatIST.dateTime(verification.created_at)}</p>
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2 ml-4">
                              <Button
                                size="sm"
                                onClick={() => handleVendorVerification(verification.id, 'approved')}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleVendorVerification(verification.id, 'rejected')}
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Reject
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </DialogContent>
            </Dialog>
            <Button
              variant="ghost"
              onClick={handleLogout}
              className="text-dashboard-sidebar-foreground hover:bg-white/10"
            >
              <LogOut className="h-5 w-5 mr-2" />
              Logout
            </Button>
            <Badge className="bg-success text-success-foreground">
              System Online
            </Badge>
            <Badge variant="outline" className="text-xs">
              IST (UTC+5:30)
            </Badge>
            <Button variant="ghost" className="text-dashboard-sidebar-foreground hover:bg-white/10">
              <User className="h-5 w-5 mr-2" />
              Admin Panel
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6">
        {/* System Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          <Card className="shadow-soft">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Total Users</p>
                  <p className="text-2xl font-bold">{statistics.total_users.toLocaleString()}</p>
                </div>
                <Users className="h-6 w-6 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Active Vendors</p>
                  <p className="text-2xl font-bold">{statistics.approved_vendors}</p>
                </div>
                <Store className="h-6 w-6 text-secondary" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Total Products</p>
                  <p className="text-2xl font-bold">{statistics.total_products}</p>
                </div>
                <Package className="h-6 w-6 text-accent" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Active Orders</p>
                  <p className="text-2xl font-bold">{statistics.active_orders}</p>
                </div>
                <TrendingUp className="h-6 w-6 text-success" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Active Orders Value</p>
                  <p className="text-xl font-bold">₹{statistics.active_orders_value?.toLocaleString?.() || statistics.active_orders_value}</p>
                </div>
                <BarChart3 className="h-6 w-6 text-secondary" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Today Revenue</p>
                  <p className="text-xl font-bold">₹{statistics.today_revenue.toLocaleString()}</p>
                </div>
                <BarChart3 className="h-6 w-6 text-warning" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">System Uptime</p>
                  <p className="text-2xl font-bold text-success">{statistics.system_uptime}</p>
                </div>
                <Database className="h-6 w-6 text-accent" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Additional Statistics Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="shadow-soft">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Inventory Value</p>
                  <p className="text-xl font-bold">₹{statistics.total_revenue.toLocaleString()}</p>
                </div>
                <BarChart3 className="h-6 w-6 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Pending Verifications</p>
                  <p className="text-2xl font-bold text-warning">{statistics.pending_verifications}</p>
                </div>
                <Clock className="h-6 w-6 text-warning" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Out of Stock</p>
                  <p className="text-2xl font-bold text-destructive">{statistics.out_of_stock_products}</p>
                </div>
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Low Stock</p>
                  <p className="text-2xl font-bold text-warning">{statistics.low_stock_products}</p>
                </div>
                <AlertCircle className="h-6 w-6 text-warning" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="verifications">Vendor Verifications</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="vendors">Vendors</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="powerbi">Power BI</TabsTrigger>
          </TabsList>

          {/* Overview */}
          <TabsContent value="overview">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* System Alerts */}
              <Card className="shadow-soft">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <AlertTriangle className="h-5 w-5 mr-2" />
                    System Alerts
                  </CardTitle>
                  <CardDescription>
                    Real-time system notifications and alerts
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {systemAlerts.map(alert => (
                      <div key={alert.id} className="flex items-start justify-between p-3 border rounded-lg">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{alert.message}</p>
                          <p className="text-xs text-muted-foreground">{alert.time}</p>
                        </div>
                        <Badge className={getSeverityColor(alert.severity)}>
                          {alert.severity.toUpperCase()}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Recent Activity */}
              <Card className="shadow-soft">
                <CardHeader>
                  <CardTitle>Recent User Activity</CardTitle>
                  <CardDescription>
                    Latest customer and vendor logins/signups
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {activities.length === 0 && (
                      <div className="text-sm text-muted-foreground">No recent activity.</div>
                    )}
                    {activities.map((a, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">{a.name || a.email}</p>
                          <p className="text-sm text-muted-foreground">{a.email}</p>
                          <p className="text-xs text-muted-foreground">{a.action} • {formatIST.compact(a.created_at)}</p>
                        </div>
                        <div className="text-right">
                          <Badge variant="outline">{a.role}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Users Management */}
          <TabsContent value="users">
            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle>User Management</CardTitle>
                <CardDescription>
                  Manage customers and monitor user activities
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Customer Statistics</h3>
                    <Button variant="outline" size="sm">View All Users</Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-medium">Active Customers</h4>
                      <p className="text-2xl font-bold text-primary">{userStats.active_customers}</p>
                      <p className="text-sm text-muted-foreground">Last 30 days</p>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-medium">New Registrations</h4>
                      <p className="text-2xl font-bold text-success">{userStats.new_registrations}</p>
                      <p className="text-sm text-muted-foreground">Last 7 days</p>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-medium">Customer Retention</h4>
                      <p className="text-2xl font-bold text-accent">{userStats.retention_percent}%</p>
                      <p className="text-sm text-muted-foreground">Active/Total customers</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Vendor Verifications */}
          <TabsContent value="verifications">
            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Vendor Verification Requests
                </CardTitle>
                <CardDescription>
                  Review and approve vendor registration requests
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {vendorVerifications.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No vendor verification requests</p>
                      <p className="text-sm">New vendor signups will appear here for review</p>
                    </div>
                  ) : (
                    vendorVerifications.map(verification => (
                      <div 
                        key={verification.id} 
                        className={`p-4 border rounded-lg ${
                          verification.status === 'pending' ? 'border-yellow-200 bg-yellow-50' :
                          verification.status === 'approved' ? 'border-green-200 bg-green-50' :
                          'border-red-200 bg-red-50'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-semibold">{verification.store_name}</h3>
                              <Badge 
                                variant={
                                  verification.status === 'pending' ? 'default' :
                                  verification.status === 'approved' ? 'default' : 'destructive'
                                }
                                className={
                                  verification.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                  verification.status === 'approved' ? 'bg-green-100 text-green-800' :
                                  'bg-red-100 text-red-800'
                                }
                              >
                                {verification.status === 'pending' && <Clock className="h-3 w-3 mr-1" />}
                                {verification.status === 'approved' && <CheckCircle className="h-3 w-3 mr-1" />}
                                {verification.status === 'rejected' && <XCircle className="h-3 w-3 mr-1" />}
                                {verification.status.toUpperCase()}
                              </Badge>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                              <div>
                                <p><strong>Owner:</strong> {verification.owner_name}</p>
                                <p><strong>Email:</strong> {verification.vendor_email}</p>
                                <p><strong>Phone:</strong> {verification.phone || 'Not provided'}</p>
                              </div>
                              <div>
                                <p><strong>Submitted:</strong> {formatIST.dateTime(verification.created_at)}</p>
                                {verification.reviewed_at && (
                                  <p><strong>Reviewed:</strong> {formatIST.dateTime(verification.reviewed_at)}</p>
                                )}
                                {verification.reviewed_by && (
                                  <p><strong>Reviewed by:</strong> {verification.reviewed_by}</p>
                                )}
                              </div>
                            </div>
                            
                            {verification.admin_notes && (
                              <div className="mt-3 p-2 bg-gray-100 rounded text-sm">
                                <strong>Admin Notes:</strong> {verification.admin_notes}
                              </div>
                            )}
                          </div>
                          
                          {verification.status === 'pending' && (
                            <div className="flex items-center gap-2 ml-4">
                              <Button
                                size="sm"
                                onClick={() => handleVendorVerification(verification.id, 'approved')}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleVendorVerification(verification.id, 'rejected')}
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Reject
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Vendor Management */}
          <TabsContent value="vendors">
            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle>Vendor Performance</CardTitle>
                <CardDescription>
                  Monitor vendor activities and performance metrics
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {vendorPerf.map(vendor => (
                    <div key={vendor.email} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <h3 className="font-semibold">{vendor.store_name}</h3>
                        <p className="text-sm text-muted-foreground">{vendor.name} • {vendor.email}</p>
                        <p className="text-sm text-muted-foreground">
                          {(vendor.orders||0)} orders • ₹{(vendor.revenue||0).toLocaleString()} revenue
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge>approved</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics */}
          <TabsContent value="analytics">
            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle>System Analytics</CardTitle>
                <CardDescription>
                  Comprehensive platform analytics and insights
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-4 bg-primary/10 rounded-lg">
                      <h3 className="font-semibold mb-2">📈 Order Trends</h3>
                      <ul className="space-y-2 text-sm">
                        <li>• 23% increase in grocery orders this week</li>
                        <li>• Peak ordering time: 6-8 PM</li>
                        <li>• Average order value: ₹485</li>
                        <li>• Most popular category: Vegetables (35%)</li>
                      </ul>
                    </div>

                    <div className="p-4 bg-secondary/10 rounded-lg">
                      <h3 className="font-semibold mb-2">🎯 Customer Insights</h3>
                      <ul className="space-y-2 text-sm">
                        <li>• 68% customers use mobile app</li>
                        <li>• Average session duration: 8.5 minutes</li>
                        <li>• Customer satisfaction: 4.6/5</li>
                        <li>• Repeat purchase rate: 72%</li>
                      </ul>
                    </div>
                  </div>

                  <div className="p-4 bg-accent/10 rounded-lg">
                    <h3 className="font-semibold mb-2">🚀 Platform Performance</h3>
                    <ul className="space-y-2 text-sm">
                      <li>• API response time: 180ms average</li>
                      <li>• 99.8% uptime this month</li>
                      <li>• 0.05% error rate</li>
                      <li>• Database queries optimized: 45ms average</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Power BI Integration */}
          <TabsContent value="powerbi">
            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle>Power BI Integration</CardTitle>
                <CardDescription>
                  Connect and configure Power BI dashboards for advanced analytics
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="text-center p-8 border-2 border-dashed border-muted rounded-lg">
                    <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="font-semibold mb-2">Power BI Dashboard Ready</h3>
                    <p className="text-muted-foreground mb-4">
                      Your FreshMarket platform is configured for Power BI integration
                    </p>
                    <Button className="bg-accent hover:bg-accent-light">
                      Connect to Power BI
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-medium mb-2">📊 Available Data Sources</h4>
                      <ul className="text-sm space-y-1 text-muted-foreground">
                        <li>• Customer orders and transactions</li>
                        <li>• Vendor performance metrics</li>
                        <li>• Product catalog and inventory</li>
                        <li>• User behavior analytics</li>
                        <li>• Revenue and financial data</li>
                      </ul>
                    </div>

                    <div className="p-4 border rounded-lg">
                      <h4 className="font-medium mb-2">🎯 Recommended Dashboards</h4>
                      <ul className="text-sm space-y-1 text-muted-foreground">
                        <li>• Sales performance overview</li>
                        <li>• Customer order patterns</li>
                        <li>• Inventory optimization</li>
                        <li>• Vendor performance analytics</li>
                        <li>• Real-time system monitoring</li>
                      </ul>
                    </div>
                  </div>

                  <div className="bg-muted p-4 rounded-lg">
                    <h4 className="font-medium mb-2">🔧 Integration Instructions</h4>
                    <ol className="text-sm space-y-1 text-muted-foreground">
                      <li>1. Configure data connection strings in your Power BI workspace</li>
                      <li>2. Import the FreshMarket data model templates</li>
                      <li>3. Set up automated data refresh schedules</li>
                      <li>4. Create custom reports using pre-built templates</li>
                      <li>5. Share dashboards with stakeholders</li>
                    </ol>
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

export default AdminApp;