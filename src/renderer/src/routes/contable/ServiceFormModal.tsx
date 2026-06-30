import { useState } from 'react'
import { X, Loader2, ShieldCheck, Save, Settings } from 'lucide-react'
import { parseAmount } from '../../lib/parseAmount'
import { useCreateService, useUpdateService } from '../../hooks/useAccountingServices'
import type { AccountingService, CreateAccountingServiceInput } from '@shared/types'
import { STATUS_OPTIONS, FREQUENCY_OPTIONS, CURRENCY_OPTIONS } from './services.constants'
import { useCatalog } from '../../hooks/useServiceCatalog'
import type { CatalogType } from '../../hooks/useServiceCatalog'
import ServiceCatalogModal from './ServiceCatalogModal'

const EMPTY: CreateAccountingServiceInput = {
  name: '', category: 'software', provider: '', description: '', area: '', internal_owner: '', status: 'activo',
  amount: 0, currency: 'ARS', billing_frequency: 'mensual', payment_method: '', auto_renewal: 0, requires_approval: 0,
  start_date: '', last_payment_date: '', next_due_date: '', next_renewal_date: '', decision_deadline_date: '',
  contact_name: '', contact_email: '', contact_phone: '', manager_name: '', manager_email: '', manager_phone: '',
  document_url: '', provider_portal_url: '', notes: '',
  insurance_company: '', policy_number: '', coverage_type: '', insured_asset: '', insured_amount: 0,
  coverage_start_date: '', coverage_end_date: '', broker_name: '', broker_contact: '',
}

function fromService(s: AccountingService): CreateAccountingServiceInput {
  const { id, workspace_id, deleted_at, created_at, updated_at, ...rest } = s
  void id; void workspace_id; void deleted_at; void created_at; void updated_at
  return rest
}

export default function ServiceFormModal({ service, onClose }: {
  service: AccountingService | null
  onClose: () => void
}) {
  const create = useCreateService()
  const update = useUpdateService()
  const [form, setForm] = useState<CreateAccountingServiceInput>(service ? fromService(service) : EMPTY)
  const [amountStr, setAmountStr] = useState(service ? String(service.amount ?? '') : '')
  const [insuredStr, setInsuredStr] = useState(service ? String(service.insured_amount ?? '') : '')
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'general' | 'contactos'>('general')
  const [catalogModal, setCatalogModal] = useState<CatalogType | null>(null)

  const { data: categories = [] } = useCatalog('category')
  const { data: areas = [] } = useCatalog('area')
  const { data: paymentMethods = [] } = useCatalog('payment_method')

  const upd = <K extends keyof CreateAccountingServiceInput>(key: K, val: CreateAccountingServiceInput[K]) =>
    setForm(f => ({ ...f, [key]: val }))

  const isInsurance = form.category === 'seguro'
  const saving = create.isPending || update.isPending

  async function handleSave() {
    if (!form.name.trim()) {
      setError('El nombre del servicio es obligatorio')
      setTab('general')
      return
    }
    const payload: CreateAccountingServiceInput = {
      ...form,
      amount: parseAmount(amountStr),
      insured_amount: parseAmount(insuredStr),
    }
    try {
      if (service) await update.mutateAsync({ id: service.id, patch: payload })
      else await create.mutateAsync(payload)
      onClose()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-700 shrink-0">
          <h2 className="text-base font-semibold flex-1">{service ? 'Editar servicio' : 'Nuevo servicio'}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-700 text-slate-400"><X size={18} /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-700 shrink-0">
          <TabBtn active={tab === 'general'} onClick={() => setTab('general')}>General</TabBtn>
          <TabBtn active={tab === 'contactos'} onClick={() => setTab('contactos')}>Contactos y docs</TabBtn>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">

          {/* ── TAB GENERAL ── */}
          {tab === 'general' && (
            <>
              <Section title="Datos principales">
                <Grid>
                  <Field label="Nombre del servicio *" full>
                    <Input value={form.name} onChange={v => upd('name', v)} placeholder="CapCut Pro" />
                  </Field>
                  <Field label="Categoría">
                    <CatalogSelect
                      value={form.category}
                      onChange={v => upd('category', v)}
                      entries={categories}
                      onGear={() => setCatalogModal('category')}
                    />
                  </Field>
                  <Field label="Proveedor">
                    <Input value={form.provider} onChange={v => upd('provider', v)} placeholder="CapCut" />
                  </Field>
                  <Field label="Área interna">
                    <CatalogCombo
                      value={form.area}
                      onChange={v => upd('area', v)}
                      listId="area-datalist"
                      entries={areas}
                      onGear={() => setCatalogModal('area')}
                      placeholder="Marketing"
                    />
                  </Field>
                  <Field label="Responsable interno">
                    <Input value={form.internal_owner} onChange={v => upd('internal_owner', v)} placeholder="Quién lo gestiona" />
                  </Field>
                  <Field label="Estado">
                    <Select value={form.status} onChange={v => upd('status', v as AccountingService['status'])} options={STATUS_OPTIONS} />
                  </Field>
                  <Field label="Descripción / nota" full>
                    <textarea value={form.description} onChange={e => upd('description', e.target.value)} rows={2}
                      className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm outline-none focus:border-emerald-500 resize-none" />
                  </Field>
                </Grid>
              </Section>

              <Section title="Datos económicos">
                <Grid>
                  <Field label="Valor">
                    <input value={amountStr} onChange={e => setAmountStr(e.target.value)} inputMode="decimal" placeholder="89"
                      className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm outline-none focus:border-emerald-500" />
                  </Field>
                  <Field label="Moneda">
                    <Select value={form.currency} onChange={v => upd('currency', v)} options={CURRENCY_OPTIONS.map(c => ({ value: c, label: c }))} />
                  </Field>
                  <Field label="Frecuencia de pago">
                    <Select value={form.billing_frequency} onChange={v => upd('billing_frequency', v as AccountingService['billing_frequency'])} options={FREQUENCY_OPTIONS} />
                  </Field>
                  <Field label="Medio de pago">
                    <CatalogSelect
                      value={form.payment_method}
                      onChange={v => upd('payment_method', v)}
                      entries={paymentMethods}
                      onGear={() => setCatalogModal('payment_method')}
                      allowEmpty
                    />
                  </Field>
                  <Field label="" full>
                    <div className="flex flex-wrap gap-5 pt-1">
                      <Check label="Renovación automática" checked={form.auto_renewal === 1} onChange={c => upd('auto_renewal', c ? 1 : 0)} />
                      <Check label="Requiere aprobación antes de renovar" checked={form.requires_approval === 1} onChange={c => upd('requires_approval', c ? 1 : 0)} />
                    </div>
                  </Field>
                </Grid>
              </Section>

              <Section title="Fechas">
                <Grid>
                  <Field label="Fecha de inicio"><DateInput value={form.start_date} onChange={v => upd('start_date', v)} /></Field>
                  <Field label="Último pago"><DateInput value={form.last_payment_date} onChange={v => upd('last_payment_date', v)} /></Field>
                  <Field label="Próximo vencimiento" hint="La fecha más importante del módulo">
                    <DateInput value={form.next_due_date} onChange={v => upd('next_due_date', v)} />
                  </Field>
                  <Field label="Próxima renovación"><DateInput value={form.next_renewal_date} onChange={v => upd('next_renewal_date', v)} /></Field>
                  <Field label="Límite para decidir cancelación/renovación" full>
                    <DateInput value={form.decision_deadline_date} onChange={v => upd('decision_deadline_date', v)} />
                  </Field>
                </Grid>
              </Section>

              {isInsurance && (
                <Section title="Datos de la póliza" icon={<ShieldCheck size={14} className="text-violet-400" />}>
                  <Grid>
                    <Field label="Compañía aseguradora"><Input value={form.insurance_company} onChange={v => upd('insurance_company', v)} /></Field>
                    <Field label="Número de póliza"><Input value={form.policy_number} onChange={v => upd('policy_number', v)} /></Field>
                    <Field label="Tipo de cobertura"><Input value={form.coverage_type} onChange={v => upd('coverage_type', v)} /></Field>
                    <Field label="Bien asegurado"><Input value={form.insured_asset} onChange={v => upd('insured_asset', v)} /></Field>
                    <Field label="Suma asegurada">
                      <input value={insuredStr} onChange={e => setInsuredStr(e.target.value)} inputMode="decimal"
                        className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm outline-none focus:border-emerald-500" />
                    </Field>
                    <Field label="Vigencia desde"><DateInput value={form.coverage_start_date} onChange={v => upd('coverage_start_date', v)} /></Field>
                    <Field label="Vigencia hasta"><DateInput value={form.coverage_end_date} onChange={v => upd('coverage_end_date', v)} /></Field>
                    <Field label="Gestor / productor"><Input value={form.broker_name} onChange={v => upd('broker_name', v)} /></Field>
                    <Field label="Contacto del gestor"><Input value={form.broker_contact} onChange={v => upd('broker_contact', v)} placeholder="Teléfono o email" /></Field>
                  </Grid>
                </Section>
              )}
            </>
          )}

          {/* ── TAB CONTACTOS ── */}
          {tab === 'contactos' && (
            <>
              <Section title="Contacto en el proveedor">
                <Grid>
                  <Field label="Nombre"><Input value={form.contact_name} onChange={v => upd('contact_name', v)} /></Field>
                  <Field label="Email"><Input value={form.contact_email} onChange={v => upd('contact_email', v)} placeholder="correo@proveedor.com" /></Field>
                  <Field label="Teléfono"><Input value={form.contact_phone} onChange={v => upd('contact_phone', v)} /></Field>
                </Grid>
              </Section>

              <Section title="Responsable interno">
                <Grid>
                  <Field label="Nombre"><Input value={form.manager_name} onChange={v => upd('manager_name', v)} /></Field>
                  <Field label="Email"><Input value={form.manager_email} onChange={v => upd('manager_email', v)} /></Field>
                  <Field label="Teléfono"><Input value={form.manager_phone} onChange={v => upd('manager_phone', v)} /></Field>
                </Grid>
              </Section>

              <Section title="Documentos y referencias">
                <Grid>
                  <Field label="URL de documento o carpeta (Drive)" full>
                    <Input value={form.document_url} onChange={v => upd('document_url', v)} placeholder="https://drive.google.com/..." />
                  </Field>
                  <Field label="Portal del proveedor" full>
                    <Input value={form.provider_portal_url} onChange={v => upd('provider_portal_url', v)} placeholder="https://..." />
                  </Field>
                  <Field label="Notas internas" full>
                    <textarea value={form.notes} onChange={e => upd('notes', e.target.value)} rows={3}
                      className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm outline-none focus:border-emerald-500 resize-none" />
                  </Field>
                </Grid>
              </Section>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-t border-slate-700 shrink-0">
          {error && <span className="text-xs text-red-400 flex-1">{error}</span>}
          <button onClick={onClose} className="ml-auto px-4 py-2 text-sm text-slate-300 hover:text-slate-100">Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded text-sm text-white transition-colors">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {service ? 'Guardar cambios' : 'Crear servicio'}
          </button>
        </div>
      </div>

      {catalogModal && (
        <ServiceCatalogModal type={catalogModal} onClose={() => setCatalogModal(null)} />
      )}
    </div>
  )
}

// ─── UI helpers ─────────────────────────────────────────────────────────────────

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
        active
          ? 'border-emerald-500 text-emerald-400'
          : 'border-transparent text-slate-400 hover:text-slate-200'
      }`}
    >
      {children}
    </button>
  )
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">{icon} {title}</p>
      {children}
    </div>
  )
}
function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
}
function Field({ label, hint, full, children }: { label: string; hint?: string; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={full ? 'sm:col-span-2' : ''}>
      {label && <label className="block text-xs text-slate-400 mb-1">{label}{hint && <span className="text-slate-600"> · {hint}</span>}</label>}
      {children}
    </div>
  )
}
function Input({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm outline-none focus:border-emerald-500" />
  )
}
function DateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input type="date" value={value} onChange={e => onChange(e.target.value)}
      className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm outline-none focus:border-emerald-500" />
  )
}
function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm outline-none focus:border-emerald-500">
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}
function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (c: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="w-4 h-4 rounded accent-emerald-500" />
      {label}
    </label>
  )
}

/** Select que muestra entradas del catálogo + engranaje para abrir el modal de gestión. */
function CatalogSelect({
  value, onChange, entries, onGear, allowEmpty,
}: {
  value: string
  onChange: (v: string) => void
  entries: { id: string; value: string; label: string }[]
  onGear: () => void
  allowEmpty?: boolean
}) {
  return (
    <div className="flex gap-0">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="flex-1 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-l text-sm outline-none focus:border-emerald-500"
      >
        {allowEmpty && <option value="">—</option>}
        {/* Muestra el valor actual aunque no esté en el catálogo cargado */}
        {value && !entries.find(e => e.value === value) && (
          <option value={value}>{value}</option>
        )}
        {entries.map(e => <option key={e.id} value={e.value}>{e.label}</option>)}
      </select>
      <button
        type="button"
        onClick={onGear}
        title="Gestionar opciones"
        className="px-2 py-1.5 bg-slate-800 border border-slate-700 border-l-0 rounded-r text-slate-500 hover:text-slate-200 hover:bg-slate-700 transition-colors"
      >
        <Settings size={13} />
      </button>
    </div>
  )
}

/** Input con datalist de sugerencias del catálogo + engranaje para gestionar. */
function CatalogCombo({
  value, onChange, listId, entries, onGear, placeholder,
}: {
  value: string
  onChange: (v: string) => void
  listId: string
  entries: { id: string; label: string }[]
  onGear: () => void
  placeholder?: string
}) {
  return (
    <div className="flex gap-0">
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        list={listId}
        placeholder={placeholder}
        className="flex-1 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-l text-sm outline-none focus:border-emerald-500"
      />
      <datalist id={listId}>
        {entries.map(e => <option key={e.id} value={e.label} />)}
      </datalist>
      <button
        type="button"
        onClick={onGear}
        title="Gestionar áreas"
        className="px-2 py-1.5 bg-slate-800 border border-slate-700 border-l-0 rounded-r text-slate-500 hover:text-slate-200 hover:bg-slate-700 transition-colors"
      >
        <Settings size={13} />
      </button>
    </div>
  )
}
