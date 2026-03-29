import { StoreProvider, useStore } from './context/StoreContext'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import TemplatesPage from './pages/TemplatesPage'
import ContractorsPage from './pages/ContractorsPage'
import CatalogPage from './pages/CatalogPage'
import DocumentWizard from './pages/DocumentWizard'
import DocumentsPage from './pages/DocumentsPage'
import SettingsPage from './pages/SettingsPage'

function Shell() {
  const { view } = useStore()
  return (
    <Layout>
      {view === 'dashboard' && <Dashboard />}
      {view === 'templates' && <TemplatesPage />}
      {view === 'contractors' && <ContractorsPage />}
      {view === 'catalog' && <CatalogPage />}
      {view === 'wizard' && <DocumentWizard />}
      {view === 'documents' && <DocumentsPage />}
      {view === 'settings' && <SettingsPage />}
    </Layout>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  )
}
