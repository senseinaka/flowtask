import { useMutation } from '@tanstack/react-query'
import type { PayrollExtractionResult } from '@shared/types'

export function useReadPayrollPdf() {
  return useMutation<PayrollExtractionResult, Error, string>({
    mutationFn: (filePath: string) => window.api.pdf.readPayroll(filePath),
  })
}
