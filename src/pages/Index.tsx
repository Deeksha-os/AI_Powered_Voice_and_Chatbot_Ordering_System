import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { ShoppingCart, Store, Settings, Leaf } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-fresh flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-6">
            <Leaf className="h-12 w-12 text-white mr-4" />
            <h1 className="text-5xl font-bold text-white">FreshMarket</h1>
          </div>
          <p className="text-xl text-white/90 font-medium">
            Your Complete Grocery Platform Solution
          </p>
          <p className="text-white/80 mt-2">
            Choose your role to access your dedicated interface
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {/* Customer Portal */}
          <Card className="shadow-strong hover:shadow-glow transition-all duration-300 transform hover:-translate-y-1 cursor-pointer group">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto w-16 h-16 bg-primary rounded-full flex items-center justify-center mb-4 group-hover:bg-primary-light transition-colors">
                <ShoppingCart className="h-8 w-8 text-primary-foreground" />
              </div>
              <CardTitle className="text-2xl font-bold text-primary">Customer</CardTitle>
              <CardDescription className="text-muted-foreground">
                Browse products, place orders, and track deliveries
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <ul className="text-sm text-muted-foreground space-y-2 mb-6">
                <li>• Browse fresh groceries by category</li>
                <li>• AI-powered shopping assistant</li>
                <li>• Real-time cart management</li>
                <li>• Delivery tracking & simulation</li>
              </ul>
              <Button
                onClick={() => navigate('/customer/auth')}
                className="w-full bg-primary hover:bg-primary-light"
              >
                Shop Now
              </Button>
            </CardContent>
          </Card>

          {/* Vendor Portal */}
          <Card className="shadow-strong hover:shadow-glow transition-all duration-300 transform hover:-translate-y-1 cursor-pointer group">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto w-16 h-16 bg-secondary rounded-full flex items-center justify-center mb-4 group-hover:bg-secondary-light transition-colors">
                <Store className="h-8 w-8 text-secondary-foreground" />
              </div>
              <CardTitle className="text-2xl font-bold text-secondary">Vendor</CardTitle>
              <CardDescription className="text-muted-foreground">
                Manage your inventory and track customer demands
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <ul className="text-sm text-muted-foreground space-y-2 mb-6">
                <li>• Upload & manage product catalog</li>
                <li>• Real-time inventory tracking</li>
                <li>• AI demand forecasting</li>
                <li>• Customer request notifications</li>
              </ul>
              <Button
                onClick={() => navigate('/vendor/auth')}
                className="w-full bg-secondary hover:bg-secondary-light"
              >
                Manage Store
              </Button>
            </CardContent>
          </Card>

          {/* Admin Portal */}
          <Card className="shadow-strong hover:shadow-glow transition-all duration-300 transform hover:-translate-y-1 cursor-pointer group">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto w-16 h-16 bg-accent rounded-full flex items-center justify-center mb-4 group-hover:bg-accent-light transition-colors">
                <Settings className="h-8 w-8 text-accent-foreground" />
              </div>
              <CardTitle className="text-2xl font-bold text-accent">Admin</CardTitle>
              <CardDescription className="text-muted-foreground">
                System management and analytics dashboard
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <ul className="text-sm text-muted-foreground space-y-2 mb-6">
                <li>• User & vendor management</li>
                <li>• System-wide analytics</li>
                <li>• Inventory optimization</li>
                <li>• Power BI integration ready</li>
              </ul>
              <Button
                onClick={() => navigate('/admin/auth')}
                className="w-full bg-accent hover:bg-accent-light"
              >
                Access Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="text-center mt-12">
          <p className="text-white/70 text-sm">
            Powered by AI • Real-time Analytics • Delivery Simulation • Multi-vendor Support
          </p>
        </div>
      </div>
    </div>
  );
};

export default Index;