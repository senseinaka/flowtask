import { Paperclip, FileText, Image as ImageIcon, File as FileIcon, Trash2, Loader2, Plus } from 'lucide-react'
import { cn } from '../../components/ui/utils'
import {
  useCashAttachments,
  useAddCashAttachment,
  useDeleteCashAttachment,
} from '../../hooks/useCajas'
import { useUndoableDelete } from '../../hooks/useUndoableDelete'
import type { CashAttachmentOwnerType } from '@shared/types'

function fmtSize(bytes: number): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function iconFor(mime: string): React.ElementType {
  if (mime.startsWith('image/')) return ImageIcon
  if (mime === 'application/pdf') return FileText
  return FileIcon
}

export default function CashAttachments({
  ownerType,
  ownerId,
}: {
  ownerType: CashAttachmentOwnerType
  ownerId: string
}) {
  const { data: items = [], isLoading } = useCashAttachments(ownerType, ownerId)
  const addMut = useAddCashAttachment()
  const delMut = useDeleteCashAttachment()

  const { deleteWithUndo, pendingIds } = useUndoableDelete(
    (id: string) => delMut.mutateAsync({ id, ownerType, ownerId }),
    { message: 'Comprobante eliminado' }
  )

  const handleAdd = () => addMut.mutate({ ownerType, ownerId })
  const visibleItems = items.filter(att => !pendingIds.has(att.id))

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {isLoading && (
          <span className="text-[11px] text-slate-500 inline-flex items-center gap-1">
            <Loader2 size={11} className="animate-spin" /> Cargando…
          </span>
        )}

        {!isLoading && visibleItems.length === 0 && (
          <span className="text-[11px] text-slate-600">Sin comprobantes</span>
        )}

        {visibleItems.map(att => {
          const Icon = iconFor(att.mime_type)
          return (
            <span
              key={att.id}
              className="group inline-flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-lg pl-2 pr-1 py-1 max-w-[220px]"
            >
              <button
                onClick={() => window.api.cajas.attachments.open(att.drive_file_id)}
                title={`Abrir ${att.original_name} en Google Drive`}
                className="inline-flex items-center gap-1.5 min-w-0 text-slate-300 hover:text-emerald-300 transition-colors"
              >
                <Icon size={12} className="shrink-0 text-slate-500" />
                <span className="truncate text-[11px]">{att.original_name}</span>
                {att.size_bytes > 0 && (
                  <span className="text-[10px] text-slate-600 shrink-0">{fmtSize(att.size_bytes)}</span>
                )}
              </button>
              <button
                onClick={() => deleteWithUndo(att.id)}
                title="Eliminar comprobante"
                className="shrink-0 text-slate-600 hover:text-red-400 transition-colors p-0.5"
              >
                <Trash2 size={11} />
              </button>
            </span>
          )
        })}

        <button
          onClick={handleAdd}
          disabled={addMut.isPending}
          className={cn(
            'inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-dashed border-slate-700 text-[11px] text-slate-400 hover:text-emerald-300 hover:border-emerald-700 transition-colors',
            addMut.isPending && 'opacity-50 cursor-wait'
          )}
        >
          {addMut.isPending
            ? <><Loader2 size={11} className="animate-spin" /> Subiendo…</>
            : <><Plus size={11} /> <Paperclip size={11} /> Adjuntar</>}
        </button>
      </div>

      {addMut.isError && (
        <p className="text-[11px] text-red-400">
          {addMut.error instanceof Error ? addMut.error.message : 'No se pudo adjuntar el comprobante.'}
        </p>
      )}
    </div>
  )
}
