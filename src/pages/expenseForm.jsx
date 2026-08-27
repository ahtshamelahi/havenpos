import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppLayout from '../components/AppLayout.jsx';
import ExpenseFormDialog from '../components/expenses/ExpenseFormDialog.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function ExpenseForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { business } = useAuth();
  const [open, setOpen] = useState(true);

  useEffect(() => {
    setOpen(true);
  }, [id]);

  return (
    <AppLayout>
      <ExpenseFormDialog
        open={open}
        expenseId={id || null}
        business={business}
        onClose={() => {
          setOpen(false);
          navigate('/expenses');
        }}
        onSaved={() => navigate('/expenses')}
      />
    </AppLayout>
  );
}