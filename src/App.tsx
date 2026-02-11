import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import CustomerApp from "./pages/customer/CustomerApp";
import VendorApp from "./pages/vendor/VendorApp";
import AdminApp from "./pages/admin/AdminApp";
import CustomerAuth from "./pages/auth/CustomerAuth";
import VendorAuth from "./pages/auth/VendorAuth";
import AdminAuth from "./pages/auth/AdminAuth";
import NotFound from "./pages/NotFound";
import OrderTracking from "./pages/customer/OrderTracking";
import Checkout from "./pages/customer/Checkout";
import OrderSuccess from "./pages/customer/OrderSuccess";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />

          {/* Customer Routes */}
          <Route path="/customer" element={<CustomerApp />} />
          <Route path="/customer/auth" element={<CustomerAuth />} />
          <Route path="/customer/track/:orderId" element={<OrderTracking />} />
          <Route path="/customer/checkout" element={<Checkout />} />
          <Route path="/customer/success/:orderId" element={<OrderSuccess />} />

          {/* Vendor Routes */}
          <Route path="/vendor" element={<VendorApp />} />
          <Route path="/vendor/auth" element={<VendorAuth />} />

          {/* Admin Routes */}
          <Route path="/admin" element={<AdminApp />} />
          <Route path="/admin/auth" element={<AdminAuth />} />

          {/* Catch-all route */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
