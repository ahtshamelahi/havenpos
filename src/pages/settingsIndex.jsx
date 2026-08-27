import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function SettingsIndex() {
  const { profile } = useAuth();
  const isOwner = profile?.is_owner;
  
  if (isOwner) {
    return <Navigate to="/settings/business" replace />;
  }
  
  return <Navigate to="/settings/preferences" replace />;
}
