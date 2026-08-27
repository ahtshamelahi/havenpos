import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import AppLayout from '../components/AppLayout.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabaseClient';
import './userForm.css';

const emptyForm = {
  contact_type: 'customer',
  name: '',
  contact_number: '',
  alternate_number: '',
  email: '',
  landline: '',
  opening_balance: '0',
  address: '',
  city: '',
  country: '',
  tax_ntn_number: '',
  is_active: true,
  business_name: '',
};

export default function ContactForm() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { business } = useAuth();

  const [form, setForm] = useState({
    ...emptyForm,
    contact_type: searchParams.get('type') || 'customer',
  });

  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isEdit) return;

    const loadContact = async () => {
      const { data, error: err } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', id)
        .single();

      if (err) {
        setError(err.message);
      } else if (data) {
        setForm({
          ...emptyForm,
          ...data,
          name: data.name || '',
          contact_number: data.contact_number || '',
          alternate_number: data.alternate_number || '',
          email: data.email || '',
          landline: data.landline || '',
          city: data.city || '',
          country: data.country || '',
          opening_balance: String(data.opening_balance ?? 0),
          address: data.address || '',
          tax_ntn_number: data.tax_ntn_number || '',
          business_name: data.business_name || '',
        });
      }

      setLoading(false);
    };

    loadContact();
  }, [isEdit, id]);

  const update = (key) => (e) => {
    const value =
      e.target.type === 'checkbox'
        ? e.target.checked
        : e.target.value;

    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.name.trim() || !form.contact_number.trim()) {
      setError('Name and contact number are required.');
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        business_id: business.id,
        contact_type: form.contact_type,
        name: form.name.trim(),
        contact_number: form.contact_number.trim(),
        alternate_number: form.alternate_number.trim() || null,
        email: form.email.trim() || null,
        landline: form.landline.trim() || null,
        opening_balance: Number(form.opening_balance || 0),
        address: form.address.trim() || null,
        city: form.city.trim() || null,
        country: form.country.trim() || null,

        // Only suppliers can have a Tax / NTN number
        tax_ntn_number:
          form.contact_type === 'supplier'
            ? form.tax_ntn_number.trim() || null
            : null,

        is_active: form.is_active,
        business_name: form.business_name.trim() || null,
      };

      if (isEdit) {
        const { error: err } = await supabase
          .from('contacts')
          .update(payload)
          .eq('id', id);

        if (err) throw err;
      } else {
        const { error: err } = await supabase
          .from('contacts')
          .insert(payload);

        if (err) throw err;
      }

      navigate('/contacts');
    } catch (err) {
      setError(
        err.message || 'Could not save this contact.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="muted">Loading…</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="page-header">
        <div>
          <h1>
            {isEdit
              ? 'Edit contact'
              : `Add ${form.contact_type}`}
          </h1>

          <p className="muted">
            Contacts are shared across sales, purchases, and ledgers.
          </p>
        </div>

        <button
          className="btn btn-secondary"
          onClick={() => navigate('/contacts')}
        >
          Cancel
        </button>
      </div>

      <form
        onSubmit={handleSubmit}
        className="user-form"
      >
        <section className="card form-section">
          <h2>Contact details</h2>

          <div className="form-grid">
            <div className="field">
              <label>Type</label>

              <select
                value={form.contact_type}
                onChange={update('contact_type')}
                disabled={isEdit}
              >
                <option value="customer">
                  Customer
                </option>

                <option value="supplier">
                  Supplier
                </option>
              </select>
            </div>

            <div className="field">
              <label>Name *</label>

              <input
                value={form.name}
                onChange={update('name')}
                required
              />
            </div>

            <div className="field">
              <label>Contact number *</label>

              <input
                value={form.contact_number}
                onChange={update('contact_number')}
                required
              />
            </div>

            <div className="field">
              <label>Alternate number</label>

              <input
                value={form.alternate_number}
                onChange={update('alternate_number')}
              />
            </div>

            <div className="field">
              <label>Email</label>

              <input
                type="email"
                value={form.email}
                onChange={update('email')}
              />
            </div>

            <div className="field">
              <label>Landline</label>

              <input
                value={form.landline}
                onChange={update('landline')}
              />
            </div>

            <div className="field">
              <label>Business name</label>

              <input
                value={form.business_name}
                onChange={update('business_name')}
              />
            </div>

            <div className="field">
              <label>City</label>

              <input
                value={form.city}
                onChange={update('city')}
              />
            </div>

            <div className="field">
              <label>Country</label>

              <input
                value={form.country}
                onChange={update('country')}
              />
            </div>

            {form.contact_type === 'supplier' && (
              <div className="field">
                <label>Tax / NTN number</label>

                <input
                  value={form.tax_ntn_number}
                  onChange={update('tax_ntn_number')}
                />
              </div>
            )}

            <div className="field">
              <label>Opening balance</label>

              <input
                type="number"
                step="0.01"
                value={form.opening_balance}
                onChange={update('opening_balance')}
              />
            </div>

            <div className="field checkbox-field">
              <label>
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={update('is_active')}
                />

                Active
              </label>
            </div>
          </div>

          <div className="field">
            <label>Address</label>

            <textarea
              rows="3"
              value={form.address}
              onChange={update('address')}
              placeholder="Enter complete address"
            />
          </div>
        </section>

        {error && (
          <div className="error-text">
            {error}
          </div>
        )}

        <div className="form-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate('/contacts')}
          >
            Cancel
          </button>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting}
          >
            {submitting
              ? 'Saving…'
              : isEdit
                ? 'Save changes'
                : 'Create contact'}
          </button>
        </div>
      </form>
    </AppLayout>
  );
}