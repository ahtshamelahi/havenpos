// import { useEffect, useState } from 'react';
// import { useNavigate } from 'react-router-dom';
// import AppLayout from '../components/AppLayout.jsx';
// import { useAuth } from '../context/AuthContext.jsx';
// import { supabase } from '../lib/supabaseClient';
// import { fetchAllBatched } from '../lib/fetchUtils.js';
// import usePagination from '../hooks/usePagination.js';
// import Pagination from '../components/Pagination.jsx';
// import useDataSearch from '../hooks/useDataSearch.js';
// import useDataSort from '../hooks/useDataSort.js';
// import DataSearchBar from '../components/DataSearchBar.jsx';
// import SortableHeader from '../components/SortableHeader.jsx';
// import useLocationScope from '../hooks/useLocationScope.js';

// export default function Contacts() {
//   const { business, can, profile } = useAuth();
//   const { isOwner, isScopedToLocation, scopedLocationIds } = useLocationScope();
//   const navigate = useNavigate();

//   const [tab, setTab] = useState('customer');
//   const [rows, setRows] = useState([]);
//   const [locations, setLocations] = useState([]);
//   const [locationFilter, setLocationFilter] = useState('');
//   const [usersMap, setUsersMap] = useState({});
//   const [usersList, setUsersList] = useState([]);
//   const [userFilter, setUserFilter] = useState('');
//   const [balances, setBalances] = useState({});
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState('');
//   const [selectedAddress, setSelectedAddress] = useState(null);
//   const [deletingId, setDeletingId] = useState(null);

//   const canCreate =
//     profile?.is_owner || can('contacts', 'create');

//   const canEdit =
//     profile?.is_owner || can('contacts', 'edit');

//   const load = async () => {
//     if (!business?.id) return;

//     setLoading(true);
//     setError('');

//     const [
//       { data, error: err },
//       { data: locRows },
//       { data: userRows }
//     ] = await Promise.all([
//       fetchAllBatched(() => {
//         let q = supabase
//           .from('contacts')
//           .select('*')
//           .eq('business_id', business.id)
//           .eq('contact_type', tab)
//           .eq('is_active', true)
//           .order('name');

//         // Scope by user: non-owners only see their own contacts
//         if (!isOwner && profile?.id) {
//           q = q.eq('created_by', profile.id);
//         } else if (isOwner && userFilter) {
//           q = q.eq('created_by', userFilter);
//         }

//         if (isScopedToLocation && scopedLocationIds.length > 0) {
//           q = q.or(`location_id.in.(${scopedLocationIds.join(',')}),location_id.is.null`);
//         } else if (!isScopedToLocation && locationFilter) {
//           q = q.eq('location_id', Number(locationFilter));
//         }
//         return q;
//       }),
//       supabase
//         .from('locations')
//         .select('id, name')
//         .eq('business_id', business.id)
//         .eq('is_active', true),
//       supabase
//         .from('users')
//         .select('id, first_name, last_name, username')
//         .eq('business_id', business.id),
//     ]);

//     setLocations(locRows || []);

//     const uMap = {};
//     const uList = userRows || [];
//     uList.forEach((u) => {
//       const displayName = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username || 'Staff';
//       uMap[u.id] = displayName;
//     });
//     setUsersMap(uMap);
//     setUsersList(uList);

//     if (err) {
//       setError(err.message);
//       setRows([]);
//       setBalances({});
//       setLoading(false);
//       return;
//     }

//     setRows(data || []);

//     if (data && data.length > 0) {
//       const contactIds = data.map(
//         (contact) => contact.id
//       );

//       const {
//         data: ledgerRows,
//         error: ledgerError,
//       } = await fetchAllBatched(() =>
//         supabase
//           .from('contact_ledger')
//           .select('contact_id, amount, reference_type')
//           .eq('business_id', business.id)
//           .in('contact_id', contactIds)
//       );

//       if (ledgerError) {
//         setError(ledgerError.message);
//       }

//       const totals = {};

//       /*
//        * Current balance:
//        *
//        * contacts.opening_balance
//        * + all non-opening-balance ledger entries
//        *
//        * Opening balance ledger entries are excluded
//        * to prevent double counting.
//        */

//       (ledgerRows || []).forEach((ledgerEntry) => {
//         if (
//           ledgerEntry.reference_type ===
//           'opening_balance'
//         ) {
//           return;
//         }

//         totals[ledgerEntry.contact_id] =
//           (totals[ledgerEntry.contact_id] || 0) +
//           Number(ledgerEntry.amount || 0);
//       });

//       data.forEach((contact) => {
//         totals[contact.id] =
//           (totals[contact.id] || 0) +
//           Number(contact.opening_balance || 0);
//       });

//       setBalances(totals);
//     } else {
//       setBalances({});
//     }

//     setLoading(false);
//   };

//   useEffect(() => {
//     load();

//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [business?.id, tab, locationFilter, userFilter]);

//   const handleSoftDelete = async (contact) => {
//     const confirmed = window.confirm(
//       `Are you sure you want to delete "${contact.name}"?`
//     );

//     if (!confirmed) return;

//     setDeletingId(contact.id);
//     setError('');

//     const { error: deleteError } = await supabase
//       .from('contacts')
//       .update({
//         is_active: false,
//       })
//       .eq('id', contact.id)
//       .eq('business_id', business.id);

//     if (deleteError) {
//       setError(deleteError.message);
//     } else {
//       setRows((currentRows) =>
//         currentRows.filter(
//           (row) => row.id !== contact.id
//         )
//       );
//     }

//     setDeletingId(null);
//   };

//   /*
//    * SEARCH
//    * Only:
//    * - Name
//    * - Contact number
//    * - Business name
//    */
//   const search = useDataSearch(rows, [
//     'name',
//     'contact_number',
//     'business_name',
//   ]);

//   /*
//    * SORTING
//    * Every visible data field is sortable.
//    * Actions column is intentionally not sortable.
//    */
//   const sortFields = [
//     {
//       key: 'id',
//       label: 'ID',
//       type: 'number',
//     },

//     {
//       key: 'name',
//       label: 'Name',
//       type: 'text',
//     },

//     {
//       key: 'balance',
//       label: 'Balance',
//       type: 'number',
//       getValue: (contact) =>
//         balances[contact.id] || 0,
//     },

//     {
//       key: 'contact_number',
//       label: 'Contact',
//       type: 'text',
//     },

//     {
//       key: 'address',
//       label: 'Address',
//       type: 'text',
//     },

//     {
//       key: 'created_by',
//       label: 'Created by',
//       type: 'text',
//       getValue: (c) => usersMap[c.created_by] || '—',
//     },

//     {
//       key: 'created_at',
//       label: 'Added on',
//       type: 'date',
//     },

//     {
//       key: 'email',
//       label: 'Email',
//       type: 'text',
//     },

//     ...(tab === 'supplier'
//       ? [
//         {
//           key: 'tax_ntn_number',
//           label: 'NTN',
//           type: 'text',
//         },
//         {
//           key: 'business_name',
//           label: 'Business',
//           type: 'text',
//         },
//       ]
//       : []),
//   ];

//   const sort = useDataSort(
//     search.filteredData,
//     sortFields
//   );

//   const {
//     currentPage,
//     totalPages,
//     totalItems,
//     paginatedItems,
//     firstItemIndex,
//     lastItemIndex,
//     goToPage,
//     nextPage,
//     previousPage,
//     hasNextPage,
//     hasPreviousPage,
//   } = usePagination(sort.sortedData, 20);

//   const currentPageBalanceTotal =
//     paginatedItems.reduce(
//       (total, contact) =>
//         total +
//         Number(balances[contact.id] || 0),
//       0
//     );

//   const formatDate = (date) => {
//     if (!date) return '—';

//     return new Date(date).toLocaleDateString(
//       'en-US',
//       {
//         year: 'numeric',
//         month: 'short',
//         day: 'numeric',
//       }
//     );
//   };

//   // columns: ID | Actions | Name | Balance | Contact | Address | CreatedBy | AddedOn | Email [| NTN | Business]
//   const tableColumnCount =
//     tab === 'supplier' ? 11 : 9;

//   return (
//     <AppLayout>
//       <div className="page-header">
//         <div>
//           <h1>Contacts | Customers and suppliers for |{' '}
//             {business?.business_name} |</h1>
//         </div>

//         <div style={{ display: 'flex', gap: '8px' }}>
//           <button
//             className="btn btn-secondary"
//             onClick={() =>
//               navigate(`/reports/${tab}s`)
//             }
//           >
//             {tab === 'customer' ? 'Customers Report' : 'Suppliers Report'}
//           </button>
//           {canCreate && (
//             <button
//               className="btn btn-primary"
//               onClick={() =>
//                 navigate(
//                   `/contacts/new?type=${tab}`
//                 )
//               }
//             >
//               + Add {tab}
//             </button>
//           )}
//         </div>
//       </div>

//       <div className="card list-panel">
//         <div className="list-toolbar">
//           <div className="list-tabs">
//             <button
//               className={`list-tab ${tab === 'customer'
//                 ? 'list-tab-active'
//                 : ''
//                 }`}
//               onClick={() =>
//                 setTab('customer')
//               }
//             >
//               Customers
//             </button>

//             <button
//               className={`list-tab ${tab === 'supplier'
//                 ? 'list-tab-active'
//                 : ''
//                 }`}
//               onClick={() =>
//                 setTab('supplier')
//               }
//             >
//               Suppliers
//             </button>
//           </div>

//           {isOwner && locations.length > 0 && (
//             <select
//               value={locationFilter}
//               onChange={(e) => setLocationFilter(e.target.value)}
//               style={{
//                 padding: '8px 12px',
//                 borderRadius: 6,
//                 border: '1px solid var(--navy-border)',
//               }}
//             >
//               <option value="">All locations</option>
//               {locations.map((l) => (
//                 <option key={l.id} value={l.id}>
//                   {l.name}
//                 </option>
//               ))}
//             </select>
//           )}

//           {isOwner && usersList.length > 0 && (
//             <select
//               value={userFilter}
//               onChange={(e) => setUserFilter(e.target.value)}
//               style={{
//                 padding: '8px 12px',
//                 borderRadius: 6,
//                 border: '1px solid var(--navy-border)',
//               }}
//             >
//               <option value="">All users</option>
//               {usersList.map((u) => {
//                 const name = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username || 'Staff';
//                 return (
//                   <option key={u.id} value={u.id}>
//                     {name}
//                   </option>
//                 );
//               })}
//             </select>
//           )}

//           <DataSearchBar
//             query={search.query}
//             setQuery={search.setQuery}
//             clearSearch={search.clearSearch}
//             placeholder={`Search ${tab}s by name, number, or business…`}
//           />
//         </div>

//         {error && (
//           <div
//             className="error-text"
//             style={{
//               padding: '0 16px 10px',
//             }}
//           >
//             {error}
//           </div>
//         )}

//         <div className="table-scroll">
//           <table className="data-table" style={{ fontSize: '13px', tableLayout: 'fixed', width: '100%' }}>
//             {/* Fixed-width column definitions for strict alignment */}
//             <colgroup>
//               <col style={{ width: '52px' }} />{/* ID */}
//               <col style={{ width: '80px' }} />{/* Actions */}
//               <col style={{ width: '160px' }} />{/* Name */}
//               <col style={{ width: '110px' }} />{/* Balance */}
//               <col style={{ width: '130px' }} />{/* Contact */}
//               <col style={{ width: '70px' }} />{/* Address */}
//               <col style={{ width: '110px' }} />{/* Created by */}
//               <col style={{ width: '100px' }} />{/* Added on */}
//               <col />{/* Email — takes remaining space */}
//               {tab === 'supplier' && <col style={{ width: '110px' }} />}{/* NTN */}
//               {tab === 'supplier' && <col style={{ width: '130px' }} />}{/* Business */}
//             </colgroup>
//             <thead>
//               <tr>
//                 <SortableHeader
//                   label="ID"
//                   sortKey="id"
//                   currentSortKey={sort.sortKey}
//                   sortDirection={sort.sortDirection}
//                   toggleSortKey={sort.toggleSortKey}
//                 />

//                 {/* Fixed actions header — empty, no sort */}
//                 <th style={{ padding: '8px 12px' }}></th>

//                 <SortableHeader
//                   label="Name"
//                   sortKey="name"
//                   currentSortKey={sort.sortKey}
//                   sortDirection={sort.sortDirection}
//                   toggleSortKey={sort.toggleSortKey}
//                 />

//                 <SortableHeader
//                   label="Balance"
//                   sortKey="balance"
//                   currentSortKey={sort.sortKey}
//                   sortDirection={sort.sortDirection}
//                   toggleSortKey={sort.toggleSortKey}
//                 />

//                 <SortableHeader
//                   label="Contact"
//                   sortKey="contact_number"
//                   currentSortKey={sort.sortKey}
//                   sortDirection={sort.sortDirection}
//                   toggleSortKey={sort.toggleSortKey}
//                 />

//                 <SortableHeader
//                   label="Addr"
//                   sortKey="address"
//                   currentSortKey={sort.sortKey}
//                   sortDirection={sort.sortDirection}
//                   toggleSortKey={sort.toggleSortKey}
//                 />

//                 <SortableHeader
//                   label="Created by"
//                   sortKey="created_by"
//                   currentSortKey={sort.sortKey}
//                   sortDirection={sort.sortDirection}
//                   toggleSortKey={sort.toggleSortKey}
//                 />

//                 <SortableHeader
//                   label="Added on"
//                   sortKey="created_at"
//                   currentSortKey={sort.sortKey}
//                   sortDirection={sort.sortDirection}
//                   toggleSortKey={sort.toggleSortKey}
//                 />

//                 <SortableHeader
//                   label="Email"
//                   sortKey="email"
//                   currentSortKey={sort.sortKey}
//                   sortDirection={sort.sortDirection}
//                   toggleSortKey={sort.toggleSortKey}
//                 />

//                 {tab === 'supplier' && (
//                   <>
//                     <SortableHeader
//                       label="NTN"
//                       sortKey="tax_ntn_number"
//                       currentSortKey={sort.sortKey}
//                       sortDirection={sort.sortDirection}
//                       toggleSortKey={sort.toggleSortKey}
//                     />
//                     <SortableHeader
//                       label="Business"
//                       sortKey="business_name"
//                       currentSortKey={sort.sortKey}
//                       sortDirection={sort.sortDirection}
//                       toggleSortKey={sort.toggleSortKey}
//                     />
//                   </>
//                 )}
//               </tr>
//             </thead>

//             <tbody>
//               {loading && (
//                 <tr>
//                   <td
//                     colSpan={tableColumnCount}
//                     className="muted table-empty"
//                   >
//                     Loading…
//                   </td>
//                 </tr>
//               )}

//               {!loading &&
//                 paginatedItems.length === 0 && (
//                   <tr>
//                     <td
//                       colSpan={tableColumnCount}
//                       className="muted table-empty"
//                     >
//                       No {tab}s yet.
//                     </td>
//                   </tr>
//                 )}

//               {!loading &&
//                 paginatedItems.map((contact) => (
//                   <tr key={contact.id} style={{ verticalAlign: 'middle' }}>

//                     {/* ID — fixed narrow column */}
//                     <td style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
//                       <span style={{ fontWeight: 600, color: 'var(--navy-muted)', fontSize: '12px' }}>
//                         #{contact.id}
//                       </span>
//                     </td>

//                     {/* Actions — fixed column, always same width */}
//                     <td style={{ whiteSpace: 'nowrap', overflow: 'hidden' }}>
//                       {canEdit ? (
//                         <span style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
//                           <button
//                             className="contact-link-btn"
//                             onClick={() => navigate(`/contacts/${contact.id}`)}
//                             title="Edit"
//                           >
//                             Edit
//                           </button>
//                           <span style={{ color: 'var(--navy-border)', fontSize: '11px', userSelect: 'none' }}>·</span>
//                           <button
//                             className="contact-link-btn contact-link-btn--danger"
//                             onClick={() => handleSoftDelete(contact)}
//                             disabled={deletingId === contact.id}
//                             title="Delete"
//                           >
//                             {deletingId === contact.id ? '…' : 'Del'}
//                           </button>
//                         </span>
//                       ) : null}
//                     </td>

//                     {/* Name */}
//                     <td>
//                       <span style={{ fontWeight: 500 }}>{contact.name}</span>
//                     </td>

//                     {/* Balance */}
//                     <td style={{ whiteSpace: 'nowrap', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
//                       <span style={{
//                         fontWeight: 600,
//                         color: (balances[contact.id] || 0) < 0
//                           ? 'var(--error-color, #e05252)'
//                           : (balances[contact.id] || 0) > 0
//                             ? 'var(--success-color, #36b37e)'
//                             : 'inherit'
//                       }}>
//                         {business?.currency} {(balances[contact.id] || 0).toFixed(2)}
//                       </span>
//                     </td>

//                     {/* Contact number */}
//                     <td style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
//                       {contact.contact_number || '—'}
//                     </td>

//                     {/* Address */}
//                     <td>
//                       {contact.address ? (
//                         <button
//                           type="button"
//                           className="contact-link-btn"
//                           onClick={() => setSelectedAddress(contact)}
//                         >
//                           View
//                         </button>
//                       ) : (
//                         <span style={{ color: 'var(--navy-muted)' }}>—</span>
//                       )}
//                     </td>

//                     {/* Created by */}
//                     <td style={{ color: 'var(--navy-muted)', fontSize: '12px' }}>
//                       {usersMap[contact.created_by] || '—'}
//                     </td>

//                     {/* Added on */}
//                     <td style={{ whiteSpace: 'nowrap', color: 'var(--navy-muted)', fontSize: '12px' }}>
//                       {formatDate(contact.created_at)}
//                     </td>

//                     {/* Email */}
//                     <td style={{ fontSize: '12px', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
//                       {contact.email ? (
//                         <a href={`mailto:${contact.email}`} style={{ color: 'inherit', textDecoration: 'underline', textDecorationStyle: 'dotted' }}>
//                           {contact.email}
//                         </a>
//                       ) : (
//                         <span style={{ color: 'var(--navy-muted)' }}>—</span>
//                       )}
//                     </td>

//                     {/* Supplier-only columns */}
//                     {tab === 'supplier' && (
//                       <>
//                         <td style={{ fontSize: '12px' }}>
//                           {contact.tax_ntn_number || <span style={{ color: 'var(--navy-muted)' }}>—</span>}
//                         </td>
//                         <td style={{ fontSize: '12px', color: 'var(--navy-muted)' }}>
//                           {contact.business_name || '—'}
//                         </td>
//                       </>
//                     )}
//                   </tr>
//                 ))}

//               {!loading && paginatedItems.length > 0 && (
//                 <tr className="table-total-row">
//                   {/* span: ID + Actions + Name cols = 3, then Balance at col 4 */}
//                   <td colSpan={3}>
//                     <strong>Total for current page</strong>
//                   </td>
//                   <td style={{ textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
//                     <strong>
//                       {business?.currency} {currentPageBalanceTotal.toFixed(2)}
//                     </strong>
//                   </td>
//                   <td colSpan={tab === 'supplier' ? 7 : 5}></td>
//                 </tr>
//               )}
//             </tbody>
//           </table>

//           <style>{`
//             .contact-link-btn {
//               background: none;
//               border: none;
//               cursor: pointer;
//               font-size: 11.5px;
//               font-weight: 500;
//               padding: 1px 3px;
//               border-radius: 3px;
//               color: var(--primary-color, #4f6ef7);
//               transition: background 0.15s, color 0.15s;
//               line-height: 1.5;
//             }
//             .contact-link-btn:hover {
//               background: rgba(79,110,247,0.1);
//               color: var(--primary-color, #4f6ef7);
//             }
//             .contact-link-btn--danger {
//               color: var(--error-color, #e05252);
//             }
//             .contact-link-btn--danger:hover {
//               background: rgba(224,82,82,0.1);
//               color: var(--error-color, #e05252);
//             }
//             .contact-link-btn:disabled {
//               opacity: 0.45;
//               cursor: not-allowed;
//             }
//             .data-table td, .data-table th {
//               padding: 8px 12px;
//               line-height: 1.4;
//             }
//           `}</style>
//         </div>

//         <Pagination
//           currentPage={currentPage}
//           totalPages={totalPages}
//           totalItems={totalItems}
//           firstItemIndex={firstItemIndex}
//           lastItemIndex={lastItemIndex}
//           goToPage={goToPage}
//           nextPage={nextPage}
//           previousPage={previousPage}
//           hasNextPage={hasNextPage}
//           hasPreviousPage={hasPreviousPage}
//         />
//       </div>

//       {selectedAddress && (
//         <div
//           className="modal-backdrop"
//           onClick={() =>
//             setSelectedAddress(null)
//           }
//           style={{
//             position: 'fixed',
//             inset: 0,
//             background: 'rgba(19, 26, 51, 0.6)',
//             backdropFilter: 'blur(2px)',
//             display: 'flex',
//             alignItems: 'center',
//             justifyContent: 'center',
//             zIndex: 9999,
//             padding: '20px'
//           }}
//         >
//           <div
//             className="card"
//             onClick={(e) =>
//               e.stopPropagation()
//             }
//             style={{
//               width: 'min(560px, 92vw)',
//               padding: '24px',
//             }}
//           >
//             <div
//               style={{
//                 display: 'flex',
//                 justifyContent:
//                   'space-between',
//                 alignItems: 'center',
//                 gap: '16px',
//                 marginBottom: '16px',
//               }}
//             >
//               <div>
//                 <h2
//                   style={{
//                     margin: 0,
//                   }}
//                 >
//                   Address
//                 </h2>

//                 <p
//                   className="muted"
//                   style={{
//                     margin: '4px 0 0',
//                   }}
//                 >
//                   {selectedAddress.name}
//                 </p>
//               </div>

//               <button
//                 type="button"
//                 className="btn btn-secondary"
//                 onClick={() =>
//                   setSelectedAddress(null)
//                 }
//               >
//                 Close
//               </button>
//             </div>

//             <div
//               style={{
//                 whiteSpace: 'pre-wrap',
//                 lineHeight: 1.6,
//                 wordBreak: 'break-word',
//               }}
//             >
//               {selectedAddress.address}
//             </div>
//           </div>
//         </div>
//       )}
//     </AppLayout>
//   );
// }





import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/AppLayout.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabaseClient';
import { fetchAllBatched } from '../lib/fetchUtils.js';
import usePagination from '../hooks/usePagination.js';
import Pagination from '../components/Pagination.jsx';
import useDataSearch from '../hooks/useDataSearch.js';
import useDataSort from '../hooks/useDataSort.js';
import DataSearchBar from '../components/DataSearchBar.jsx';
import SortableHeader from '../components/SortableHeader.jsx';
import useLocationScope from '../hooks/useLocationScope.js';

export default function Contacts() {
  const { business, can, profile } = useAuth();
  const { isOwner, isScopedToLocation, scopedLocationIds } = useLocationScope();
  const navigate = useNavigate();

  const [tab, setTab] = useState('customer');
  const [rows, setRows] = useState([]);
  const [locations, setLocations] = useState([]);
  const [locationFilter, setLocationFilter] = useState('');
  const [usersMap, setUsersMap] = useState({});
  const [usersList, setUsersList] = useState([]);
  const [userFilter, setUserFilter] = useState('');
  const [balances, setBalances] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const canCreate =
    profile?.is_owner || can('contacts', 'create');

  const canEdit =
    profile?.is_owner || can('contacts', 'edit');

  const load = async () => {
    if (!business?.id) return;

    setLoading(true);
    setError('');

    const [
      { data, error: err },
      { data: locRows },
      { data: userRows }
    ] = await Promise.all([
      fetchAllBatched(() => {
        let q = supabase
          .from('contacts')
          .select('*')
          .eq('business_id', business.id)
          .eq('contact_type', tab)
          .eq('is_active', true)
          .order('name');

        /*
         * ADDED-BY FILTER TEMPORARILY DISABLED
         *
         * Previously:
         * - Non-owners could only see contacts created by themselves.
         * - Owners could filter contacts by selected user.
         *
         * This is intentionally disabled for now.
         * All users' contacts are shown regardless of created_by,
         * including contacts where created_by is NULL.
         */

        /*
        // Scope by user: non-owners only see their own contacts
        if (!isOwner && profile?.id) {
          q = q.eq('created_by', profile.id);
        } else if (isOwner && userFilter) {
          q = q.eq('created_by', userFilter);
        }
        */

        /*
         * LOCATION FILTER
         *
         * Scoped users:
         * Show contacts assigned to their allowed locations,
         * plus contacts where location_id is NULL.
         *
         * Owners:
         * If a location is selected, show only that location.
         * If "All locations" is selected, show all locations.
         */

        if (isScopedToLocation && scopedLocationIds.length > 0) {
          q = q.or(
            `location_id.in.(${scopedLocationIds.join(',')}),location_id.is.null`
          );
        } else if (!isScopedToLocation && locationFilter) {
          q = q.eq('location_id', Number(locationFilter));
        }

        return q;
      }),

      supabase
        .from('locations')
        .select('id, name')
        .eq('business_id', business.id)
        .eq('is_active', true),

      supabase
        .from('users')
        .select('id, first_name, last_name, username')
        .eq('business_id', business.id),
    ]);

    setLocations(locRows || []);

    const uMap = {};
    const uList = userRows || [];

    uList.forEach((u) => {
      const displayName =
        [u.first_name, u.last_name]
          .filter(Boolean)
          .join(' ') ||
        u.username ||
        'Staff';

      uMap[u.id] = displayName;
    });

    setUsersMap(uMap);
    setUsersList(uList);

    if (err) {
      setError(err.message);
      setRows([]);
      setBalances({});
      setLoading(false);
      return;
    }

    setRows(data || []);

    if (data && data.length > 0) {
      const contactIds = data.map(
        (contact) => contact.id
      );

      const {
        data: ledgerRows,
        error: ledgerError,
      } = await fetchAllBatched(() =>
        supabase
          .from('contact_ledger')
          .select(
            'contact_id, amount, reference_type'
          )
          .eq('business_id', business.id)
          .in('contact_id', contactIds)
      );

      if (ledgerError) {
        setError(ledgerError.message);
      }

      const totals = {};

      /*
       * Current balance:
       *
       * contacts.opening_balance
       * + all non-opening-balance ledger entries
       *
       * Opening balance ledger entries are excluded
       * to prevent double counting.
       */

      (ledgerRows || []).forEach((ledgerEntry) => {
        if (
          ledgerEntry.reference_type ===
          'opening_balance'
        ) {
          return;
        }

        totals[ledgerEntry.contact_id] =
          (totals[ledgerEntry.contact_id] || 0) +
          Number(ledgerEntry.amount || 0);
      });

      data.forEach((contact) => {
        totals[contact.id] =
          (totals[contact.id] || 0) +
          Number(contact.opening_balance || 0);
      });

      setBalances(totals);
    } else {
      setBalances({});
    }

    setLoading(false);
  };

  useEffect(() => {
    load();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [business?.id, tab, locationFilter]);

  const handleSoftDelete = async (contact) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${contact.name}"?`
    );

    if (!confirmed) return;

    setDeletingId(contact.id);
    setError('');

    const { error: deleteError } = await supabase
      .from('contacts')
      .update({
        is_active: false,
      })
      .eq('id', contact.id)
      .eq('business_id', business.id);

    if (deleteError) {
      setError(deleteError.message);
    } else {
      setRows((currentRows) =>
        currentRows.filter(
          (row) => row.id !== contact.id
        )
      );
    }

    setDeletingId(null);
  };

  /*
   * SEARCH
   * Only:
   * - Name
   * - Contact number
   * - Business name
   */

  const search = useDataSearch(rows, [
    'name',
    'contact_number',
    'business_name',
  ]);

  /*
   * SORTING
   * Every visible data field is sortable.
   * Actions column is intentionally not sortable.
   */

  const sortFields = [
    {
      key: 'id',
      label: 'ID',
      type: 'number',
    },

    {
      key: 'name',
      label: 'Name',
      type: 'text',
    },

    {
      key: 'balance',
      label: 'Balance',
      type: 'number',
      getValue: (contact) =>
        balances[contact.id] || 0,
    },

    {
      key: 'contact_number',
      label: 'Contact',
      type: 'text',
    },

    {
      key: 'address',
      label: 'Address',
      type: 'text',
    },

    {
      key: 'created_by',
      label: 'Created by',
      type: 'text',
      getValue: (c) =>
        usersMap[c.created_by] || '—',
    },

    {
      key: 'created_at',
      label: 'Added on',
      type: 'date',
    },

    {
      key: 'email',
      label: 'Email',
      type: 'text',
    },

    ...(tab === 'supplier'
      ? [
          {
            key: 'tax_ntn_number',
            label: 'NTN',
            type: 'text',
          },
          {
            key: 'business_name',
            label: 'Business',
            type: 'text',
          },
        ]
      : []),
  ];

  const sort = useDataSort(
    search.filteredData,
    sortFields
  );

  const {
    currentPage,
    totalPages,
    totalItems,
    paginatedItems,
    firstItemIndex,
    lastItemIndex,
    goToPage,
    nextPage,
    previousPage,
    hasNextPage,
    hasPreviousPage,
  } = usePagination(sort.sortedData, 20);

  const currentPageBalanceTotal =
    paginatedItems.reduce(
      (total, contact) =>
        total +
        Number(balances[contact.id] || 0),
      0
    );

  const formatDate = (date) => {
    if (!date) return '—';

    return new Date(date).toLocaleDateString(
      'en-US',
      {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }
    );
  };

  // columns:
  // ID | Actions | Name | Balance | Contact | Address |
  // CreatedBy | AddedOn | Email [| NTN | Business]

  const tableColumnCount =
    tab === 'supplier' ? 11 : 9;

  return (
    <AppLayout>
      <div className="page-header">
        <div>
          <h1>
            Contacts | Customers and suppliers for |{' '}
            {business?.business_name} |
          </h1>
        </div>

        <div
          style={{
            display: 'flex',
            gap: '8px',
          }}
        >
          <button
            className="btn btn-secondary"
            onClick={() =>
              navigate(`/reports/${tab}s`)
            }
          >
            {tab === 'customer'
              ? 'Customers Report'
              : 'Suppliers Report'}
          </button>

          {canCreate && (
            <button
              className="btn btn-primary"
              onClick={() =>
                navigate(
                  `/contacts/new?type=${tab}`
                )
              }
            >
              + Add {tab}
            </button>
          )}
        </div>
      </div>

      <div className="card list-panel">
        <div className="list-toolbar">
          <div className="list-tabs">
            <button
              className={`list-tab ${
                tab === 'customer'
                  ? 'list-tab-active'
                  : ''
              }`}
              onClick={() =>
                setTab('customer')
              }
            >
              Customers
            </button>

            <button
              className={`list-tab ${
                tab === 'supplier'
                  ? 'list-tab-active'
                  : ''
              }`}
              onClick={() =>
                setTab('supplier')
              }
            >
              Suppliers
            </button>
          </div>

          {isOwner &&
            locations.length > 0 && (
              <select
                value={locationFilter}
                onChange={(e) =>
                  setLocationFilter(
                    e.target.value
                  )
                }
                style={{
                  padding: '8px 12px',
                  borderRadius: 6,
                  border:
                    '1px solid var(--navy-border)',
                }}
              >
                <option value="">
                  All locations
                </option>

                {locations.map((l) => (
                  <option
                    key={l.id}
                    value={l.id}
                  >
                    {l.name}
                  </option>
                ))}
              </select>
            )}

          {/*
            ADDED-BY FILTER DISABLED

            This filter is intentionally commented out.
            Contacts are no longer filtered by the
            user who created them.

          {isOwner && usersList.length > 0 && (
            <select
              value={userFilter}
              onChange={(e) =>
                setUserFilter(e.target.value)
              }
              style={{
                padding: '8px 12px',
                borderRadius: 6,
                border:
                  '1px solid var(--navy-border)',
              }}
            >
              <option value="">
                All users
              </option>

              {usersList.map((u) => {
                const name =
                  [
                    u.first_name,
                    u.last_name,
                  ]
                    .filter(Boolean)
                    .join(' ') ||
                  u.username ||
                  'Staff';

                return (
                  <option
                    key={u.id}
                    value={u.id}
                  >
                    {name}
                  </option>
                );
              })}
            </select>
          )}
          */}

          <DataSearchBar
            query={search.query}
            setQuery={search.setQuery}
            clearSearch={search.clearSearch}
            placeholder={`Search ${tab}s by name, number, or business…`}
          />
        </div>

        {error && (
          <div
            className="error-text"
            style={{
              padding: '0 16px 10px',
            }}
          >
            {error}
          </div>
        )}

        <div className="table-scroll">
          <table
            className="data-table"
            style={{
              fontSize: '13px',
              tableLayout: 'fixed',
              width: '100%',
            }}
          >
            <colgroup>
              <col
                style={{ width: '52px' }}
              />
              {/* ID */}

              <col
                style={{ width: '80px' }}
              />
              {/* Actions */}

              <col
                style={{ width: '160px' }}
              />
              {/* Name */}

              <col
                style={{ width: '110px' }}
              />
              {/* Balance */}

              <col
                style={{ width: '130px' }}
              />
              {/* Contact */}

              <col
                style={{ width: '70px' }}
              />
              {/* Address */}

              <col
                style={{ width: '110px' }}
              />
              {/* Created by */}

              <col
                style={{ width: '100px' }}
              />
              {/* Added on */}

              <col />
              {/* Email — takes remaining space */}

              {tab === 'supplier' && (
                <col
                  style={{ width: '110px' }}
                />
              )}
              {/* NTN */}

              {tab === 'supplier' && (
                <col
                  style={{ width: '130px' }}
                />
              )}
              {/* Business */}
            </colgroup>

            <thead>
              <tr>
                <SortableHeader
                  label="ID"
                  sortKey="id"
                  currentSortKey={
                    sort.sortKey
                  }
                  sortDirection={
                    sort.sortDirection
                  }
                  toggleSortKey={
                    sort.toggleSortKey
                  }
                />

                {/* Fixed actions header — empty, no sort */}
                <th
                  style={{
                    padding: '8px 12px',
                  }}
                ></th>

                <SortableHeader
                  label="Name"
                  sortKey="name"
                  currentSortKey={
                    sort.sortKey
                  }
                  sortDirection={
                    sort.sortDirection
                  }
                  toggleSortKey={
                    sort.toggleSortKey
                  }
                />

                <SortableHeader
                  label="Balance"
                  sortKey="balance"
                  currentSortKey={
                    sort.sortKey
                  }
                  sortDirection={
                    sort.sortDirection
                  }
                  toggleSortKey={
                    sort.toggleSortKey
                  }
                />

                <SortableHeader
                  label="Contact"
                  sortKey="contact_number"
                  currentSortKey={
                    sort.sortKey
                  }
                  sortDirection={
                    sort.sortDirection
                  }
                  toggleSortKey={
                    sort.toggleSortKey
                  }
                />

                <SortableHeader
                  label="Addr"
                  sortKey="address"
                  currentSortKey={
                    sort.sortKey
                  }
                  sortDirection={
                    sort.sortDirection
                  }
                  toggleSortKey={
                    sort.toggleSortKey
                  }
                />

                <SortableHeader
                  label="Created by"
                  sortKey="created_by"
                  currentSortKey={
                    sort.sortKey
                  }
                  sortDirection={
                    sort.sortDirection
                  }
                  toggleSortKey={
                    sort.toggleSortKey
                  }
                />

                <SortableHeader
                  label="Added on"
                  sortKey="created_at"
                  currentSortKey={
                    sort.sortKey
                  }
                  sortDirection={
                    sort.sortDirection
                  }
                  toggleSortKey={
                    sort.toggleSortKey
                  }
                />

                <SortableHeader
                  label="Email"
                  sortKey="email"
                  currentSortKey={
                    sort.sortKey
                  }
                  sortDirection={
                    sort.sortDirection
                  }
                  toggleSortKey={
                    sort.toggleSortKey
                  }
                />

                {tab === 'supplier' && (
                  <>
                    <SortableHeader
                      label="NTN"
                      sortKey="tax_ntn_number"
                      currentSortKey={
                        sort.sortKey
                      }
                      sortDirection={
                        sort.sortDirection
                      }
                      toggleSortKey={
                        sort.toggleSortKey
                      }
                    />

                    <SortableHeader
                      label="Business"
                      sortKey="business_name"
                      currentSortKey={
                        sort.sortKey
                      }
                      sortDirection={
                        sort.sortDirection
                      }
                      toggleSortKey={
                        sort.toggleSortKey
                      }
                    />
                  </>
                )}
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr>
                  <td
                    colSpan={
                      tableColumnCount
                    }
                    className="muted table-empty"
                  >
                    Loading…
                  </td>
                </tr>
              )}

              {!loading &&
                paginatedItems.length ===
                  0 && (
                  <tr>
                    <td
                      colSpan={
                        tableColumnCount
                      }
                      className="muted table-empty"
                    >
                      No {tab}s yet.
                    </td>
                  </tr>
                )}

              {!loading &&
                paginatedItems.map(
                  (contact) => (
                    <tr
                      key={contact.id}
                      style={{
                        verticalAlign:
                          'middle',
                      }}
                    >
                      {/* ID */}
                      <td
                        style={{
                          whiteSpace:
                            'nowrap',
                          overflow:
                            'hidden',
                          textOverflow:
                            'ellipsis',
                        }}
                      >
                        <span
                          style={{
                            fontWeight: 600,
                            color:
                              'var(--navy-muted)',
                            fontSize:
                              '12px',
                          }}
                        >
                          #{contact.id}
                        </span>
                      </td>

                      {/* Actions */}
                      <td
                        style={{
                          whiteSpace:
                            'nowrap',
                          overflow:
                            'hidden',
                        }}
                      >
                        {canEdit ? (
                          <span
                            style={{
                              display:
                                'flex',
                              gap: '4px',
                              alignItems:
                                'center',
                            }}
                          >
                            <button
                              className="contact-link-btn"
                              onClick={() =>
                                navigate(
                                  `/contacts/${contact.id}`
                                )
                              }
                              title="Edit"
                            >
                              Edit
                            </button>

                            <span
                              style={{
                                color:
                                  'var(--navy-border)',
                                fontSize:
                                  '11px',
                                userSelect:
                                  'none',
                              }}
                            >
                              ·
                            </span>

                            <button
                              className="contact-link-btn contact-link-btn--danger"
                              onClick={() =>
                                handleSoftDelete(
                                  contact
                                )
                              }
                              disabled={
                                deletingId ===
                                contact.id
                              }
                              title="Delete"
                            >
                              {deletingId ===
                              contact.id
                                ? '…'
                                : 'Del'}
                            </button>
                          </span>
                        ) : null}
                      </td>

                      {/* Name */}
                      <td>
                        <span
                          style={{
                            fontWeight: 500,
                          }}
                        >
                          {contact.name}
                        </span>
                      </td>

                      {/* Balance */}
                      <td
                        style={{
                          whiteSpace:
                            'nowrap',
                          textAlign:
                            'right',
                          fontVariantNumeric:
                            'tabular-nums',
                        }}
                      >
                        <span
                          style={{
                            fontWeight: 600,
                            color:
                              (
                                balances[
                                  contact.id
                                ] || 0
                              ) < 0
                                ? 'var(--error-color, #e05252)'
                                : (
                                    balances[
                                      contact.id
                                    ] || 0
                                  ) > 0
                                ? 'var(--success-color, #36b37e)'
                                : 'inherit',
                          }}
                        >
                          {business?.currency}{' '}
                          {(
                            balances[
                              contact.id
                            ] || 0
                          ).toFixed(2)}
                        </span>
                      </td>

                      {/* Contact number */}
                      <td
                        style={{
                          whiteSpace:
                            'nowrap',
                          fontVariantNumeric:
                            'tabular-nums',
                        }}
                      >
                        {contact.contact_number ||
                          '—'}
                      </td>

                      {/* Address */}
                      <td>
                        {contact.address ? (
                          <button
                            type="button"
                            className="contact-link-btn"
                            onClick={() =>
                              setSelectedAddress(
                                contact
                              )
                            }
                          >
                            View
                          </button>
                        ) : (
                          <span
                            style={{
                              color:
                                'var(--navy-muted)',
                            }}
                          >
                            —
                          </span>
                        )}
                      </td>

                      {/* Created by */}
                      <td
                        style={{
                          color:
                            'var(--navy-muted)',
                          fontSize:
                            '12px',
                        }}
                      >
                        {usersMap[
                          contact.created_by
                        ] || '—'}
                      </td>

                      {/* Added on */}
                      <td
                        style={{
                          whiteSpace:
                            'nowrap',
                          color:
                            'var(--navy-muted)',
                          fontSize:
                            '12px',
                        }}
                      >
                        {formatDate(
                          contact.created_at
                        )}
                      </td>

                      {/* Email */}
                      <td
                        style={{
                          fontSize:
                            '12px',
                          maxWidth:
                            '160px',
                          overflow:
                            'hidden',
                          textOverflow:
                            'ellipsis',
                          whiteSpace:
                            'nowrap',
                        }}
                      >
                        {contact.email ? (
                          <a
                            href={`mailto:${contact.email}`}
                            style={{
                              color:
                                'inherit',
                              textDecoration:
                                'underline',
                              textDecorationStyle:
                                'dotted',
                            }}
                          >
                            {contact.email}
                          </a>
                        ) : (
                          <span
                            style={{
                              color:
                                'var(--navy-muted)',
                            }}
                          >
                            —
                          </span>
                        )}
                      </td>

                      {/* Supplier-only columns */}
                      {tab ===
                        'supplier' && (
                        <>
                          <td
                            style={{
                              fontSize:
                                '12px',
                            }}
                          >
                            {contact.tax_ntn_number || (
                              <span
                                style={{
                                  color:
                                    'var(--navy-muted)',
                                }}
                              >
                                —
                              </span>
                            )}
                          </td>

                          <td
                            style={{
                              fontSize:
                                '12px',
                              color:
                                'var(--navy-muted)',
                            }}
                          >
                            {contact.business_name ||
                              '—'}
                          </td>
                        </>
                      )}
                    </tr>
                  )
                )}

              {!loading &&
                paginatedItems.length >
                  0 && (
                  <tr className="table-total-row">
                    <td colSpan={3}>
                      <strong>
                        Total for current
                        page
                      </strong>
                    </td>

                    <td
                      style={{
                        textAlign:
                          'right',
                        whiteSpace:
                          'nowrap',
                        fontVariantNumeric:
                          'tabular-nums',
                      }}
                    >
                      <strong>
                        {business?.currency}{' '}
                        {currentPageBalanceTotal.toFixed(
                          2
                        )}
                      </strong>
                    </td>

                    <td
                      colSpan={
                        tab === 'supplier'
                          ? 7
                          : 5
                      }
                    ></td>
                  </tr>
                )}
            </tbody>
          </table>

          <style>{`
            .contact-link-btn {
              background: none;
              border: none;
              cursor: pointer;
              font-size: 11.5px;
              font-weight: 500;
              padding: 1px 3px;
              border-radius: 3px;
              color: var(--primary-color, #4f6ef7);
              transition: background 0.15s, color 0.15s;
              line-height: 1.5;
            }

            .contact-link-btn:hover {
              background: rgba(79,110,247,0.1);
              color: var(--primary-color, #4f6ef7);
            }

            .contact-link-btn--danger {
              color: var(--error-color, #e05252);
            }

            .contact-link-btn--danger:hover {
              background: rgba(224,82,82,0.1);
              color: var(--error-color, #e05252);
            }

            .contact-link-btn:disabled {
              opacity: 0.45;
              cursor: not-allowed;
            }

            .data-table td,
            .data-table th {
              padding: 8px 12px;
              line-height: 1.4;
            }
          `}</style>
        </div>

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          firstItemIndex={firstItemIndex}
          lastItemIndex={lastItemIndex}
          goToPage={goToPage}
          nextPage={nextPage}
          previousPage={previousPage}
          hasNextPage={hasNextPage}
          hasPreviousPage={hasPreviousPage}
        />
      </div>

      {selectedAddress && (
        <div
          className="modal-backdrop"
          onClick={() =>
            setSelectedAddress(null)
          }
          style={{
            position: 'fixed',
            inset: 0,
            background:
              'rgba(19, 26, 51, 0.6)',
            backdropFilter:
              'blur(2px)',
            display: 'flex',
            alignItems:
              'center',
            justifyContent:
              'center',
            zIndex: 9999,
            padding: '20px',
          }}
        >
          <div
            className="card"
            onClick={(e) =>
              e.stopPropagation()
            }
            style={{
              width:
                'min(560px, 92vw)',
              padding: '24px',
            }}
          >
            <div
              style={{
                display:
                  'flex',
                justifyContent:
                  'space-between',
                alignItems:
                  'center',
                gap: '16px',
                marginBottom:
                  '16px',
              }}
            >
              <div>
                <h2
                  style={{
                    margin: 0,
                  }}
                >
                  Address
                </h2>

                <p
                  className="muted"
                  style={{
                    margin:
                      '4px 0 0',
                  }}
                >
                  {
                    selectedAddress.name
                  }
                </p>
              </div>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={() =>
                  setSelectedAddress(
                    null
                  )
                }
              >
                Close
              </button>
            </div>

            <div
              style={{
                whiteSpace:
                  'pre-wrap',
                lineHeight: 1.6,
                wordBreak:
                  'break-word',
              }}
            >
              {
                selectedAddress.address
              }
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}