import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import { ErrorDialog, Toaster } from "./components/ui/toast";
import AppRoutes from "./routes/AppRoutes";

const App = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <>
      <AppRoutes />
      <Toaster />
      <ErrorDialog />
    </>
  );
};

export default App;
