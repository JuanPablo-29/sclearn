import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import Decks from "@/pages/Decks";
import Home from "@/pages/Home";
import Landing from "@/pages/Landing";
import Learn from "@/pages/Learn";
import Login from "@/pages/Login";
import Privacy from "@/pages/Privacy";
import Register from "@/pages/Register";
import SharedDeck from "@/pages/SharedDeck";
import Terms from "@/pages/Terms";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/app" element={<Home />} />
          <Route path="/learn" element={<Learn />} />
          <Route path="/decks" element={<Decks />} />
          <Route path="/deck/:slug" element={<SharedDeck />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
