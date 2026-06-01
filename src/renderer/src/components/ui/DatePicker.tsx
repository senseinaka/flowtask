import { useState, useRef, useEffect } from 'react'
import dayjs from 'dayjs'
import { ChevronLeft, ChevronRight, Calendar, X } from 'lucide-react'
import { cn } from './utils'

interface DatePickerProps {
  value: string       // 'YYYY-MM-DD' or ''
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}

const DAYS = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa']
const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

export default function DatePicker({ value, onChange, placeholder = 'Seleccionar fecha', className }: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const [viewing, setViewing] = useState(() => value ? dayjs(value) : dayjs())
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (value) setViewing(dayjs(value))
  }, [value])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const startOfMonth = viewing.startOf('month')
  const daysInMonth = viewing.daysInMonth()
  const startDay = startOfMonth.day() // 0=Sunday
  const today = dayjs()
  const selected = value ? dayjs(value) : null

  const cells: (number | null)[] = [
    ...Array(startDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1)
  ]
  // pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null)

  const handleDay = (day: number) => {
    const d = viewing.date(day).format('YYYY-MM-DD')
    onChange(d)
    setOpen(false)
  }

  const display = selected ? selected.format('DD/MM/YYYY') : ''

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-left focus:outline-none focus:border-indigo-500 transition-colors hover:border-slate-600"
      >
        <Calendar size={12} className="text-slate-500 flex-shrink-0" />
        <span className={display ? 'text-slate-200' : 'text-slate-500'}>{display || placeholder}</span>
        {display && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange(''); setOpen(false) }}
            className="ml-auto text-slate-600 hover:text-slate-300 transition-colors"
          >
            <X size={11} />
          </button>
        )}
      </button>

      {open && (
        <div className="absolute z-50 mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-xl p-3 w-56">
          {/* Month nav */}
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={() => setViewing((v) => v.subtract(1, 'month'))}
              className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-xs font-medium text-slate-200">
              {MONTHS[viewing.month()]} {viewing.year()}
            </span>
            <button
              type="button"
              onClick={() => setViewing((v) => v.add(1, 'month'))}
              className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS.map((d) => (
              <div key={d} className="text-center text-[10px] text-slate-500 font-medium py-0.5">{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-y-0.5">
            {cells.map((day, i) => {
              if (!day) return <div key={i} />
              const date = viewing.date(day)
              const isSelected = selected?.isSame(date, 'day')
              const isToday = today.isSame(date, 'day')
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleDay(day)}
                  className={cn(
                    'text-[11px] h-6 w-6 mx-auto rounded-full transition-colors',
                    isSelected
                      ? 'bg-indigo-600 text-white font-semibold'
                      : isToday
                        ? 'text-indigo-400 font-semibold hover:bg-slate-700'
                        : 'text-slate-300 hover:bg-slate-700'
                  )}
                >
                  {day}
                </button>
              )
            })}
          </div>

          {/* Today shortcut */}
          <button
            type="button"
            onClick={() => { onChange(today.format('YYYY-MM-DD')); setOpen(false) }}
            className="mt-2 w-full text-center text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            Hoy
          </button>
        </div>
      )}
    </div>
  )
}
