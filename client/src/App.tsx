import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { Router, Route, Switch } from "wouter";
import Index from "./pages/Index";
import DynamicAdminPanel from "./pages/DynamicAdminPanel";
import AdminLogin from "./pages/AdminLogin";
import PromoterLogin from "./pages/PromoterLogin";
import PromoterDashboard from "./pages/PromoterDashboard";
import BookingPage from "./pages/BookingPage";
import Scanner from "./components/Scanner";
import { queryClient } from "@/lib/queryClient";

const AdminRoute = () => {
  const adminToken = localStorage.getItem('adminToken');
  const adminUser = localStorage.getItem('adminUser');
  
  if (!adminToken || !adminUser) {
    return <AdminLogin onLogin={() => window.location.reload()} />;
  }
  
  return <DynamicAdminPanel user={JSON.parse(adminUser)} onLogout={() => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    window.location.reload();
  }} />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <Router>
        <Switch>
          <Route path="/" component={Index} />
          <Route path="/book" component={BookingPage} />
          <Route path="/farazkivumdha" component={AdminRoute} />
          <Route path="/promoter/login" component={PromoterLogin} />
          <Route path="/promoter/dashboard/:promoCode" component={PromoterDashboard} />
          <Route path="/scanner">
            {() => {
              const adminToken = localStorage.getItem('adminToken');
              const adminUser = localStorage.getItem('adminUser');
              
              if (!adminToken || !adminUser) {
                return <AdminLogin onLogin={() => window.location.reload()} />;
              }
              
              return <Scanner />;
            }}
          </Route>
          <Route>404: Not Found</Route>
        </Switch>
      </Router>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
