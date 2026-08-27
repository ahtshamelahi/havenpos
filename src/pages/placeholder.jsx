import AppLayout from '../components/AppLayout.jsx';

export default function Placeholder({ title }) {
  return (
    <AppLayout>
      <div className="card" style={{ padding: '48px 32px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 20, marginBottom: 8 }}>{title}</h1>
        <p className="muted">This module is coming up next in the build order.</p>
      </div>
    </AppLayout>
  );
}
