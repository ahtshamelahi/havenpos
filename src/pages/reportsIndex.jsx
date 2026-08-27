import { Link } from 'react-router-dom';
import AppLayout from '../components/AppLayout.jsx';
import './reportsIndex.css';

const REPORTS = [
  { to: '/registers', title: 'Register Reports', desc: 'Cash drawer open/close history and session summaries.', icon: '📠' },
  { to: '/reports/sales', title: 'Sales & Purchase', desc: 'Consolidated sales and purchase report with returns and dues — side by side.', icon: '💵' },
  { to: '/reports/profit-loss', title: 'Profit & Loss', desc: 'Revenue minus cost of goods sold and expenses.', icon: '📈' },
  { to: '/reports/stock', title: 'Stock', desc: 'On-hand quantities and inventory value by location.', icon: '📊' },
  { to: '/reports/customers', title: 'Customers', desc: 'Purchase activity and balances owed per customer.', icon: '👥' },
  { to: '/reports/suppliers', title: 'Suppliers', desc: 'Purchase activity and balances owed per supplier.', icon: '🚚' },
  { to: '/reports/expenses', title: 'Expenses', desc: 'Spend broken down by category and location.', icon: '🧮' },
  { to: '/reports/user-activity', title: 'User Activity', desc: 'Sales and purchases processed per staff member.', icon: '🔐' },
  { to: '/reports/daily-items', title: 'Daily Items', desc: 'Products sold and quantities for any date range — with PDF and print export.', icon: '📦' },
];


export default function ReportsIndex() {
  return (
    <AppLayout>
      <div className="page-header">
        <div>
          <h1>Reports | Filtered and Printable</h1>

        </div>
      </div>

      <div className="reports-grid">
        {REPORTS.map((r) => (
          <Link key={r.to} to={r.to} className="card report-card">
            <div className="report-card-icon">{r.icon}</div>
            <div className="report-card-title">{r.title}</div>
            <div className="muted report-card-desc">{r.desc}</div>
          </Link>
        ))}
      </div>
    </AppLayout>
  );
}
