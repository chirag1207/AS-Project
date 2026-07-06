import { AuthProvider, useAuth } from "./hooks/useAuth";
import Login from "./pages/Login";
import Shell from "./pages/Shell";
import { Spinner } from "./components/UI";

function Router() {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{ height:"100vh", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <Spinner size={36} />
    </div>
  );
  return user ? <Shell /> : <Login />;
}

export default function App() {
  return (
    <AuthProvider>
      <Router />
    </AuthProvider>
  );
}
