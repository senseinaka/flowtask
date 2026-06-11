import { ipcMain } from 'electron'
import { createQuestion, listQuestionsByTask, deleteQuestion } from '../database/queries/task_questions'
import { getTask } from '../database/queries/tasks'
import { getDelegatedTask } from '../database/queries/delegated'
import { whatsappService } from '../services/whatsapp.service'
import { formatQuestionMessage } from '../services/questions.service'
import type { CreateTaskQuestionInput } from '@shared/types'

export function registerQuestionsIpc(): void {
  ipcMain.handle('questions:list', (_e, taskId: string) => {
    return listQuestionsByTask(taskId)
  })

  ipcMain.handle('questions:create', async (_e, input: CreateTaskQuestionInput) => {
    // 1. Create record in DB (gets ref_code assigned)
    const question = createQuestion(input)

    // 2. Get task title from the appropriate source
    let taskTitle = 'Sin título'
    if (input.task_type === 'delegated') {
      const delegated = getDelegatedTask(input.task_id)
      taskTitle = delegated?.title ?? 'Sin título'
    } else {
      const task = await getTask(input.task_id)
      taskTitle = task?.title ?? 'Sin título'
    }

    // 3. Format and send WhatsApp message
    const message = formatQuestionMessage(
      taskTitle,
      question.question,
      question.options,
      question.ref_code
    )

    const ok = await whatsappService.sendMessage(question.phone, message)
    if (!ok) {
      // Delete the question if sending failed so state stays consistent
      deleteQuestion(question.id)
      throw new Error('No se pudo enviar el mensaje por WhatsApp. Verificá que el bridge esté conectado.')
    }

    return question
  })

  ipcMain.handle('questions:delete', (_e, id: string) => {
    deleteQuestion(id)
  })
}
