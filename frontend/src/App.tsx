import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useParams,
} from "react-router-dom";

import AppShell from "./components/layout/AppShell";
import Assistant from "./pages/Assistant";
import Dashboard from "./pages/Dashboard";
import Finance from "./pages/Finance";
import Goals from "./pages/Goals";
import Habits from "./pages/Habits";
import Journal from "./pages/Journal";
import Learning from "./pages/Learning";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Settings from "./pages/Settings";
import SectionHistory from "./pages/SectionHistory";
import Tasks from "./pages/Tasks";
import CompletedTasks from "./pages/CompletedTasks";
import GoalProgress from "./pages/GoalProgress";
import HabitProgress from "./pages/HabitProgress";
import FinanceLayout from "./pages/finance/FinanceLayout";
import FinanceTransactions from "./pages/finance/FinanceTransactions";
import FinanceTransactionForm from "./pages/finance/FinanceTransactionForm";
import FinanceTransactionDetails from "./pages/finance/FinanceTransactionDetails";
import FinanceManagement from "./pages/finance/FinanceManagement";
import FinanceReports from "./pages/finance/FinanceReports";
import BankAccounts from "./pages/finance/BankAccounts";

function ProtectedRoute() {
  const token = localStorage.getItem("access_token");

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

function LegacyBankAccountRedirect() {
  const { accountId } = useParams();
  return <Navigate to={accountId ? `/finance/bank-accounts/${accountId}` : "/finance/bank-accounts"} replace />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route index element={<Dashboard />} />
            <Route path="dashboard" element={<Dashboard />} />

            <Route path="tasks">
              <Route index element={<Tasks />} />
              <Route path="completed" element={<CompletedTasks />} />
            </Route>

            <Route path="goals">
              <Route index element={<Goals />} />
              <Route path=":goalId/:view" element={<GoalProgress />} />
            </Route>

            <Route path="habits">
              <Route index element={<Habits />} />
              <Route path=":habitId/:view" element={<HabitProgress />} />
            </Route>

            <Route path="income">
              <Route index element={<Navigate to="/finance" replace />} />
              <Route path="bank-accounts" element={<Navigate to="/finance/bank-accounts" replace />} />
              <Route path="bank-accounts/:accountId" element={<LegacyBankAccountRedirect />} />
            </Route>

            <Route path="finance" element={<FinanceLayout />}>
              <Route index element={<Finance />} />
              <Route path="income" element={<FinanceTransactions kind="income" />} />
              <Route path="expenses" element={<FinanceTransactions kind="expense" />} />
              <Route path="income/new" element={<FinanceTransactionForm initialKind="income" />} />
              <Route path="expenses/new" element={<FinanceTransactionForm initialKind="expense" />} />
              <Route path="transactions/:transactionId" element={<FinanceTransactionDetails />} />
              <Route path="transactions/:transactionId/edit" element={<FinanceTransactionForm />} />
              <Route path="budgets" element={<FinanceManagement section="budgets" />} />
              <Route path="savings" element={<FinanceManagement section="savings" />} />
              <Route path="goals" element={<FinanceManagement section="goals" />} />
              <Route path="bank-accounts" element={<BankAccounts />} />
              <Route path="bank-accounts/:accountId" element={<BankAccounts />} />
              <Route path="categories" element={<FinanceManagement section="categories" />} />
              <Route path="recurring" element={<FinanceManagement section="recurring" />} />
              <Route path="reports" element={<FinanceReports />} />
              <Route path="history" element={<Navigate to="/history/income" replace />} />
            </Route>

            <Route path="learning" element={<Learning />} />
            <Route path="journal" element={<Journal />} />

            <Route path="settings">
              <Route index element={<Settings />} />
              <Route path=":category" element={<Settings />} />
            </Route>

            <Route path="assistant" element={<Assistant />} />

            <Route path="history/:section" element={<SectionHistory />} />
            <Route path="history/:section/:solarYear/:solarMonth" element={<SectionHistory />} />
          </Route>
        </Route>

        <Route
          path="*"
          element={<Navigate to="/dashboard" replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
