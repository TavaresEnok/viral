import { redirect } from 'next/navigation';

// O console admin foi movido para /admin (shell próprio). Mantém compat com
// links/atalhos antigos.
export default function LegacyAdminRedirect() {
  redirect('/admin');
}
