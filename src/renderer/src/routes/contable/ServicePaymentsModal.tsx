import { useState } from 'react'
import dayjs from 'dayjs'
import { X, Loader2, Receipt, Trash2, ExternalLink, CalendarClock } from 'lucide-react'
import { parseAmount } from '../../lib/parseAmount'
import {
  useServicePayments, useRegisterServicePayment, useDeleteServicePayment,
} from '../../hooks/useAccountingServices'
import type { AccountingService } from '@shared/types'
import {
  PAYMENT_METHOD_OPTIONS, PAYMENT_METHOD_LABEL, FREQUENCY_LABEL, MONTHS_PER_PERIOD, fmtMoney,
} from './services.constants'

function addPeriod(dateStr: string, service: AccountingService): string {
  const base = dayjs(dateStr)
  const months = MONTHS_PER_PERIOD[service.billing_frequency]
  if (!base.isValid() || !months) return ''
  return base.add(months, 'month').format('YYYY-MM-DD')
}

export default function ServicePaymentsModal({ service, canWrite, onClose }: {
  service: AccountingService
  canWrite: boolean
  onClose: () => void
}) {
  const { data: payments = [], isLoading } = useServicePayments(service.id)
  const register = useRegisterServicePayment()
  const delPayment = useDeleteServicePayment()

  const today = dayjs().format('YYYY-MM-DD')
  const [paymentDate, setPaymentDate] = useState(today)
  const [amountStr, setAmountStr] = useState(String(service.amount ?? ''))
  const [currency, setCurrency] = useState(service.currency || 'ARS')
  const [periodFrom, setPeriodFrom] = useState(service.next_due_date || today)
  const [periodTo, setPeriodTo] = useState('')
  const [method, setMethod] = useState(service.payment_method || '')
  const [receipt, setReceipt] = useState('')
  const [notes, setNotes] = useState('')
  const [nextDue, setNextDue] = useState(addPeriod(today, service))
  const [confirmDel, setConfirmDel] = useState<string | null>(null)

  async function handleRegister() {
    await register.mutateAsync({
      service_id: service.id,
      payment_date: paymentDate,
      amount: parseAmount(amountStr),
      currency,
      period_from: periodFrom,
      period_to: periodTo,
      payment_method: method as AccountingService['payment_method'],
      receipt_url: receipt,
      notes,
      next_due_date: nextDue || undefined,
    })
    // Reset campos de carga (deja fechas para la próxima)
    setReceipt(''); setNotes('')
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-700 shrink-0">
          <Receipt size={17} className="text-emerald-400" />
          <div className="flex-1">
            <h2 className="text-base font-semibold leading-tight">{service.name}</h2>
            <p className="text-xs text-slate-400">
              {FREQUENCY_LABEL[service.billing_frequency]} · {fmtMoney(service.amount, service.currency)}
              {service.next_due_date && <> · próximo venc. {dayjs(service.next_due_date).format('DD-MM-YYYY')}</>}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-700 text-slate-400"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Registrar pago / renovación */}
          {canWrite && (
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 space-y-3">
              <p className="text-sm font-medium flex items-center gap-1.5"><CalendarClock size={14} className="text-emerald-400" /> Registrar pago / renovación</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Lbl t="Fecha de pago"><input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} className={inp} /></Lbl>
                <Lbl t="Valor pagado"><input value={amountStr} onChange={e => setAmountStr(e.target.value)} inputMode="decimal" className={inp} /></Lbl>
                <Lbl t="Moneda">
                  <select value={currency} onChange={e => setCurrency(e.target.value)} className={inp}>
                    {['ARS', 'USD', 'EUR'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Lbl>
                <Lbl t="Período desde"><input type="date" value={periodFrom} onChange={e => setPeriodFrom(e.target.value)} className={inp} /></Lbl>
                <Lbl t="Período hasta"><input type="date" value={periodTo} onChange={e => setPeriodTo(e.target.value)} className={inp} /></Lbl>
                <Lbl t="Medio de pago">
                  <select value={method} onChange={e => setMethod(e.target.value)} className={inp}>
                    {PAYMENT_METHOD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </Lbl>
                <Lbl t="Comprobante (link)"><input value={receipt} onChange={e => setReceipt(e.target.value)} placeholder="https://..." className={inp} /></Lbl>
                <Lbl t="Nota"><input value={notes} onChange={e => setNotes(e.target.value)} className={inp} /></Lbl>
                <Lbl t="↳ Nuevo próximo vencimiento" hl><input type="date" value={nextDue} onChange={e => setNextDue(e.target.value)} className={inp + ' border-emerald-700'} /></Lbl>
              </div>
              <div className="flex justify-end">
                <button onClick={handleRegister} disabled={register.isPending}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded text-sm text-white transition-colors">
                  {register.isPending ? <Loader2 size={14} className="animate-spin" /> : <Receipt size={14} />}
                  Registrar
                </button>
              </div>
            </div>
          )}

          {/* Historial */}
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Historial de pagos</p>
            {isLoading ? (
              <p className="text-slate-500 text-sm">Cargando...</p>
            ) : payments.length === 0 ? (
              <p className="text-slate-500 text-sm py-4 text-center">Sin pagos registrados todavía.</p>
            ) : (
              <div className="space-y-2">
                {payments.map(p => (
                  <div key={p.id} className="bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm">
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-slate-100">{dayjs(p.payment_date).format('DD-MM-YYYY')}</span>
                      <span className="font-semibold text-emerald-400">{fmtMoney(p.amount, p.currency)}</span>
                      {p.payment_method && <span className="text-xs text-slate-400">{PAYMENT_METHOD_LABEL[p.payment_method as keyof typeof PAYMENT_METHOD_LABEL] ?? p.payment_method}</span>}
                      <div className="ml-auto flex items-center gap-1">
                        {p.receipt_url && (
                          <button title="Abrir comprobante" onClick={() => window.api.shell.open(p.receipt_url)}
                            className="p-1 rounded hover:bg-slate-700 text-slate-300"><ExternalLink size={13} /></button>
                        )}
                        {canWrite && (
                          confirmDel === p.id ? (
                            <button onClick={() => { delPayment.mutate({ id: p.id, serviceId: service.id }); setConfirmDel(null) }}
                              className="text-xs px-2 py-0.5 bg-red-600 hover:bg-red-500 rounded text-white">¿Borrar?</button>
                          ) : (
                            <button title="Borrar" onClick={() => setConfirmDel(p.id)}
                              className="p-1 rounded hover:bg-slate-700 text-red-400"><Trash2 size={13} /></button>
                          )
                        )}
                      </div>
                    </div>
                    {(p.period_from || p.period_to) && (
                      <p className="text-xs text-slate-500 mt-1">
                        Período: {p.period_from ? dayjs(p.period_from).format('DD-MM-YYYY') : '—'} → {p.period_to ? dayjs(p.period_to).format('DD-MM-YYYY') : '—'}
                      </p>
                    )}
                    {p.notes && <p className="text-xs text-slate-400 mt-1">{p.notes}</p>}
                    <p className="text-[11px] text-slate-600 mt-1">
                      {p.created_by && <>Registrado por {p.created_by} · </>}{dayjs(p.created_at).format('DD-MM-YYYY HH:mm')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const inp = 'w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-sm outline-none focus:border-emerald-500'

function Lbl({ t, hl, children }: { t: string; hl?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className={`block text-xs mb-1 ${hl ? 'text-emerald-400' : 'text-slate-400'}`}>{t}</label>
      {children}
    </div>
  )
}
