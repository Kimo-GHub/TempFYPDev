
import ExpensiPage from "./Pages/ExpensiPage.jsx";
import ExpensiChat from "./components/ExpensiChat";



import { Routes, Route, Navigate } from "react-router-dom";
import Home from "./Pages/Home.jsx";
import Automate from "./Pages/Automate.jsx";

// Auth
import Login from "./Pages/Auth/Login";
import Register from "./Pages/Auth/Register";

// Admin (aliased)
import AdminLayout from "./Pages/Admin/AdminLayout";
import AdminDashboard from "./Pages/Admin/AdminDashboard";
import AdminUsers from "./Pages/Admin/Users";
import AdminTransactions from "./Pages/Admin/Transactions";
import AdminAccounts from "./Pages/Admin/Accounts";
import AdminProjects from "./Pages/Admin/AdminProjects";
import Reports from "./Pages/Admin/Reports";
import Arima from "./Pages/Admin/Arima";
import AdminCategories from "./Pages/Admin/AdminCategories";
import AdminInvestments from "./Pages/Admin/Investments";

// User (aliased)
import UserLayout from "./Pages/User/UserLayout";
import UserDashboard from "./Pages/User/UserDashboard";
import Profile from "./Pages/User/Profile";
import UserAccounts from "./Pages/User/Accounts";
import UserTransactions from "./Pages/User/Transactions";
import Projects from "./Pages/User/Projects";
import Budgets from "./Pages/User/Budgets";
import Categories from "./Pages/User/Categories";
import Analytics from "./Pages/User/Analytics";
import UserInvestments from "./Pages/User/Investments";
import UserStocks from "./Pages/User/Stocks";
import { expensiPalettes } from "./theme/expensiPalette";

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem("exp_user") || "null");
  } catch {
    return null;
  }
}

export default function App() {
  const expUser = getCurrentUser();
  const isUser = expUser?.id && expUser?.role !== 1;
  const floatingPalette = isUser ? expensiPalettes.user : null;

  return (
    <>
    <Routes>
      {/* Public */}
      <Route path="/" element={<Home />} />
      <Route path="/automate" element={<Automate />} />
      <Route path="/expensi" element={<ExpensiPage />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Admin */}
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminDashboard />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="transactions" element={<AdminTransactions />} />
        <Route path="accounts" element={<AdminAccounts />} />
        <Route path="projects" element={<AdminProjects />} />
        <Route path="categories" element={<AdminCategories />} />
        <Route path="reports" element={<Reports />} />
        <Route path="arima" element={<Arima />} />
        <Route path="investments" element={<AdminInvestments />} />
      </Route>

      {/* User */}
      <Route path="/user" element={<UserLayout />}>
        <Route index element={<UserDashboard />} />
        <Route path="profile" element={<Profile />} />
        <Route path="accounts" element={<UserAccounts />} />
        <Route path="transactions" element={<UserTransactions />} />
        <Route path="projects" element={<Projects />} />
        <Route path="budgets" element={<Budgets />} />
        <Route path="categories" element={<Categories />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="investments" element={<UserInvestments />} />
        <Route path="stocks" element={<UserStocks />} />
      </Route>

      {/* Support old/typed link */}
      <Route path="/user/home" element={<Navigate to="/user" replace />} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>

    <ExpensiChat palette={floatingPalette} />
    </>
  );
}
