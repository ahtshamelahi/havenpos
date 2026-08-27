import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext.jsx';
import './signup.css';

const TIME_ZONES = Intl.supportedValuesOf ? Intl.supportedValuesOf('timeZone') : ['UTC'];

const initialForm = {
  // business
  business_name: '',
  currency: 'PKR',
  contact_number: '',
  alternate_contact: '',
  country: '',
  state: '',
  city: '',
  zip_code: '',
  landmark: '',
  website_link: '',
  time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  business_start_date: '',
  referral_code_input: '',
  // owner
  first_name: '',
  last_name: '',
  username: '',
  mobile_number: '',
  current_address: '',
  email: '',
  password: '',
  confirm_password: '',
};

function pad5(n) {
  return String(n).padStart(5, '0');
}

export default function Signup() {
  const navigate = useNavigate();
  const { applySession } = useAuth();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const validateStep1 = () => {
    if (!form.business_name || !form.currency || !form.contact_number || !form.country || !form.city || !form.time_zone) {
      setError('Please fill in all required business fields.');
      return false;
    }
    setError('');
    return true;
  };

  const validateStep2 = () => {
    if (!form.first_name || !form.username || !form.mobile_number || !form.current_address || !form.email || !form.password) {
      setError('Please fill in all required account fields.');
      return false;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return false;
    }
    if (form.password !== form.confirm_password) {
      setError('Passwords do not match.');
      return false;
    }
    setError('');
    return true;
  };

  const goNext = () => {
    if (validateStep1()) setStep(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateStep2()) return;
    setSubmitting(true);
    setError('');

    let createdBusinessId = null;

    try {
      // 1. Create the Supabase Auth account for the owner.
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
      });
      if (authError) throw authError;

      const authUser = authData.user;
      if (!authUser) {
        throw new Error('Sign up succeeded but no user was returned — check your email confirmation settings.');
      }

      // 2. Create the business row (status defaults to 'trial' in the DB).
      const settings = form.referral_code_input
        ? { referred_by_code: form.referral_code_input.trim() }
        : {};

      const { data: businessRow, error: businessError } = await supabase
        .from('businesses')
        .insert({
          business_name: form.business_name,
          business_start_date: form.business_start_date || null,
          currency: form.currency,
          website_link: form.website_link || null,
          contact_number: form.contact_number,
          alternate_contact: form.alternate_contact || null,
          country: form.country,
          state: form.state || null,
          city: form.city,
          zip_code: form.zip_code || null,
          landmark: form.landmark || null,
          time_zone: form.time_zone,
          settings,
        })
        .select()
        .single();
      if (businessError) throw businessError;
      createdBusinessId = businessRow.id;

      // 3. Create the matching public.users row for the owner — this must
      // happen immediately after the business exists and before any other
      // write, because every other RLS policy on this business (including
      // updating it) resolves current_business_id() by looking up this row.
      const { error: userError } = await supabase.from('users').insert({
        id: authUser.id,
        business_id: businessRow.id,
        first_name: form.first_name,
        last_name: form.last_name || null,
        username: form.username,
        is_owner: true,
        mobile_number: form.mobile_number,
        current_address: form.current_address,
      });
      if (userError) throw userError;

      // 4. Give the business its own shareable referral code (REF + 5-digit id).
      await supabase
        .from('businesses')
        .update({ referral_code: `REF${pad5(businessRow.id)}` })
        .eq('id', businessRow.id);

      // 5. Default location so the business has somewhere to sell from.
      await supabase.from('locations').insert({
        business_id: businessRow.id,
        name: 'Main Location',
        city: form.city,
        country: form.country,
      });

      if (!authData.session) {
        // Email confirmation is required before a session exists.
        navigate('/login', { state: { message: 'Account created — check your email to verify, then sign in.' } });
      } else {
        await applySession(authData.session);
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      setError(err.message || 'Something went wrong during sign up.');
      // Best-effort cleanup: if the business row was created but the flow
      // failed before it got an owner `users` row, delete it so a retry
      // with the same details doesn't pile up orphaned businesses. The
      // businesses_delete RLS policy only allows this exact case (zero
      // users on the business), so it's safe even if the owner row DID
      // get created — the delete will simply be rejected.
      if (createdBusinessId) {
        await supabase.from('businesses').delete().eq('id', createdBusinessId);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-card card signup-card">
        <div className="auth-brand">
          <div className="auth-brand-mark">P</div>
          <span>POS</span>
        </div>
        <h1 className="auth-title">Create your business account</h1>
        <p className="auth-subtitle muted">Start your free trial — no credit card required.</p>

        <div className="signup-steps">
          <div className={`signup-step ${step === 1 ? 'signup-step-active' : ''}`}>1. Business</div>
          <div className={`signup-step ${step === 2 ? 'signup-step-active' : ''}`}>2. Owner account</div>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {step === 1 && (
            <>
              <div className="form-grid">
                <div className="field">
                  <label>Business name *</label>
                  <input value={form.business_name} onChange={update('business_name')} required />
                </div>
                <div className="field">
                  <label>Currency *</label>
                  <input value={form.currency} onChange={update('currency')} placeholder="USD" required />
                </div>
                <div className="field">
                  <label>Contact number *</label>
                  <input value={form.contact_number} onChange={update('contact_number')} required />
                </div>
                <div className="field">
                  <label>Alternate contact</label>
                  <input value={form.alternate_contact} onChange={update('alternate_contact')} />
                </div>
                <div className="field">
                  <label>Country *</label>
                  <input value={form.country} onChange={update('country')} required />
                </div>
                <div className="field">
                  <label>State</label>
                  <input value={form.state} onChange={update('state')} />
                </div>
                <div className="field">
                  <label>City *</label>
                  <input value={form.city} onChange={update('city')} required />
                </div>
                <div className="field">
                  <label>ZIP code</label>
                  <input value={form.zip_code} onChange={update('zip_code')} />
                </div>
                <div className="field">
                  <label>Landmark</label>
                  <input value={form.landmark} onChange={update('landmark')} />
                </div>
                <div className="field">
                  <label>Website</label>
                  <input value={form.website_link} onChange={update('website_link')} placeholder="https://" />
                </div>
                <div className="field">
                  <label>Time zone *</label>
                  <select value={form.time_zone} onChange={update('time_zone')} required>
                    {TIME_ZONES.map((tz) => (
                      <option key={tz} value={tz}>{tz}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Business start date</label>
                  <input type="date" value={form.business_start_date} onChange={update('business_start_date')} />
                </div>
                <div className="field">
                  <label>Referral code (optional)</label>
                  <input value={form.referral_code_input} onChange={update('referral_code_input')} placeholder="REF00001" />
                </div>
              </div>

              {error && <div className="error-text">{error}</div>}

              <button type="button" className="btn btn-primary auth-submit" onClick={goNext}>
                Continue
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <div className="form-grid">
                <div className="field">
                  <label>First name *</label>
                  <input value={form.first_name} onChange={update('first_name')} required />
                </div>
                <div className="field">
                  <label>Last name</label>
                  <input value={form.last_name} onChange={update('last_name')} />
                </div>
                <div className="field">
                  <label>Username *</label>
                  <input value={form.username} onChange={update('username')} required />
                </div>
                <div className="field">
                  <label>Mobile number *</label>
                  <input value={form.mobile_number} onChange={update('mobile_number')} required />
                </div>
                <div className="field" style={{ gridColumn: '1 / -1' }}>
                  <label>Current address *</label>
                  <input value={form.current_address} onChange={update('current_address')} required />
                </div>
                <div className="field">
                  <label>Email *</label>
                  <input type="email" value={form.email} onChange={update('email')} required />
                </div>
                <div className="field" />
                <div className="field">
  <label>Password *</label>

  <div className="password-input-wrapper">
    <input
      type={showPassword ? 'text' : 'password'}
      value={form.password}
      onChange={update('password')}
      required
    />

    <button
      type="button"
      className="password-toggle"
      onClick={() => setShowPassword((prev) => !prev)}
      aria-label={showPassword ? 'Hide password' : 'Show password'}
    >
      {showPassword ? '🙈' : '👁️'}
    </button>
  </div>
</div>
                <div className="field">
  <label>Confirm password *</label>

  <div className="password-input-wrapper">
    <input
      type={showConfirmPassword ? 'text' : 'password'}
      value={form.confirm_password}
      onChange={update('confirm_password')}
      required
    />

    <button
      type="button"
      className="password-toggle"
      onClick={() => setShowConfirmPassword((prev) => !prev)}
      aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
    >
      {showConfirmPassword ? '🙈' : '👁️'}
    </button>
  </div>
</div>
              </div>

              {error && <div className="error-text">{error}</div>}

              <div className="signup-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setStep(1)}>Back</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Creating account…' : 'Create account'}
                </button>
              </div>
            </>
          )}
        </form>

        <p className="auth-footer muted">
          Already have an account? <Link to="/login" className="auth-link">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
