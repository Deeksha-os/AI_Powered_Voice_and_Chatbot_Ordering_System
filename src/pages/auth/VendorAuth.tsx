import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Store, Leaf, Clock, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const VendorAuth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [storeName, setStoreName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPhone, setSignupPhone] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [verificationStatus, setVerificationStatus] = useState<{status: string, message: string} | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const checkVerificationStatus = async (email: string) => {
    try {
      const res = await fetch(`/api/vendor/verification-status/${email}`);
      const data = await res.json();
      
      if (data.success) {
        setVerificationStatus({
          status: data.status,
          message: data.message
        });
      }
    } catch (e) {
      console.error('Error checking verification status:', e);
    }
  };

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
        
        if (!res.ok) {
          if (data?.status === "pending") {
            toast({ 
              title: "Account Pending Approval", 
              description: data?.message || "Your vendor account is pending admin approval. Please wait for verification.",
              variant: "default"
            });
            return;
          }
          if (data?.status === "rejected") {
            toast({ 
              title: "Application Rejected", 
              description: data?.message || "Your vendor application was rejected. Please contact support.",
              variant: "destructive"
            });
            return;
          }
          throw new Error(data?.error || "Login failed");
        }
        
        if (data?.user?.role !== "vendor") throw new Error("Not a vendor account");
        // Store user data in localStorage for session management
        localStorage.setItem("user", JSON.stringify(data.user));
        localStorage.setItem("isAuthenticated", "true");
        toast({ title: "Vendor Login Successful", description: "Welcome to your vendor dashboard!" });
        navigate("/vendor");
      } else {
        const res = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: signupEmail, password: signupPassword, role: "vendor", storeName, ownerName, phone: signupPhone })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Registration failed");
        
        // Show success message for verification request
        toast({ 
          title: "Verification Request Submitted", 
          description: "Your vendor registration has been submitted for admin approval. You will be notified once approved.",
          variant: "default"
        });
        
        // Clear form
        setStoreName("");
        setOwnerName("");
        setSignupEmail("");
        setSignupPhone("");
        setSignupPassword("");
      }
    } catch (e: any) {
      toast({ title: "Auth error", description: e.message || String(e) });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-warm flex items-center justify-center p-4">
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
            <div className="mx-auto w-12 h-12 bg-secondary rounded-full flex items-center justify-center mb-4">
              <Store className="h-6 w-6 text-secondary-foreground" />
            </div>
            <CardTitle className="text-2xl">Vendor Portal</CardTitle>
            <CardDescription>
              Manage your store and inventory
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="signup">Register</TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="vendor-email">Email</Label>
                  <Input id="vendor-email" type="email" placeholder="Enter your email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vendor-password">Password</Label>
                  <Input id="vendor-password" type="password" placeholder="Enter your password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} />
                </div>
                <Button
                  onClick={() => handleAuth("login")}
                  className="w-full bg-secondary hover:bg-secondary-light"
                  disabled={isLoading}
                >
                  {isLoading ? "Logging in..." : "Login to Dashboard"}
                </Button>
              </TabsContent>

              <TabsContent value="signup" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="store-name">Store Name</Label>
                  <Input id="store-name" placeholder="Enter your store name" value={storeName} onChange={(e) => setStoreName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="owner-name">Owner Name</Label>
                  <Input id="owner-name" placeholder="Enter owner's full name" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vendor-signup-email">Email</Label>
                  <Input id="vendor-signup-email" type="email" placeholder="Enter your email" value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vendor-phone">Phone Number</Label>
                  <Input id="vendor-phone" type="tel" placeholder="Enter your phone number" value={signupPhone} onChange={(e) => setSignupPhone(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vendor-signup-password">Password</Label>
                  <Input id="vendor-signup-password" type="password" placeholder="Create a password" value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)} />
                </div>
                <Button
                  onClick={() => handleAuth("signup")}
                  className="w-full bg-secondary hover:bg-secondary-light"
                  disabled={isLoading}
                >
                  {isLoading ? "Registering..." : "Register Store"}
                </Button>
                
                {/* Verification Status Check */}
                <div className="mt-6 p-4 border rounded-lg bg-gray-50">
                  <h3 className="font-semibold mb-2">Check Verification Status</h3>
                  <p className="text-sm text-gray-600 mb-3">
                    Already submitted a registration? Check your verification status.
                  </p>
                  <div className="flex gap-2">
                    <Input 
                      placeholder="Enter your email" 
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                    />
                    <Button 
                      onClick={() => checkVerificationStatus(loginEmail)}
                      variant="outline"
                      disabled={!loginEmail}
                    >
                      Check Status
                    </Button>
                  </div>
                  
                  {verificationStatus && (
                    <div className="mt-3 p-3 rounded-lg border">
                      <div className="flex items-center gap-2">
                        {verificationStatus.status === 'pending' && <Clock className="h-4 w-4 text-yellow-500" />}
                        {verificationStatus.status === 'approved' && <CheckCircle className="h-4 w-4 text-green-500" />}
                        {verificationStatus.status === 'rejected' && <XCircle className="h-4 w-4 text-red-500" />}
                        <span className="font-medium capitalize">{verificationStatus.status}</span>
                      </div>
                      {verificationStatus.message && (
                        <p className="text-sm text-gray-600 mt-1">{verificationStatus.message}</p>
                      )}
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default VendorAuth;