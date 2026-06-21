import { useRef, useEffect } from 'react'
import { Bold, Italic, Underline, List, Link2 } from 'lucide-react'

interface Props {
  initialHtml: string
  onChange: (html: string) => void
}

export default function KnowledgeRichTextEditor({ initialHtml, onChange }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (ref.current) ref.current.innerHTML = initialHtml
  }, []) // mount only

  const exec = (cmd: string, val?: string) => {
    ref.current?.focus()
    document.execCommand(cmd, false, val)
    onChange(ref.current?.innerHTML ?? '')
  }

  const handlePaste = async (e: React.ClipboardEvent<HTMLDivElement>) => {
    for (const item of Array.from(e.clipboardData.items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (!file) continue
        const ab  = await file.arrayBuffer()
        const res = await window.api.knowledge.entries.saveClipboardImage(ab, file.type)
        document.execCommand('insertImage', false, `file://${res.localPath}`)
        onChange(ref.current?.innerHTML ?? '')
        return
      }
    }
  }

  const btn = 'p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors'

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center gap-0.5 px-3 py-2 border-b border-slate-700 shrink-0">
        <button className={btn} onClick={() => exec('bold')}><Bold size={13}/></button>
        <button className={btn} onClick={() => exec('italic')}><Italic size={13}/></button>
        <button className={btn} onClick={() => exec('underline')}><Underline size={13}/></button>
        <div className="w-px h-4 bg-slate-700 mx-1"/>
        <button className={btn} onClick={() => exec('insertUnorderedList')}><List size={13}/></button>
        <button className={btn} onClick={() => {
          const url = prompt('URL del enlace:')
          if (url) exec('createLink', url)
        }}><Link2 size={13}/></button>
        <span className="ml-auto text-[10px] text-slate-700">Ctrl+V para pegar imagen</span>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={() => onChange(ref.current?.innerHTML ?? '')}
        onPaste={handlePaste}
        className={[
          'flex-1 overflow-y-auto px-6 py-4 text-sm text-slate-200 leading-relaxed focus:outline-none',
          '[&_img]:max-w-full [&_img]:rounded-lg [&_img]:my-2',
          '[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5',
          '[&_a]:text-teal-400 [&_a]:underline',
          'empty:before:content-[attr(data-placeholder)] empty:before:text-slate-600'
        ].join(' ')}
        data-placeholder="Escribí o pegá contenido aquí..."
      />
    </div>
  )
}
