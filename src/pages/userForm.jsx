import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppLayout from '../components/AppLayout.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase, supabaseAdminAction } from '../lib/supabaseClient';
import { todayLocal } from '../lib/timezone.js';
import './userForm.css';

const MODULES = [
  'purchases',
  'sales',
  'products',
  'contacts',
  'expenses',
  'stock',
  'reports',
  'settings',
  'user_management',
  'pos',
];

const emptyPerms = () =>
  Object.fromEntries(
    MODULES.map((m) => [
      m,
      {
        can_view: false,
        can_create: false,
        can_edit: false,
        can_delete: false,
      },
    ])
  );

const emptyForm = (business) => ({
  first_name: '',
  last_name: '',
  username: '',
  is_active: true,

  gender: '',
  date_of_birth: '',

  mobile_number: '',
  id_proof_number: '',
  guardian_name: '',
  guardian_relation: '',

  current_address: '',
  permanent_address: '',

  employment_status: 'active',
  joining_date: todayLocal(business?.time_zone),

  is_sales_agent: false,
  commission_period: 'daily',

  email: '',
  password: '',
});

const emptyBankDetails = {
  account_holder_name: '',
  account_number: '',
  bank_name: '',
  branch: '',
};

export default function UserForm() {
  const { id } = useParams();
  const isEdit = !!id;

  const navigate = useNavigate();
  const { business } = useAuth();

  const [form, setForm] = useState(emptyForm(business));
  const [bankDetails, setBankDetails] = useState(emptyBankDetails);

  const [perms, setPerms] = useState(emptyPerms());

  const [showPassword, setShowPassword] = useState(false);

  const [locations, setLocations] = useState([]);
  const [selectedLocations, setSelectedLocations] = useState([]);

  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!business?.id) return;

    supabase
      .from('locations')
      .select('id, name')
      .eq('business_id', business.id)
      .eq('is_active', true)
      .then(({ data }) => {
        setLocations(data || []);
      });
  }, [business?.id]);

  useEffect(() => {
    if (!isEdit || !business?.id) return;

    let cancelled = false;

    async function load() {
      const [
        { data: userRow, error: userError },
        { data: permRows, error: permError },
        { data: locRows, error: locError },
        { data: bankRow, error: bankError },
      ] = await Promise.all([
        supabase
          .from('users')
          .select('*')
          .eq('id', id)
          .eq('business_id', business.id)
          .single(),

        supabase
          .from('role_permissions')
          .select('*')
          .eq('user_id', id),

        supabase
          .from('user_locations')
          .select('location_id')
          .eq('user_id', id),

        supabase
          .from('user_bank_details')
          .select(
            'id, account_holder_name, account_number, bank_name, branch'
          )
          .eq('user_id', id)
          .maybeSingle(),
      ]);

      if (cancelled) return;

      if (userError) {
        setError(userError.message);
        setLoading(false);
        return;
      }

      if (permError) {
        setError(permError.message);
        setLoading(false);
        return;
      }

      if (locError) {
        setError(locError.message);
        setLoading(false);
        return;
      }

      if (bankError) {
        setError(bankError.message);
        setLoading(false);
        return;
      }

      if (userRow) {
        setForm((f) => ({
          ...f,
          ...userRow,

          date_of_birth: userRow.date_of_birth || '',
          joining_date: userRow.joining_date || '',

          email: '',
          password: '',
        }));
      }

      if (bankRow) {
        setBankDetails({
          account_holder_name:
            bankRow.account_holder_name || '',

          account_number:
            bankRow.account_number || '',

          bank_name:
            bankRow.bank_name || '',

          branch:
            bankRow.branch || '',
        });
      }

      const p = emptyPerms();

      (permRows || []).forEach((row) => {
        if (p[row.module]) {
          p[row.module] = {
            can_view: row.can_view,
            can_create: row.can_create,
            can_edit: row.can_edit,
            can_delete: row.can_delete,
          };
        }
      });

      setPerms(p);

      setSelectedLocations(
        (locRows || []).map(
          (location) => location.location_id
        )
      );

      setLoading(false);
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [isEdit, id, business?.id]);

  const update = (key) => (e) => {
    const val =
      e.target.type === 'checkbox'
        ? e.target.checked
        : e.target.value;

    setForm((f) => ({
      ...f,
      [key]: val,
    }));
  };

  const updateBankDetails = (key) => (e) => {
    setBankDetails((details) => ({
      ...details,
      [key]: e.target.value,
    }));
  };

  const togglePerm = (module, key) => {
    setPerms((p) => {
      const current = p[module];
      const newValue = !current[key];

      // View is the base permission.
      // Any action permission requires View.
      if (key !== 'can_view' && newValue) {
        return {
          ...p,
          [module]: {
            ...current,
            [key]: true,
            can_view: true,
          },
        };
      }

      // If View is disabled, disable all action permissions too.
      if (key === 'can_view' && !newValue) {
        return {
          ...p,
          [module]: {
            can_view: false,
            can_create: false,
            can_edit: false,
            can_delete: false,
          },
        };
      }

      // If an action permission is being turned off,
      // keep View enabled if any other action still exists.
      if (key !== 'can_view' && !newValue) {
        const updated = {
          ...current,
          [key]: false,
        };

        const hasAnyAction =
          updated.can_create ||
          updated.can_edit ||
          updated.can_delete;

        return {
          ...p,
          [module]: {
            ...updated,
            can_view: hasAnyAction,
          },
        };
      }

      return {
        ...p,
        [module]: {
          ...current,
          [key]: newValue,
        },
      };
    });
  };

  const toggleLocation = (locId) => {
    setSelectedLocations((sel) =>
      sel.includes(locId)
        ? sel.filter((l) => l !== locId)
        : [...sel, locId]
    );
  };

  const savePermissionsAndLocations = async (userId) => {
    const permRows = MODULES.map((m) => ({
      user_id: userId,
      module: m,
      ...perms[m],
    }));

    const {
      error: permissionsError,
    } = await supabase
      .from('role_permissions')
      .upsert(permRows, {
        onConflict: 'user_id,module',
      });

    if (permissionsError) {
      throw permissionsError;
    }

    const {
      error: deleteLocationsError,
    } = await supabase
      .from('user_locations')
      .delete()
      .eq('user_id', userId);

    if (deleteLocationsError) {
      throw deleteLocationsError;
    }

    if (selectedLocations.length > 0) {
      const {
        error: insertLocationsError,
      } = await supabase
        .from('user_locations')
        .insert(
          selectedLocations.map((loc_id) => ({
            user_id: userId,
            location_id: loc_id,
          }))
        );

      if (insertLocationsError) {
        throw insertLocationsError;
      }
    }
  };

  const saveBankDetails = async (userId) => {
    const hasBankDetails =
      bankDetails.account_holder_name?.trim() ||
      bankDetails.account_number?.trim() ||
      bankDetails.bank_name?.trim() ||
      bankDetails.branch?.trim();

    if (!hasBankDetails) {
      await supabase
        .from('user_bank_details')
        .delete()
        .eq('user_id', userId);

      return;
    }

    const {
      error: bankError,
    } = await supabase
      .from('user_bank_details')
      .upsert(
        {
          user_id: userId,
          account_holder_name:
            bankDetails.account_holder_name || null,
          account_number:
            bankDetails.account_number || null,
          bank_name:
            bankDetails.bank_name || null,
          branch:
            bankDetails.branch || null,
        },
        {
          onConflict: 'user_id',
        }
      );

    if (bankError) {
      throw bankError;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError('');

    if (
      !form.first_name ||
      !form.username ||
      !form.mobile_number ||
      !form.current_address
    ) {
      setError(
        'Please fill in all required fields.'
      );

      return;
    }

    if (!isEdit && (!form.email || !form.password)) {
      setError(
        "Email and password are required to create the new employee's login."
      );

      return;
    }

    setSubmitting(true);

    try {
      if (isEdit) {
        const {
          id: _id,
          business_id,
          created_at,
          is_owner,
          email,
          password,
          ...updatable
        } = form;

        const {
          error: err,
        } = await supabase
          .from('users')
          .update({
            ...updatable,
            date_of_birth:
              updatable.date_of_birth || null,
          })
          .eq('id', id)
          .eq('business_id', business.id);

        if (err) {
          throw err;
        }

        await saveBankDetails(id);

        await savePermissionsAndLocations(id);
      } else {
        // Isolated client so this signUp call doesn't replace the owner's session.
        const {
          data: authData,
          error: authError,
        } = await supabaseAdminAction.auth.signUp({
          email: form.email,
          password: form.password,
        });

        if (authError) {
          throw authError;
        }

        const newUserId = authData.user?.id;

        if (!newUserId) {
          throw new Error(
            'Could not create the login for this employee.'
          );
        }

        const {
          email,
          password,
          ...profileFields
        } = form;

        const {
          error: insertErr,
        } = await supabase
          .from('users')
          .insert({
            id: newUserId,
            business_id: business.id,
            is_owner: false,

            ...profileFields,

            date_of_birth:
              profileFields.date_of_birth || null,
          });

        if (insertErr) {
          throw insertErr;
        }

        await saveBankDetails(newUserId);

        await savePermissionsAndLocations(newUserId);

        await supabaseAdminAction.auth.signOut();
      }

      navigate('/users');
    } catch (err) {
      setError(
        err.message ||
          'Could not save this user.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="muted">
          Loading…
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="page-header">
        <div>
          <h1>
            {isEdit
              ? 'Edit employee'
              : 'Add employee'}
          </h1>

          <p className="muted">
            Profile details, employment information,
            bank details, module permissions, and
            assigned locations.
          </p>
        </div>

        <button
          className="btn btn-secondary"
          onClick={() =>
            navigate('/users')
          }
        >
          Cancel
        </button>
      </div>

      <form
        onSubmit={handleSubmit}
        className="user-form"
      >
        {/* PROFILE */}

        <section className="card form-section">
          <h2>
            Profile
          </h2>

          <div className="form-grid">
            <div className="field">
              <label>
                First name *
              </label>

              <input
                value={form.first_name}
                onChange={update('first_name')}
                required
              />
            </div>

            <div className="field">
              <label>
                Last name
              </label>

              <input
                value={form.last_name || ''}
                onChange={update('last_name')}
              />
            </div>

            <div className="field">
              <label>
                Username *
              </label>

              <input
                value={form.username}
                onChange={update('username')}
                required
              />
            </div>

            <div className="field">
              <label>
                Mobile number *
              </label>

              <input
                value={form.mobile_number}
                onChange={update('mobile_number')}
                required
              />
            </div>

            <div className="field">
              <label>
                Gender
              </label>

              <select
                value={form.gender || ''}
                onChange={update('gender')}
              >
                <option value="">
                  —
                </option>

                <option value="male">
                  Male
                </option>

                <option value="female">
                  Female
                </option>

                <option value="other">
                  Other
                </option>
              </select>
            </div>

            <div className="field">
              <label>
                Date of birth
              </label>

              <input
                type="date"
                value={
                  form.date_of_birth || ''
                }
                onChange={update('date_of_birth')}
              />
            </div>

            <div
              className="field"
              style={{
                gridColumn: '1 / -1',
              }}
            >
              <label>
                Current address *
              </label>

              <input
                value={form.current_address}
                onChange={update('current_address')}
                required
              />
            </div>

            <div
              className="field"
              style={{
                gridColumn: '1 / -1',
              }}
            >
              <label>
                Permanent address
              </label>

              <input
                value={
                  form.permanent_address || ''
                }
                onChange={update('permanent_address')}
              />
            </div>

            <div className="field">
              <label>
                ID proof number
              </label>

              <input
                value={
                  form.id_proof_number || ''
                }
                onChange={update('id_proof_number')}
              />
            </div>

            <div className="field" />

            <div className="field">
              <label>
                Guardian name
              </label>

              <input
                value={
                  form.guardian_name || ''
                }
                onChange={update('guardian_name')}
              />
            </div>

            <div className="field">
              <label>
                Guardian relation
              </label>

              <input
                value={
                  form.guardian_relation || ''
                }
                onChange={update('guardian_relation')}
              />
            </div>
          </div>
        </section>

        {/* EMPLOYMENT */}

        <section className="card form-section">
          <h2>
            Employment
          </h2>

          <div className="form-grid">
            <div className="field">
              <label>
                Employment status
              </label>

              <select
                value={
                  form.employment_status
                }
                onChange={update(
                  'employment_status'
                )}
              >
                <option value="active">
                  Active
                </option>

                <option value="left">
                  Left
                </option>
              </select>
            </div>

            <div className="field">
              <label>
                Joining date
              </label>

              <input
                type="date"
                value={
                  form.joining_date || ''
                }
                onChange={update(
                  'joining_date'
                )}
              />
            </div>

            <div className="field checkbox-field">
              <label>
                <input
                  type="checkbox"
                  checked={
                    form.is_active
                  }
                  onChange={update(
                    'is_active'
                  )}
                />

                Login active
              </label>
            </div>

            <div className="field checkbox-field">
              <label>
                <input
                  type="checkbox"
                  checked={
                    form.is_sales_agent
                  }
                  onChange={update(
                    'is_sales_agent'
                  )}
                />

                Is a sales agent
              </label>
            </div>

            {form.is_sales_agent && (
              <div className="field">
                <label>
                  Commission period
                </label>

                <select
                  value={
                    form.commission_period
                  }
                  onChange={update(
                    'commission_period'
                  )}
                >
                  <option value="daily">
                    Daily
                  </option>

                  <option value="monthly">
                    Monthly
                  </option>
                </select>
              </div>
            )}
          </div>
        </section>

        {/* BANK DETAILS */}

        <section className="card form-section">
          <h2>
            Bank details
          </h2>

          <div className="form-grid">
            <div className="field">
              <label>
                Account holder name
              </label>

              <input
                value={
                  bankDetails.account_holder_name
                }
                onChange={updateBankDetails(
                  'account_holder_name'
                )}
              />
            </div>

            <div className="field">
              <label>
                Account number
              </label>

              <input
                value={
                  bankDetails.account_number
                }
                onChange={updateBankDetails(
                  'account_number'
                )}
              />
            </div>

            <div className="field">
              <label>
                Bank name
              </label>

              <input
                value={
                  bankDetails.bank_name
                }
                onChange={updateBankDetails(
                  'bank_name'
                )}
              />
            </div>

            <div className="field">
              <label>
                Branch
              </label>

              <input
                value={
                  bankDetails.branch
                }
                onChange={updateBankDetails(
                  'branch'
                )}
              />
            </div>
          </div>
        </section>

        {/* LOGIN CREDENTIALS */}

        {!isEdit && (
          <section className="card form-section">
            <h2>
              Login credentials
            </h2>

            <div className="form-grid">
              <div className="field">
                <label>
                  Email *
                </label>

                <input
                  type="email"
                  value={form.email}
                  onChange={update('email')}
                  required
                />
              </div>

              <div className="field">
                <label>
                  Temporary password *
                </label>

                <div className="password-input-wrapper">
                  <input
                    type={
                      showPassword
                        ? 'text'
                        : 'password'
                    }
                    value={form.password}
                    onChange={update(
                      'password'
                    )}
                    required
                  />

                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() =>
                      setShowPassword(
                        (prev) => !prev
                      )
                    }
                    aria-label={
                      showPassword
                        ? 'Hide password'
                        : 'Show password'
                    }
                  >
                    {showPassword
                      ? '🙈'
                      : '👁️'}
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ASSIGNED LOCATIONS */}

        <section className="card form-section">
          <h2>
            Assigned locations
          </h2>

          <div className="chip-row">
            {locations.map((loc) => (
              <button
                type="button"
                key={loc.id}
                className={`chip ${
                  selectedLocations.includes(
                    loc.id
                  )
                    ? 'chip-selected'
                    : ''
                }`}
                onClick={() =>
                  toggleLocation(loc.id)
                }
              >
                {loc.name}
              </button>
            ))}

            {locations.length === 0 && (
              <span className="muted">
                No locations yet — add one
                in Settings.
              </span>
            )}
          </div>
        </section>

        {/* MODULE PERMISSIONS */}

        <section className="card form-section">
          <h2>
            Module permissions
          </h2>

          <table className="perm-table">
            <thead>
              <tr>
                <th>
                  Module
                </th>

                <th>
                  View
                </th>

                <th>
                  Create
                </th>

                <th>
                  Edit
                </th>

                <th>
                  Delete
                </th>
              </tr>
            </thead>

            <tbody>
              {MODULES.map((m) => (
                <tr key={m}>
                  <td className="perm-module">
                    {m.replace('_', ' ')}
                  </td>

                  {[
                    'can_view',
                    'can_create',
                    'can_edit',
                    'can_delete',
                  ].map((k) => (
                    <td key={k}>
                      <input
                        type="checkbox"
                        checked={
                          perms[m][k]
                        }
                        onChange={() =>
                          togglePerm(m, k)
                        }
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
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
            onClick={() =>
              navigate('/users')
            }
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
                : 'Create employee'}
          </button>
        </div>
      </form>
    </AppLayout>
  );
}