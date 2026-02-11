import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ShoppingCart, Leaf } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const CustomerAuth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"login" | "signup">("login");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPhone, setSignupPhone] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleAuth = async (type: "login" | "signup") => {
    setIsLoading(true);
    try {
      if (type === "login") {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: loginEmail, password: loginPassword })
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Login failed");
        if (data?.user?.role !== "customer") throw new Error("Not a customer account");
        // Store user data in localStorage for session management, enriched with saved profile
        try {
          const profilesRaw = localStorage.getItem("profiles");
          const profiles = profilesRaw ? JSON.parse(profilesRaw) : {};
          const profile = profiles?.[data.user.email] || {};
          const enrichedUser = { ...data.user, ...profile };
          localStorage.setItem("user", JSON.stringify(enrichedUser));
        } catch {
          localStorage.setItem("user", JSON.stringify(data.user));
        }
        localStorage.setItem("isAuthenticated", "true");
        toast({ title: "Customer Login Successful", description: "Welcome to FreshMarket!" });
        navigate("/customer");
      } else {
        const res = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: signupEmail, password: signupPassword, role: "customer", name: signupName, phone: signupPhone })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Signup failed");
        // Save a local profile so we can show name/phone after login
        try {
          const profilesRaw = localStorage.getItem("profiles");
          const profiles = profilesRaw ? JSON.parse(profilesRaw) : {};
          profiles[signupEmail] = { name: signupName, phone: signupPhone };
          localStorage.setItem("profiles", JSON.stringify(profiles));
        } catch {}
        toast({ title: "Customer Signup Successful", description: "Please log in to continue." });
        setLoginEmail(signupEmail);
        setSignupName("");
        setSignupEmail("");
        setSignupPhone("");
        setSignupPassword("");
        setActiveTab("login");
      }
    } catch (e: any) {
      toast({ title: "Auth error", description: e.message || String(e) });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-fresh flex items-center justify-center p-4">
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
            <div className="mx-auto w-12 h-12 bg-primary rounded-full flex items-center justify-center mb-4">
              <ShoppingCart className="h-6 w-6 text-primary-foreground" />
            </div>
            <CardTitle className="text-2xl">Customer Portal</CardTitle>
            <CardDescription>
              Access your shopping account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" placeholder="Enter your email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" placeholder="Enter your password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} />
                </div>
                <Button
                  onClick={() => handleAuth("login")}
                  className="w-full bg-primary hover:bg-primary-light"
                  disabled={isLoading}
                >
                  {isLoading ? "Logging in..." : "Login"}
                </Button>
              </TabsContent>

              <TabsContent value="signup" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input id="name" placeholder="Enter your full name" value={signupName} onChange={(e) => setSignupName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input id="signup-email" type="email" placeholder="Enter your email" value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input id="phone" type="tel" placeholder="Enter your phone number" value={signupPhone} onChange={(e) => setSignupPhone(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input id="signup-password" type="password" placeholder="Create a password" value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)} />
                </div>
                <Button
                  onClick={() => handleAuth("signup")}
                  className="w-full bg-primary hover:bg-primary-light"
                  disabled={isLoading}
                >
                  {isLoading ? "Creating Account..." : "Create Account"}
                </Button>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CustomerAuth;