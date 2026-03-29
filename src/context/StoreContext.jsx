import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { createBuiltinTemplates, BUILTIN_TEMPLATE_IDS } from '../data/builtinTemplates'
import { newId } from '../utils/ids'

const KEYS = {
  company: 'legalDoc_company_v1',
  contractors: 'legalDoc_contractors_v1',
  templates: 'legalDoc_templates_v1',
  documents: 'legalDoc_documents_v1',
  catalog: 'legalDoc_catalog_v1',
}

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (e) {
    console.error('localStorage save', key, e)
  }
}

const defaultCompany = {
  fullName: '',
  shortName: '',
  inn: '',
  kpp: '',
  ogrn: '',
  address: '',
  bank: '',
  bik: '',
  account: '',
  correspondentAccount: '',
  director: '',
  directorPosition: '',
  email: '',
  phone: '',
  website: '',
  stampImage: '',
  signatureImage: '',
}

function mergeBuiltinTemplates(existing) {
  const list = Array.isArray(existing) ? [...existing] : []
  const ids = new Set(list.map((t) => t.id))
  for (const b of createBuiltinTemplates()) {
    if (!ids.has(b.id)) list.push(b)
  }
  return list
}

const StoreContext = createContext(null)

export function StoreProvider({ children }) {
  const [view, setView] = useState('dashboard')
  const [company, setCompany] = useState(() => {
    const c = load(KEYS.company, defaultCompany)
    return { ...defaultCompany, ...c }
  })
  const [contractors, setContractors] = useState(() => load(KEYS.contractors, []))
  const [templates, setTemplates] = useState(() => mergeBuiltinTemplates(load(KEYS.templates, [])))
  const [documents, setDocuments] = useState(() => load(KEYS.documents, []))
  const [catalog, setCatalog] = useState(() => load(KEYS.catalog, []))
  const [wizardResume, setWizardResume] = useState(null)

  useEffect(() => save(KEYS.company, company), [company])
  useEffect(() => save(KEYS.contractors, contractors), [contractors])
  useEffect(() => save(KEYS.templates, templates), [templates])
  useEffect(() => save(KEYS.documents, documents), [documents])
  useEffect(() => save(KEYS.catalog, catalog), [catalog])

  const updateCompany = useCallback((patch) => {
    setCompany((prev) => ({ ...prev, ...patch }))
  }, [])

  const addContractor = useCallback((row) => {
    const c = {
      id: newId(),
      name: row.name ?? '',
      shortName: row.shortName ?? '',
      inn: row.inn ?? '',
      kpp: row.kpp ?? '',
      ogrn: row.ogrn ?? '',
      address: row.address ?? '',
      bank: row.bank ?? '',
      bik: row.bik ?? '',
      account: row.account ?? '',
      correspondentAccount: row.correspondentAccount ?? '',
      director: row.director ?? '',
      directorPosition: row.directorPosition ?? '',
      email: row.email ?? '',
      phone: row.phone ?? '',
      createdAt: new Date().toISOString(),
    }
    setContractors((prev) => [...prev, c])
    return c
  }, [])

  const updateContractor = useCallback((id, patch) => {
    setContractors((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  }, [])

  const deleteContractor = useCallback((id) => {
    setContractors((prev) => prev.filter((c) => c.id !== id))
  }, [])

  const addTemplate = useCallback((t) => {
    const row = {
      id: newId(),
      name: t.name,
      type: t.type,
      content: t.content,
      isCustom: true,
      createdAt: new Date().toISOString(),
    }
    setTemplates((prev) => [...prev, row])
    return row
  }, [])

  const deleteTemplate = useCallback((id) => {
    if (BUILTIN_TEMPLATE_IDS.includes(id)) return false
    setTemplates((prev) => prev.filter((t) => t.id !== id))
    return true
  }, [])

  const addDocument = useCallback((doc) => {
    setDocuments((prev) => [{ ...doc, id: doc.id || newId() }, ...prev])
  }, [])

  const upsertDocument = useCallback((doc) => {
    setDocuments((prev) => {
      const i = prev.findIndex((d) => d.id === doc.id)
      if (i === -1) return [{ ...doc }, ...prev]
      const next = [...prev]
      next[i] = { ...next[i], ...doc }
      return next
    })
  }, [])

  const deleteDocument = useCallback((id) => {
    setDocuments((prev) => prev.filter((d) => d.id !== id))
  }, [])

  const addCatalogItem = useCallback((row) => {
    const item = {
      id: newId(),
      name: row.name,
      quantity: Number(row.quantity) || 1,
      unit: row.unit || 'шт.',
      price: Number(row.price) || 0,
      amount: (Number(row.quantity) || 1) * (Number(row.price) || 0),
      type: row.type === 'product' ? 'product' : 'service',
    }
    setCatalog((prev) => [...prev, item])
    return item
  }, [])

  const updateCatalogItem = useCallback((id, patch) => {
    setCatalog((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c
        const n = { ...c, ...patch }
        n.amount = (Number(n.quantity) || 0) * (Number(n.price) || 0)
        return n
      }),
    )
  }, [])

  const deleteCatalogItem = useCallback((id) => {
    setCatalog((prev) => prev.filter((c) => c.id !== id))
  }, [])

  const openDocumentInWizard = useCallback((doc) => {
    setWizardResume(doc)
    setView('wizard')
  }, [])

  const clearWizardResume = useCallback(() => setWizardResume(null), [])

  const exportAllDataJson = useCallback(() => {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      company,
      contractors,
      templates: templates.filter((t) => t.isCustom),
      documents,
      catalog,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `legal-docs-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }, [company, contractors, templates, documents, catalog])

  const importAllDataJson = useCallback((file) => {
    return new Promise((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => {
        try {
          const data = JSON.parse(String(r.result))
          if (data.company) setCompany({ ...defaultCompany, ...data.company })
          if (Array.isArray(data.contractors)) setContractors(data.contractors)
          if (Array.isArray(data.documents)) setDocuments(data.documents)
          if (Array.isArray(data.catalog)) setCatalog(data.catalog)
          if (Array.isArray(data.templates)) {
            const custom = data.templates.filter((t) => t.isCustom)
            setTemplates(mergeBuiltinTemplates(custom))
          }
          resolve(true)
        } catch (e) {
          reject(e)
        }
      }
      r.onerror = () => reject(new Error('Не удалось прочитать файл'))
      r.readAsText(file, 'utf-8')
    })
  }, [])

  const value = useMemo(
    () => ({
      view,
      setView,
      company,
      updateCompany,
      contractors,
      addContractor,
      updateContractor,
      deleteContractor,
      templates,
      setTemplates,
      addTemplate,
      deleteTemplate,
      documents,
      addDocument,
      upsertDocument,
      deleteDocument,
      catalog,
      addCatalogItem,
      updateCatalogItem,
      deleteCatalogItem,
      wizardResume,
      openDocumentInWizard,
      clearWizardResume,
      exportAllDataJson,
      importAllDataJson,
    }),
    [
      view,
      company,
      contractors,
      templates,
      documents,
      catalog,
      wizardResume,
      updateCompany,
      addContractor,
      updateContractor,
      deleteContractor,
      addTemplate,
      deleteTemplate,
      addDocument,
      upsertDocument,
      deleteDocument,
      addCatalogItem,
      updateCatalogItem,
      deleteCatalogItem,
      openDocumentInWizard,
      clearWizardResume,
      exportAllDataJson,
      importAllDataJson,
    ],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore вне StoreProvider')
  return ctx
}
