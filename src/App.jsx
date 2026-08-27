import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/login.jsx';
import Signup from './pages/signup.jsx';
import ForgotPassword from './pages/forgotPassword.jsx';
import ResetPassword from './pages/resetPassword.jsx';
import Dashboard from './pages/dashboard.jsx';
import Users from './pages/users.jsx';
import UserForm from './pages/userForm.jsx';
import Products from './pages/products.jsx';
import ProductForm from './pages/productForm.jsx';
import Categories from './pages/categories.jsx';
import TaxRates from './pages/taxRates.jsx';
import Contacts from './pages/contacts.jsx';
import ContactForm from './pages/contactForm.jsx';
import Purchases from './pages/purchases.jsx';
import PurchaseForm from './pages/purchaseForm.jsx';
import PurchaseReturns from './pages/purchaseReturns.jsx';
import PurchaseReturnForm from './pages/purchaseReturnForm.jsx';
import Sales from './pages/sales.jsx';
import SaleForm from './pages/saleForm.jsx';
import SalesDue from './pages/salesDue.jsx';
import PurchaseDue from './pages/purchaseDue.jsx';
import SellReturns from './pages/sellReturns.jsx';
import SellReturnForm from './pages/sellReturnForm.jsx';
import Stock from './pages/stock.jsx';
import PosBilling from './pages/posBilling.jsx';
import Expenses from './pages/expenses.jsx';
import ExpenseForm from './pages/expenseForm.jsx';
import ExpenseCategories from './pages/expenseCategories.jsx';
import RecurringExpenses from './pages/recurringExpenses.jsx';
import RecurringExpenseForm from './pages/recurringExpenseForm.jsx';
import ReportsIndex from './pages/reportsIndex.jsx';
import SalesReport from './pages/salesReport.jsx';
import ProfitLossReport from './pages/profitLossReport.jsx';
import StockReport from './pages/stockReport.jsx';
import CustomersReport from './pages/customersReport.jsx';
import SuppliersReport from './pages/suppliersReport.jsx';
import ExpensesReport from './pages/expensesReport.jsx';
import UserActivityReport from './pages/userActivityReport.jsx';
import DailyItemsReport from './pages/dailyItemsReport.jsx';
import SettingsIndex from './pages/settingsIndex.jsx';
import BusinessSettings from './pages/businessSettings.jsx';
import Locations from './pages/locations.jsx';
import LocationForm from './pages/locationForm.jsx';
import InvoiceReceiptSettings from './pages/invoiceReceiptSettings.jsx';
import UserPreferences from './pages/userPreferences.jsx';
import AccountInactive from './pages/accountInactive.jsx';
import Placeholder from './pages/placeholder.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import useInactivityLogout from './hooks/useInactivityLogout.js';
import Registers from './pages/registers.jsx';
import RegisterReport from './pages/registerReport.jsx';
import ActiveRegister from './pages/activeRegister.jsx';

export default function App() {
  useInactivityLogout(3_600_000);

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/account-inactive" element={<AccountInactive />} />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/users"
        element={
          <ProtectedRoute module="user_management" action="view">
            <Users />
          </ProtectedRoute>
        }
      />
      <Route
        path="/users/new"
        element={
          <ProtectedRoute module="user_management" action="create">
            <UserForm />
          </ProtectedRoute>
        }
      />
      <Route
        path="/users/:id"
        element={
          <ProtectedRoute module="user_management" action="edit">
            <UserForm />
          </ProtectedRoute>
        }
      />

      {/* Products */}
      <Route
        path="/products"
        element={
          <ProtectedRoute module="products" action="view">
            <Products />
          </ProtectedRoute>
        }
      />
      <Route
        path="/products/new"
        element={
          <ProtectedRoute module="products" action="create">
            <ProductForm />
          </ProtectedRoute>
        }
      />
      <Route
        path="/products/:id/edit"
        element={
          <ProtectedRoute module="products" action="edit">
            <ProductForm />
          </ProtectedRoute>
        }
      />

      <Route
        path="/categories"
        element={
          <ProtectedRoute module="products" action="view">
            <Categories />
          </ProtectedRoute>
        }
      />
      <Route
        path="/tax-rates"
        element={
          <ProtectedRoute module="products" action="view">
            <TaxRates />
          </ProtectedRoute>
        }
      />

      <Route
        path="/contacts"
        element={
          <ProtectedRoute module="contacts" action="view">
            <Contacts />
          </ProtectedRoute>
        }
      />
      <Route
        path="/contacts/new"
        element={
          <ProtectedRoute module="contacts" action="create">
            <ContactForm />
          </ProtectedRoute>
        }
      />
      <Route
        path="/contacts/:id"
        element={
          <ProtectedRoute module="contacts" action="edit">
            <ContactForm />
          </ProtectedRoute>
        }
      />

      <Route
        path="/purchases"
        element={
          <ProtectedRoute module="purchases" action="view">
            <Purchases />
          </ProtectedRoute>
        }
      />
      <Route
        path="/purchases/due"
        element={
          <ProtectedRoute module="purchases" action="view">
            <PurchaseDue />
          </ProtectedRoute>
        }
      />
      <Route
        path="/purchases/new"
        element={
          <ProtectedRoute module="purchases" action="create">
            <PurchaseForm />
          </ProtectedRoute>
        }
      />
      <Route
        path="/purchases/returns"
        element={
          <ProtectedRoute module="purchases" action="view">
            <PurchaseReturns />
          </ProtectedRoute>
        }
      />
      <Route
        path="/purchases/returns/new"
        element={
          <ProtectedRoute module="purchases" action="create">
            <PurchaseReturnForm />
          </ProtectedRoute>
        }
      />

      <Route
        path="/sales"
        element={
          <ProtectedRoute module="sales" action="view">
            <Sales />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sales/due"
        element={
          <ProtectedRoute module="sales" action="view">
            <SalesDue />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sales/new"
        element={
          <ProtectedRoute module="sales" action="create">
            <SaleForm />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sales/returns"
        element={
          <ProtectedRoute module="sales" action="view">
            <SellReturns />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sales/returns/new"
        element={
          <ProtectedRoute module="sales" action="create">
            <SellReturnForm />
          </ProtectedRoute>
        }
      />

      {/* Modules queued next in the build order */}
      <Route
        path="/pos"
        element={
          <ProtectedRoute module="pos" action="view">
            <PosBilling />
          </ProtectedRoute>
        }
      />
      <Route
        path="/stock"
        element={
          <ProtectedRoute module="stock" action="view">
            <Stock />
          </ProtectedRoute>
        }
      />
      <Route
        path="/expenses"
        element={
          <ProtectedRoute module="expenses" action="view">
            <Expenses />
          </ProtectedRoute>
        }
      />
      <Route
        path="/expenses/new"
        element={
          <ProtectedRoute module="expenses" action="create">
            <ExpenseForm />
          </ProtectedRoute>
        }
      />
      <Route
        path="/expenses/:id"
        element={
          <ProtectedRoute module="expenses" action="edit">
            <ExpenseForm />
          </ProtectedRoute>
        }
      />
      <Route
        path="/expense-categories"
        element={
          <ProtectedRoute module="expenses" action="view">
            <ExpenseCategories />
          </ProtectedRoute>
        }
      />
      <Route
        path="/recurring-expenses"
        element={
          <ProtectedRoute module="expenses" action="view">
            <RecurringExpenses />
          </ProtectedRoute>
        }
      />
      <Route
        path="/recurring-expenses/new"
        element={
          <ProtectedRoute module="expenses" action="create">
            <RecurringExpenseForm />
          </ProtectedRoute>
        }
      />
      <Route
        path="/recurring-expenses/:id"
        element={
          <ProtectedRoute module="expenses" action="edit">
            <RecurringExpenseForm />
          </ProtectedRoute>
        }
      />

      <Route
        path="/reports"
        element={
          <ProtectedRoute module="reports" action="view">
            <ReportsIndex />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports/sales"
        element={
          <ProtectedRoute module="reports" action="view">
            <SalesReport />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports/purchases"
        element={
          <ProtectedRoute module="reports" action="view">
            <SalesReport />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports/profit-loss"
        element={
          <ProtectedRoute module="reports" action="view">
            <ProfitLossReport />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports/stock"
        element={
          <ProtectedRoute module="reports" action="view">
            <StockReport />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports/customers"
        element={
          <ProtectedRoute module="reports" action="view">
            <CustomersReport />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports/suppliers"
        element={
          <ProtectedRoute module="reports" action="view">
            <SuppliersReport />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports/expenses"
        element={
          <ProtectedRoute module="reports" action="view">
            <ExpensesReport />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports/user-activity"
        element={
          <ProtectedRoute module="reports" action="view">
            <UserActivityReport />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports/daily-items"
        element={
          <ProtectedRoute module="reports" action="view">
            <DailyItemsReport />
          </ProtectedRoute>
        }
      />

      <Route
        path="/settings"
        element={
          <ProtectedRoute module="settings" action="view">
            <SettingsIndex />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/business"
        element={
          <ProtectedRoute module="settings" action="edit">
            <BusinessSettings />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/locations"
        element={
          <ProtectedRoute module="settings" action="view">
            <Locations />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/locations/new"
        element={
          <ProtectedRoute module="settings" action="create">
            <LocationForm />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/locations/:id"
        element={
          <ProtectedRoute module="settings" action="edit">
            <LocationForm />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/invoice"
        element={
          <ProtectedRoute module="settings" action="edit">
            <InvoiceReceiptSettings />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/preferences"
        element={
          <ProtectedRoute>
            <UserPreferences />
          </ProtectedRoute>
        }
      />

      <Route
        path="/shipments"
        element={
          <ProtectedRoute module="sales">
            <Placeholder title="Shipments" />
          </ProtectedRoute>
        }
      />

      <Route
  path="/registers"
  element={
    <ProtectedRoute module="pos" action="view">
      <Registers />
    </ProtectedRoute>
  }
/>
<Route
  path="/registers/:id"
  element={
    <ProtectedRoute module="pos" action="view">
      <RegisterReport />
    </ProtectedRoute>
  }
/>

<Route
        path="/active-register"
        element={
          <ProtectedRoute module="pos" action="view">
            <ActiveRegister />
          </ProtectedRoute>
        }
      />

      {/* Catch-all */}
      <Route
        path="*"
        element={<Navigate to="/dashboard" replace />}
      />
    </Routes>
  );
}