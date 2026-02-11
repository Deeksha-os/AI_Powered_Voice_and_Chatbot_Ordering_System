import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Settings, Leaf, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const AdminAuth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("admin@freshmarket.com");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Login failed");
      if (data?.user?.role !== "admin") throw new Error("Not an admin account");
      // Store user data in localStorage for session management
      localStorage.setItem("user", JSON.stringify(data.user));
      localStorage.setItem("isAuthenticated", "true");
      toast({ title: "Admin Login Successful", description: "Welcome to the admin dashboard!" });
      navigate("/admin");
    } catch (e: any) {
      toast({ title: "Auth error", description: e.message || String(e) });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-primary flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            className="absolute left-4 top-4 text-white hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="flex items-center text-white">
            <Leaf className="h-8 w-8 mr-2" />
            <span className="text-2xl font-bold">FreshMarket</span>
          </div>
        </div>

        <Card className="shadow-strong">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-accent rounded-full flex items-center justify-center mb-4">
              <Shield className="h-6 w-6 text-accent-foreground" />
            </div>
            <CardTitle className="text-2xl">Admin Portal</CardTitle>
            <CardDescription>
              System administration access
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-email">Admin Email</Label>
              <Input id="admin-email" type="email" placeholder="Enter admin email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-password">Admin Password</Label>
              <Input id="admin-password" type="password" placeholder="Enter admin password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div className="bg-muted p-3 rounded-lg">
              <div className="flex items-center text-muted-foreground text-sm">
                <Settings className="h-4 w-4 mr-2" />
                <span>Secure administrative access only</span>
              </div>
            </div>
            <Button
              onClick={handleLogin}
              className="w-full bg-accent hover:bg-accent-light"
              disabled={isLoading}
            >
              {isLoading ? "Authenticating..." : "Access Admin Dashboard"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminAuth;