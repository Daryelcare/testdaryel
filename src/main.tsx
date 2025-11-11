import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { PermissionsProvider } from './contexts/PermissionsContext'
import { AuthProvider } from './contexts/AuthContext'
import { UserPreferencesProvider } from './contexts/UserPreferencesContext'

createRoot(document.getElementById("root")!).render(
  <AuthProvider>
    <PermissionsProvider>
      <UserPreferencesProvider>
        <App />
      </UserPreferencesProvider>
    </PermissionsProvider>
  </AuthProvider>
);
