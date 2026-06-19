import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type {
  AIOperation, ClaudeModelId, AIAnalysisResult, AIChatMessage,
  ComexImportTributo, CreateComexImportTributoInput,
  ComexImportExtraCost, CreateComexImportExtraCostInput,
  ComexProforma, CreateComexProformaInput,
  BackupStatus, LocalBackupStatus, LocalBackupEntry, RestoreResult,
  Task, Project, Attachment, Reminder, Contact, CreateContactInput,
  DelegatedTask, CreateDelegatedTaskInput,
  MessageTemplate, ScheduledMessage, CreateScheduledMessageInput,
  MessageStatus, MessageRecurrence,
  TaskQuestion, CreateTaskQuestionInput,
  TaskFilters, CreateTaskInput, CreateReminderInput,
  SyncResult, SyncStatus, PowerSyncStatusInfo, UpdateCheckResult, UpdateDownloadProgress,
  TaskStatusLogEntry, TaskType,
  ComexSupplier, ComexImport, ComexImportItem, ComexDocument, ComexInalCert,
  ComexLogisticsQuote, ComexQuoteFile, ComexPayment, ComexCustoms, ComexCostItem,
  ComexSupplierContact, ComexSupplierBankAccount, ComexFreightOperator,
  ComexFreightOperatorContact,
  ComexBrand, CreateComexBrandInput,
  ImportOrderPlanning, CreateImportOrderPlanningInput, ImportOrderPlanningMilestone,
  ImportOrderPlanningAIReport, PlanningAIReportType,
  CreateComexSupplierInput, CreateComexImportInput,
  CreateComexItemInput, CreateComexDocumentInput,
  CreateComexQuoteInput, CreateComexPaymentInput,
  UpsertComexCustomsInput, CreateComexCostInput,
  CreateComexSupplierContactInput, CreateComexSupplierBankAccountInput,
  CreateComexFreightOperatorInput, CreateComexFreightOperatorContactInput,
  ComexGestor, ComexGestorContact, CreateComexGestorInput, CreateComexGestorContactInput,
  ComexDespachante, ComexDespachanteContact, CreateComexDespachanteInput, CreateComexDespachanteContactInput,
  ExpiryCategory, ExpiryItem, ExpiryAlert, CreateExpiryItemInput, CreateExpiryAlertInput,
  PersonalContactInfo,
  FinanceAccount, FinanceCategory, FinancePaymentMethodEntity, FinanceConcept, FinanceMovement, FinanceMonthSummary,
  FinanceMonthInsight,
  FinanceMovementEntry,
  CreateFinanceAccountInput, CreateFinanceCategoryInput, CreateFinancePaymentMethodInput, CreateFinanceConceptInput, CreateFinanceMovementInput,
  CreateFinanceMovementEntryInput, UpdateFinanceMovementEntryInput,
  FinanceMovementStatus,
  FinanceCategoryBreakdownItem, FinanceHistoryEntry, FinanceRankingConcept, FinanceRankingIncrease,
  FinanceImportPreviewResult, FinanceImportConfirmItem, FinanceImportResult, FinanceSecurityStatus,
  AuthSession, AuthLoginResult,
  UserPermission,
  CalendarConnectionStatus, GoogleCalendarInfo, UnifiedCalendarEvent,
  CalendarEventInput, CalendarEventLink, LinkEntityInput, CalendarWaReminder,
  Quote, QuoteActivity, QuoteCompany, QuoteContact, QuoteKPIs,
  CreateQuoteInput, UpdateQuoteInput,
  CreateQuoteCompanyInput, CreateQuoteContactInput,
  AddQuoteActivityInput,
  EmailAccount, EmailMessage, EmailAttachment,
  CreateEmailAccountInput, SendEmailInput, EmailListFilters,
  ReconPeriod, ReconImport, ReconInvoice, ReconCupon, ReconMLOp, ReconResult, ReconKPIs,
  CreateReconPeriodInput, ReconImportSource, ReconPeriodStatus, ReconEstado
} from '@shared/types'
import type { PermissionLevel } from '@shared/modules'

const api = {
  tasks: {
    list: (filters?: TaskFilters): Promise<Task[]> =>
      ipcRenderer.invoke('tasks:list', filters),
    get: (id: string): Promise<Task | null> =>
      ipcRenderer.invoke('tasks:get', id),
    create: (data: CreateTaskInput): Promise<Task> =>
      ipcRenderer.invoke('tasks:create', data),
    update: (id: string, data: Partial<Task>): Promise<Task | null> =>
      ipcRenderer.invoke('tasks:update', id, data),
    delete: (id: string): Promise<void> =>
      ipcRenderer.invoke('tasks:delete', id),
    getDependencies: (taskId: string): Promise<Task[]> =>
      ipcRenderer.invoke('tasks:getDependencies', taskId),
    addDependency: (taskId: string, dependsOnId: string): Promise<void> =>
      ipcRenderer.invoke('tasks:addDependency', taskId, dependsOnId),
    removeDependency: (taskId: string, dependsOnId: string): Promise<void> =>
      ipcRenderer.invoke('tasks:removeDependency', taskId, dependsOnId),
    statusLog: (taskId: string, taskType: TaskType): Promise<TaskStatusLogEntry[]> =>
      ipcRenderer.invoke('tasks:statusLog', taskId, taskType)
  },

  projects: {
    list: (): Promise<Project[]> =>
      ipcRenderer.invoke('projects:list'),
    create: (name: string, color?: string): Promise<Project> =>
      ipcRenderer.invoke('projects:create', name, color),
    update: (id: string, data: Partial<Project>): Promise<Project | null> =>
      ipcRenderer.invoke('projects:update', id, data),
    delete: (id: string): Promise<void> =>
      ipcRenderer.invoke('projects:delete', id)
  },

  attachments: {
    list: (taskId: string): Promise<Attachment[]> =>
      ipcRenderer.invoke('attachments:list', taskId),
    add: (taskId: string, filePath: string): Promise<Attachment> =>
      ipcRenderer.invoke('attachments:add', taskId, filePath),
    delete: (id: string): Promise<void> =>
      ipcRenderer.invoke('attachments:delete', id),
    open: (id: string): Promise<void> =>
      ipcRenderer.invoke('attachments:open', id),
    selectFile: (): Promise<string | null> =>
      ipcRenderer.invoke('attachments:selectFile')
  },

  reminders: {
    list: (taskId: string): Promise<Reminder[]> =>
      ipcRenderer.invoke('reminders:list', taskId),
    create: (data: CreateReminderInput): Promise<Reminder> =>
      ipcRenderer.invoke('reminders:create', data),
    delete: (id: string): Promise<void> =>
      ipcRenderer.invoke('reminders:delete', id)
  },

  sync: {
    trigger: (): Promise<SyncResult> =>
      ipcRenderer.invoke('sync:trigger'),
    getStatus: (): Promise<SyncStatus> =>
      ipcRenderer.invoke('sync:getStatus'),
    isAuthenticated: (): Promise<boolean> =>
      ipcRenderer.invoke('sync:isAuthenticated'),
    startOAuth: (): Promise<void> =>
      ipcRenderer.invoke('sync:startOAuth'),
    saveGoogleCredentials: (clientId: string, clientSecret: string): Promise<void> =>
      ipcRenderer.invoke('sync:saveGoogleCredentials', clientId, clientSecret),
    getGoogleCredentials: (): Promise<{ clientId: string; clientSecret: string }> =>
      ipcRenderer.invoke('sync:getGoogleCredentials'),
    testDriveConnection: (): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke('sync:testDriveConnection'),
    disconnectDrive: (): Promise<void> =>
      ipcRenderer.invoke('sync:disconnectDrive'),
    getWhatsappQR: (): Promise<string | null> =>
      ipcRenderer.invoke('sync:getWhatsappQR'),
    connectWhatsapp: (): Promise<{ qr?: string; connected?: boolean }> =>
      ipcRenderer.invoke('sync:connectWhatsapp'),
    getWhatsappConfig: (): Promise<{ url: string; key: string }> =>
      ipcRenderer.invoke('sync:getWhatsappConfig'),
    saveWhatsappConfig: (url: string, key: string): Promise<void> =>
      ipcRenderer.invoke('sync:saveWhatsappConfig', url, key)
  },

  delegated: {
    list: (): Promise<DelegatedTask[]> =>
      ipcRenderer.invoke('delegated:list'),
    create: (input: CreateDelegatedTaskInput): Promise<DelegatedTask> =>
      ipcRenderer.invoke('delegated:create', input),
    update: (id: string, data: Partial<DelegatedTask>): Promise<DelegatedTask | null> =>
      ipcRenderer.invoke('delegated:update', id, data),
    delete: (id: string): Promise<void> =>
      ipcRenderer.invoke('delegated:delete', id),
    remind: (phone: string, taskTitle: string, contactName: string): Promise<boolean> =>
      ipcRenderer.invoke('delegated:remind', phone, taskTitle, contactName)
  },

  contacts: {
    list: (): Promise<Contact[]> =>
      ipcRenderer.invoke('contacts:list'),
    get: (id: string): Promise<Contact | null> =>
      ipcRenderer.invoke('contacts:get', id),
    create: (input: CreateContactInput): Promise<Contact> =>
      ipcRenderer.invoke('contacts:create', input),
    update: (id: string, data: Partial<Contact>): Promise<Contact | null> =>
      ipcRenderer.invoke('contacts:update', id, data),
    delete: (id: string): Promise<void> =>
      ipcRenderer.invoke('contacts:delete', id)
  },

  messages: {
    listTemplates: (): Promise<MessageTemplate[]> =>
      ipcRenderer.invoke('messages:listTemplates'),
    createTemplate: (name: string, body: string): Promise<MessageTemplate> =>
      ipcRenderer.invoke('messages:createTemplate', name, body),
    updateTemplate: (id: string, name: string, body: string): Promise<MessageTemplate | null> =>
      ipcRenderer.invoke('messages:updateTemplate', id, name, body),
    deleteTemplate: (id: string): Promise<void> =>
      ipcRenderer.invoke('messages:deleteTemplate', id),

    list: (status?: MessageStatus | MessageStatus[]): Promise<ScheduledMessage[]> =>
      ipcRenderer.invoke('messages:list', status),
    create: (input: CreateScheduledMessageInput): Promise<ScheduledMessage> =>
      ipcRenderer.invoke('messages:create', input),
    update: (id: string, data: { message?: string; send_at?: number; recurrence?: MessageRecurrence; contact_ids?: string[] }): Promise<void> =>
      ipcRenderer.invoke('messages:update', id, data),
    delete: (id: string): Promise<void> =>
      ipcRenderer.invoke('messages:delete', id),
    retry: (id: string): Promise<void> =>
      ipcRenderer.invoke('messages:retry', id)
  },

  questions: {
    list: (taskId: string): Promise<TaskQuestion[]> =>
      ipcRenderer.invoke('questions:list', taskId),
    create: (input: CreateTaskQuestionInput): Promise<TaskQuestion> =>
      ipcRenderer.invoke('questions:create', input),
    delete: (id: string): Promise<void> =>
      ipcRenderer.invoke('questions:delete', id)
  },

  comex: {
    logo: {
      selectFile: ():                                   Promise<string | null> => ipcRenderer.invoke('comex:logo:selectFile'),
      getDataUrl: (storedName: string | null, logoData?: string | null): Promise<string | null> => ipcRenderer.invoke('comex:logo:getDataUrl', storedName, logoData)
    },
    suppliers: {
      list:        ():                                          Promise<ComexSupplier[]>      => ipcRenderer.invoke('comex:suppliers:list'),
      get:         (id: string):                                Promise<ComexSupplier | null> => ipcRenderer.invoke('comex:suppliers:get', id),
      create:      (input: CreateComexSupplierInput):           Promise<ComexSupplier>        => ipcRenderer.invoke('comex:suppliers:create', input),
      update:      (id: string, data: Partial<ComexSupplier>): Promise<ComexSupplier | null> => ipcRenderer.invoke('comex:suppliers:update', id, data),
      delete:      (id: string):                                Promise<void>                 => ipcRenderer.invoke('comex:suppliers:delete', id),
      uploadLogo:  (id: string, filePath: string):              Promise<string>               => ipcRenderer.invoke('comex:suppliers:uploadLogo', id, filePath),
      deleteLogo:  (id: string):                                Promise<void>                 => ipcRenderer.invoke('comex:suppliers:deleteLogo', id)
    },
    brands: {
      list:   ():                                       Promise<ComexBrand[]>      => ipcRenderer.invoke('comex:brands:list'),
      get:    (id: string):                             Promise<ComexBrand | null> => ipcRenderer.invoke('comex:brands:get', id),
      create: (input: CreateComexBrandInput):           Promise<ComexBrand>        => ipcRenderer.invoke('comex:brands:create', input),
      update: (id: string, data: Partial<ComexBrand>): Promise<ComexBrand | null> => ipcRenderer.invoke('comex:brands:update', id, data),
      delete: (id: string):                             Promise<void>              => ipcRenderer.invoke('comex:brands:delete', id)
    },
    plannings: {
      list:        (filters?: { brandId?: string; status?: string }): Promise<ImportOrderPlanning[]>      => ipcRenderer.invoke('comex:plannings:list', filters),
      get:         (id: string):                                       Promise<ImportOrderPlanning | null> => ipcRenderer.invoke('comex:plannings:get', id),
      create:      (input: CreateImportOrderPlanningInput):            Promise<ImportOrderPlanning>        => ipcRenderer.invoke('comex:plannings:create', input),
      update:      (id: string, data: Partial<ImportOrderPlanning>):   Promise<ImportOrderPlanning | null> => ipcRenderer.invoke('comex:plannings:update', id, data),
      delete:      (id: string):                                       Promise<void>                       => ipcRenderer.invoke('comex:plannings:delete', id),
      recalculate: (id: string):                                       Promise<ImportOrderPlanning | null> => ipcRenderer.invoke('comex:plannings:recalculate', id),
      export:      (plannings: ImportOrderPlanning[]):                 Promise<{ filePath: string } | null> => ipcRenderer.invoke('comex:plannings:export', plannings),
      ai: {
        recommend: (planningId: string): Promise<ImportOrderPlanning | null> => ipcRenderer.invoke('comex:plannings:ai:recommend', planningId)
      }
    },
    planningMilestones: {
      update: (id: string, data: Partial<ImportOrderPlanningMilestone>): Promise<ImportOrderPlanningMilestone | null> => ipcRenderer.invoke('comex:planningMilestones:update', id, data)
    },
    planningAIReports: {
      list: (filters?: { reportType?: PlanningAIReportType; brandId?: string; supplierId?: string }): Promise<ImportOrderPlanningAIReport[]> =>
        ipcRenderer.invoke('comex:planningAIReports:list', filters),
      generate: (input: { reportType: PlanningAIReportType; brandId?: string | null; supplierId?: string | null; periodStartDate?: number | null; periodEndDate?: number | null }): Promise<ImportOrderPlanningAIReport> =>
        ipcRenderer.invoke('comex:planningAIReports:generate', input),
      delete: (id: string): Promise<void> => ipcRenderer.invoke('comex:planningAIReports:delete', id),
      export: (reports: ImportOrderPlanningAIReport[]): Promise<{ filePath: string } | null> =>
        ipcRenderer.invoke('comex:planningAIReports:export', reports)
    },
    supplierContacts: {
      list:   (supplierId: string):                                      Promise<ComexSupplierContact[]> => ipcRenderer.invoke('comex:supplier-contacts:list', supplierId),
      create: (input: CreateComexSupplierContactInput):                  Promise<ComexSupplierContact>   => ipcRenderer.invoke('comex:supplier-contacts:create', input),
      update: (id: string, data: Partial<ComexSupplierContact>):        Promise<void>                   => ipcRenderer.invoke('comex:supplier-contacts:update', id, data),
      delete: (id: string):                                              Promise<void>                   => ipcRenderer.invoke('comex:supplier-contacts:delete', id)
    },
    supplierBanks: {
      list:   (supplierId: string):                                      Promise<ComexSupplierBankAccount[]> => ipcRenderer.invoke('comex:supplier-banks:list', supplierId),
      create: (input: CreateComexSupplierBankAccountInput):              Promise<ComexSupplierBankAccount>   => ipcRenderer.invoke('comex:supplier-banks:create', input),
      update: (id: string, data: Partial<ComexSupplierBankAccount>):    Promise<void>                       => ipcRenderer.invoke('comex:supplier-banks:update', id, data),
      delete: (id: string):                                              Promise<void>                       => ipcRenderer.invoke('comex:supplier-banks:delete', id)
    },
    imports: {
      list:   (status?: string):                        Promise<ComexImport[]>        => ipcRenderer.invoke('comex:imports:list', status),
      get:    (id: string):                             Promise<ComexImport | null>   => ipcRenderer.invoke('comex:imports:get', id),
      create: (input: CreateComexImportInput):          Promise<ComexImport>          => ipcRenderer.invoke('comex:imports:create', input),
      update: (id: string, data: Partial<ComexImport>): Promise<ComexImport | null>  => ipcRenderer.invoke('comex:imports:update', id, data),
      delete: (id: string):                             Promise<void>                 => ipcRenderer.invoke('comex:imports:delete', id),
      exportXlsx: (id: string): Promise<{ filePath: string } | null> => ipcRenderer.invoke('comex:imports:exportXlsx', id),
      exportPdf:  (id: string): Promise<{ filePath: string } | null> => ipcRenderer.invoke('comex:imports:exportPdf', id)
    },
    items: {
      list:   (importId: string):                       Promise<ComexImportItem[]>    => ipcRenderer.invoke('comex:items:list', importId),
      create: (input: CreateComexItemInput):            Promise<ComexImportItem>      => ipcRenderer.invoke('comex:items:create', input),
      delete: (id: string):                             Promise<void>                 => ipcRenderer.invoke('comex:items:delete', id)
    },
    documents: {
      list:       (importId: string):                                                                    Promise<ComexDocument[]>      => ipcRenderer.invoke('comex:documents:list', importId),
      create:     (input: CreateComexDocumentInput):                                                     Promise<ComexDocument>        => ipcRenderer.invoke('comex:documents:create', input),
      update:     (id: string, data: Partial<ComexDocument>):                                            Promise<void>                 => ipcRenderer.invoke('comex:documents:update', id, data),
      delete:     (id: string):                                                                          Promise<void>                 => ipcRenderer.invoke('comex:documents:delete', id),
      selectFile: ():                                                                                    Promise<string | null>        => ipcRenderer.invoke('comex:documents:selectFile'),
      open:       (id: string):                                                                          Promise<void>                 => ipcRenderer.invoke('comex:documents:open', id),
      upload:     (docId: string, filePath: string, importId: string, folderId: string | null, importTitle: string): Promise<ComexDocument> =>
        ipcRenderer.invoke('comex:documents:upload', docId, filePath, importId, folderId, importTitle),
      uploadNew:  (filePath: string, importId: string, folderId: string | null, importTitle: string):   Promise<ComexDocument>        =>
        ipcRenderer.invoke('comex:documents:uploadNew', filePath, importId, folderId, importTitle)
    },
    quotes: {
      list:   (importId: string):                       Promise<ComexLogisticsQuote[]> => ipcRenderer.invoke('comex:quotes:list', importId),
      create: (input: CreateComexQuoteInput):           Promise<ComexLogisticsQuote>   => ipcRenderer.invoke('comex:quotes:create', input),
      update: (id: string, data: Partial<ComexLogisticsQuote>): Promise<void>         => ipcRenderer.invoke('comex:quotes:update', id, data),
      delete: (id: string):                             Promise<void>                  => ipcRenderer.invoke('comex:quotes:delete', id),
      files: {
        list:   (quoteId: string):                                              Promise<ComexQuoteFile[]>      => ipcRenderer.invoke('comex:quote-files:list', quoteId),
        upload: (params: { quoteId: string; importId: string; importTitle: string; importFolderId: string | null; filePath?: string; fileBuffer?: ArrayBuffer; fileName?: string }): Promise<ComexQuoteFile | null> => ipcRenderer.invoke('comex:quote-files:upload', params),
        delete: (fileId: string, driveFileId: string):                          Promise<void>                  => ipcRenderer.invoke('comex:quote-files:delete', { fileId, driveFileId }),
        open:   (driveFileId: string):                                          Promise<void>                  => ipcRenderer.invoke('comex:quote-files:open', driveFileId),
      }
    },
    payments: {
      list:   (importId: string):                       Promise<ComexPayment[]>       => ipcRenderer.invoke('comex:payments:list', importId),
      create: (input: CreateComexPaymentInput):         Promise<ComexPayment>         => ipcRenderer.invoke('comex:payments:create', input),
      update: (id: string, data: Partial<ComexPayment>): Promise<void>               => ipcRenderer.invoke('comex:payments:update', id, data),
      delete: (id: string):                             Promise<void>                 => ipcRenderer.invoke('comex:payments:delete', id)
    },
    customs: {
      get:    (importId: string):                                           Promise<ComexCustoms | null> =>
        ipcRenderer.invoke('comex:customs:get', importId),
      upsert: (importId: string, data: Partial<UpsertComexCustomsInput>):  Promise<ComexCustoms> =>
        ipcRenderer.invoke('comex:customs:upsert', importId, data)
    },
    costs: {
      list:   (importId: string):                                 Promise<ComexCostItem[]>  =>
        ipcRenderer.invoke('comex:costs:list', importId),
      create: (input: CreateComexCostInput):                      Promise<ComexCostItem>    =>
        ipcRenderer.invoke('comex:costs:create', input),
      update: (id: string, data: Partial<ComexCostItem>):        Promise<void>             =>
        ipcRenderer.invoke('comex:costs:update', id, data),
      delete: (id: string):                                       Promise<void>             =>
        ipcRenderer.invoke('comex:costs:delete', id)
    },
    drive: {
      createFolder:    (importId: string, importTitle: string): Promise<{ folderId: string; url: string }> =>
        ipcRenderer.invoke('comex:drive:createFolder', importId, importTitle),
      openFolder:      (folderId: string): Promise<void> =>
        ipcRenderer.invoke('comex:drive:openFolder', folderId),
      isAuthenticated: (): Promise<boolean> =>
        ipcRenderer.invoke('comex:drive:isAuthenticated')
    },
    operators: {
      list:       ():                                                     Promise<ComexFreightOperator[]>      => ipcRenderer.invoke('comex:operators:list'),
      get:        (id: string):                                           Promise<ComexFreightOperator | null> => ipcRenderer.invoke('comex:operators:get', id),
      create:     (input: CreateComexFreightOperatorInput):               Promise<ComexFreightOperator>        => ipcRenderer.invoke('comex:operators:create', input),
      update:     (id: string, data: Partial<ComexFreightOperator>):     Promise<ComexFreightOperator | null> => ipcRenderer.invoke('comex:operators:update', id, data),
      delete:     (id: string):                                           Promise<void>                        => ipcRenderer.invoke('comex:operators:delete', id),
      uploadLogo: (id: string, filePath: string):                         Promise<string>                      => ipcRenderer.invoke('comex:operators:uploadLogo', id, filePath),
      deleteLogo: (id: string):                                           Promise<void>                        => ipcRenderer.invoke('comex:operators:deleteLogo', id)
    },
    operatorContacts: {
      list:   (operatorId: string):                                          Promise<ComexFreightOperatorContact[]> => ipcRenderer.invoke('comex:operator-contacts:list', operatorId),
      create: (input: CreateComexFreightOperatorContactInput):               Promise<ComexFreightOperatorContact>   => ipcRenderer.invoke('comex:operator-contacts:create', input),
      update: (id: string, data: Partial<ComexFreightOperatorContact>):     Promise<void>                          => ipcRenderer.invoke('comex:operator-contacts:update', id, data),
      delete: (id: string):                                                  Promise<void>                          => ipcRenderer.invoke('comex:operator-contacts:delete', id)
    },
    gestores: {
      list:       ():                                               Promise<ComexGestor[]>        => ipcRenderer.invoke('comex:gestores:list'),
      get:        (id: string):                                     Promise<ComexGestor | null>   => ipcRenderer.invoke('comex:gestores:get', id),
      create:     (input: CreateComexGestorInput):                  Promise<ComexGestor>          => ipcRenderer.invoke('comex:gestores:create', input),
      update:     (id: string, data: Partial<ComexGestor>):        Promise<ComexGestor | null>   => ipcRenderer.invoke('comex:gestores:update', id, data),
      delete:     (id: string):                                     Promise<void>                 => ipcRenderer.invoke('comex:gestores:delete', id),
      uploadLogo: (id: string, filePath: string):                   Promise<string>               => ipcRenderer.invoke('comex:gestores:uploadLogo', id, filePath),
      deleteLogo: (id: string):                                     Promise<void>                 => ipcRenderer.invoke('comex:gestores:deleteLogo', id),
      contacts: {
        create: (input: CreateComexGestorContactInput):             Promise<ComexGestorContact>   => ipcRenderer.invoke('comex:gestores:contacts:create', input),
        update: (id: string, data: Partial<ComexGestorContact>):   Promise<void>                 => ipcRenderer.invoke('comex:gestores:contacts:update', id, data),
        delete: (id: string):                                       Promise<void>                 => ipcRenderer.invoke('comex:gestores:contacts:delete', id),
      }
    },
    despachantes: {
      list:       ():                                               Promise<ComexDespachante[]>         => ipcRenderer.invoke('comex:despachantes:list'),
      create:     (input: CreateComexDespachanteInput):             Promise<ComexDespachante>           => ipcRenderer.invoke('comex:despachantes:create', input),
      update:     (id: string, data: Partial<ComexDespachante>):   Promise<ComexDespachante | null>    => ipcRenderer.invoke('comex:despachantes:update', id, data),
      delete:     (id: string):                                     Promise<void>                       => ipcRenderer.invoke('comex:despachantes:delete', id),
      uploadLogo: (id: string, filePath: string):                   Promise<string>                     => ipcRenderer.invoke('comex:despachantes:uploadLogo', id, filePath),
      deleteLogo: (id: string):                                     Promise<void>                       => ipcRenderer.invoke('comex:despachantes:deleteLogo', id),
      contacts: {
        create: (input: CreateComexDespachanteContactInput):                      Promise<ComexDespachanteContact> => ipcRenderer.invoke('comex:despachantes:contacts:create', input),
        update: (id: string, data: Partial<ComexDespachanteContact>):             Promise<void>                    => ipcRenderer.invoke('comex:despachantes:contacts:update', id, data),
        delete: (id: string):                                                     Promise<void>                    => ipcRenderer.invoke('comex:despachantes:contacts:delete', id),
      }
    },
    proformas: {
      list:       (importId: string, tipo?: 'proforma' | 'factura'):     Promise<ComexProforma[]>   => ipcRenderer.invoke('comex:proformas:list', importId, tipo),
      renameDriveFolder: (proformaId: string):                           Promise<void>              => ipcRenderer.invoke('comex:proformas:renameDriveFolder', proformaId),
      create:     (input: CreateComexProformaInput):                     Promise<ComexProforma>     => ipcRenderer.invoke('comex:proformas:create', input),
      update:     (id: string, data: Partial<ComexProforma>):            Promise<void>              => ipcRenderer.invoke('comex:proformas:update', id, data),
      delete:     (id: string):                                          Promise<void>              => ipcRenderer.invoke('comex:proformas:delete', id),
      selectFile: ():                                                    Promise<string | null>     => ipcRenderer.invoke('comex:proformas:selectFile'),
      upload:     (proformaId: string, filePath: string):               Promise<ComexProforma>     => ipcRenderer.invoke('comex:proformas:upload', proformaId, filePath),
      open:       (proformaId: string):                                  Promise<void>              => ipcRenderer.invoke('comex:proformas:open', proformaId),
      syncDrive:  (proformaId: string):                                  Promise<ComexProforma>     => ipcRenderer.invoke('comex:proformas:syncDrive', proformaId)
    },
    extraCosts: {
      list:          (importId: string):                                           Promise<ComexImportExtraCost[]> => ipcRenderer.invoke('comex:extra-costs:list', importId),
      create:        (input: CreateComexImportExtraCostInput):                     Promise<ComexImportExtraCost>   => ipcRenderer.invoke('comex:extra-costs:create', input),
      update:        (id: string, data: Partial<ComexImportExtraCost>):            Promise<void>                  => ipcRenderer.invoke('comex:extra-costs:update', id, data),
      delete:        (id: string):                                                 Promise<void>                  => ipcRenderer.invoke('comex:extra-costs:delete', id),
      selectFile:    ():                                                           Promise<string | null>         => ipcRenderer.invoke('comex:extra-costs:selectFile'),
      uploadInvoice: (costId: string, filePath: string):                          Promise<ComexImportExtraCost>   => ipcRenderer.invoke('comex:extra-costs:uploadInvoice', costId, filePath),
      openFile:      (costId: string):                                             Promise<void>                  => ipcRenderer.invoke('comex:extra-costs:openFile', costId)
    },
    tributos: {
      list:   (importId: string):                                                                          Promise<ComexImportTributo[]> => ipcRenderer.invoke('comex:tributos:list', importId),
      create: (input: CreateComexImportTributoInput):                                                      Promise<ComexImportTributo>   => ipcRenderer.invoke('comex:tributos:create', input),
      update: (id: string, data: Partial<ComexImportTributo>):                                             Promise<void>                 => ipcRenderer.invoke('comex:tributos:update', id, data),
      delete: (id: string):                                                                                Promise<void>                 => ipcRenderer.invoke('comex:tributos:delete', id),
      upsert: (importId: string, tributos: Omit<CreateComexImportTributoInput, 'import_id'>[]):            Promise<ComexImportTributo[]> => ipcRenderer.invoke('comex:tributos:upsert', importId, tributos)
    },
    despacho: {
      selectFile: ():                               Promise<string | null>  => ipcRenderer.invoke('comex:despacho:selectFile'),
      upload:     (importId: string, filePath: string): Promise<ComexImport>  => ipcRenderer.invoke('comex:despacho:upload', importId, filePath),
      open:       (importId: string):               Promise<void>           => ipcRenderer.invoke('comex:despacho:open', importId),
      delete:     (importId: string):               Promise<ComexImport>    => ipcRenderer.invoke('comex:despacho:delete', importId)
    },
    pl: {
      selectFile: ():                                   Promise<string | null>  => ipcRenderer.invoke('comex:pl:selectFile'),
      upload:     (importId: string, filePath: string): Promise<ComexImport>    => ipcRenderer.invoke('comex:pl:upload', importId, filePath),
      open:       (importId: string):                   Promise<void>           => ipcRenderer.invoke('comex:pl:open', importId),
      delete:     (importId: string):                   Promise<ComexImport>    => ipcRenderer.invoke('comex:pl:delete', importId)
    },
    bl: {
      selectFile: ():                               Promise<string | null>  => ipcRenderer.invoke('comex:bl:selectFile'),
      upload:     (importId: string, filePath: string): Promise<ComexImport>  => ipcRenderer.invoke('comex:bl:upload', importId, filePath),
      open:       (importId: string):               Promise<void>           => ipcRenderer.invoke('comex:bl:open', importId),
      delete:     (importId: string):               Promise<ComexImport>    => ipcRenderer.invoke('comex:bl:delete', importId)
    },
    inal: {
      certs: {
        list:        (importId: string):                                                                                                                              Promise<ComexInalCert[]>                             => ipcRenderer.invoke('comex:inal:certs:list', importId),
        delete:      (id: string):                                                                                                                                    Promise<void>                                        => ipcRenderer.invoke('comex:inal:certs:delete', id),
        upload:      (filePath: string, importId: string, importTitle: string, importFolderId: string | null, certFolderId: string | null): Promise<{ cert: ComexInalCert; import: ComexImport }> =>
          ipcRenderer.invoke('comex:inal:certs:upload', filePath, importId, importTitle, importFolderId, certFolderId),
        selectFiles: (): Promise<string[]> => ipcRenderer.invoke('comex:inal:certs:selectFiles'),
      },
      pl: {
        selectFile: ():                                Promise<string | null> => ipcRenderer.invoke('comex:inal:pl:selectFile'),
        upload:     (importId: string, filePath: string): Promise<ComexImport> => ipcRenderer.invoke('comex:inal:pl:upload', importId, filePath),
        open:       (importId: string):               Promise<void>          => ipcRenderer.invoke('comex:inal:pl:open', importId),
        delete:     (importId: string):               Promise<ComexImport>   => ipcRenderer.invoke('comex:inal:pl:delete', importId),
      },
      xls: {
        selectFile: ():                                Promise<string | null> => ipcRenderer.invoke('comex:inal:xls:selectFile'),
        upload:     (importId: string, filePath: string): Promise<ComexImport> => ipcRenderer.invoke('comex:inal:xls:upload', importId, filePath),
        open:       (importId: string):               Promise<void>          => ipcRenderer.invoke('comex:inal:xls:open', importId),
        delete:     (importId: string):               Promise<ComexImport>   => ipcRenderer.invoke('comex:inal:xls:delete', importId),
      },
      factura: {
        selectFile: ():                                Promise<string | null> => ipcRenderer.invoke('comex:inal:factura:selectFile'),
        upload:     (importId: string, filePath: string): Promise<ComexImport> => ipcRenderer.invoke('comex:inal:factura:upload', importId, filePath),
        open:       (importId: string):               Promise<void>          => ipcRenderer.invoke('comex:inal:factura:open', importId),
        delete:     (importId: string):               Promise<ComexImport>   => ipcRenderer.invoke('comex:inal:factura:delete', importId),
      },
      blcopy: {
        selectFile: ():                                Promise<string | null> => ipcRenderer.invoke('comex:inal:blcopy:selectFile'),
        upload:     (importId: string, filePath: string): Promise<ComexImport> => ipcRenderer.invoke('comex:inal:blcopy:upload', importId, filePath),
        open:       (importId: string):               Promise<void>          => ipcRenderer.invoke('comex:inal:blcopy:open', importId),
        delete:     (importId: string):               Promise<ComexImport>   => ipcRenderer.invoke('comex:inal:blcopy:delete', importId),
      }
    }
  },

  delegatedReminders: {
    list:   (taskId: string):                     Promise<Reminder[]>  => ipcRenderer.invoke('delegated-reminders:list', taskId),
    create: (data: CreateReminderInput):           Promise<Reminder>    => ipcRenderer.invoke('delegated-reminders:create', data),
    delete: (id: string):                          Promise<void>        => ipcRenderer.invoke('delegated-reminders:delete', id)
  },

  delegatedAttachments: {
    list:       (taskId: string):                  Promise<Attachment[]> => ipcRenderer.invoke('delegated-attachments:list', taskId),
    add:        (taskId: string, filePath: string):Promise<Attachment>   => ipcRenderer.invoke('delegated-attachments:add', taskId, filePath),
    delete:     (id: string):                      Promise<void>         => ipcRenderer.invoke('delegated-attachments:delete', id),
    open:       (id: string):                      Promise<void>         => ipcRenderer.invoke('delegated-attachments:open', id),
    selectFile: ():                                Promise<string | null>=> ipcRenderer.invoke('delegated-attachments:selectFile')
  },

  chat: {
    send:    (message: string, sessionId?: string): Promise<{ success: boolean; text?: string; error?: string }> =>
      ipcRenderer.invoke('chat:send', message, sessionId),
    history: (sessionId?: string): Promise<AIChatMessage[]> =>
      ipcRenderer.invoke('chat:history', sessionId),
    stats:   (sessionId?: string): Promise<{ total: number; hasCompacted: boolean; oldestAt: number | null }> =>
      ipcRenderer.invoke('chat:stats', sessionId),
    clear:   (sessionId?: string): Promise<void> =>
      ipcRenderer.invoke('chat:clear', sessionId),
    triggerProactive: (): Promise<unknown[]> =>
      ipcRenderer.invoke('chat:triggerProactive')
  },

  backup: {
    runNow:   (): Promise<BackupStatus>        => ipcRenderer.invoke('backup:runNow'),
    getStatus:(): Promise<BackupStatus | null> => ipcRenderer.invoke('backup:getStatus'),
    isReady:  (): Promise<boolean>             => ipcRenderer.invoke('backup:isReady'),

    // Backup local — copia DB + adjuntos a una carpeta del disco, sin
    // depender de ninguna cuenta. Corre siempre, conectado o no a Drive.
    local: {
      runNow:    (): Promise<LocalBackupStatus>        => ipcRenderer.invoke('backup:local:runNow'),
      getStatus: (): Promise<LocalBackupStatus | null> => ipcRenderer.invoke('backup:local:getStatus'),
      getDir:    (): Promise<string>                   => ipcRenderer.invoke('backup:local:getDir'),
      chooseDir: (): Promise<string | null>            => ipcRenderer.invoke('backup:local:chooseDir'),
      openDir:   (): Promise<void>                     => ipcRenderer.invoke('backup:local:openDir'),
      // Frecuencia del backup automático (en horas; 0 = solo manual)
      getInterval: (): Promise<number>                  => ipcRenderer.invoke('backup:local:getInterval'),
      setInterval: (hours: number): Promise<void>       => ipcRenderer.invoke('backup:local:setInterval', hours),
      // Restaurar una copia anterior — la app se reinicia sola si sale bien
      list:    (): Promise<LocalBackupEntry[]>          => ipcRenderer.invoke('backup:local:list'),
      restore: (folder: string): Promise<RestoreResult> => ipcRenderer.invoke('backup:local:restore', folder)
    }
  },

  bna: {
    getEurArs: (dateStr: string): Promise<{ eurArs: number; fechaBNA: string; esFechaExacta: boolean } | null> =>
      ipcRenderer.invoke('bna:getEurArs', dateStr)
  },

  shell: {
    open: (url: string): Promise<void> => ipcRenderer.invoke('shell:open', url)
  },

  // Electron 32+: file.path is no longer available in renderer.
  // Use this instead to get the FS path of a File from a drag/drop event.
  getPathForFile: (file: File): string => webUtils.getPathForFile(file),

  whatsapp: {
    send:         (phone: string, message: string): Promise<boolean> =>
      ipcRenderer.invoke('whatsapp:send', phone, message),
    testSend:     (phone: string, message: string): Promise<{ ok: boolean; status?: number; body?: unknown; error?: string }> =>
      ipcRenderer.invoke('whatsapp:testSend', phone, message),
    sendToGroup:  (jid: string, message: string): Promise<boolean> =>
      ipcRenderer.invoke('whatsapp:sendToGroup', jid, message),
    fetchGroups:  (): Promise<Array<{ jid: string; name: string; size: number }>> =>
      ipcRenderer.invoke('whatsapp:fetchGroups'),
    groups: {
      list:   ():                                                      Promise<Array<{ id: string; name: string; jid: string; description: string }>> =>
        ipcRenderer.invoke('whatsapp:groups:list'),
      save:   (jid: string, name: string, description?: string):      Promise<{ id: string; name: string; jid: string }> =>
        ipcRenderer.invoke('whatsapp:groups:save', jid, name, description ?? ''),
      delete: (id: string):                                            Promise<void> =>
        ipcRenderer.invoke('whatsapp:groups:delete', id),
    },
    template: {
      get:  (key: string):                  Promise<{ key: string; name: string; body: string } | null> =>
        ipcRenderer.invoke('whatsapp:template:get', key),
      save: (key: string, body: string):   Promise<void> =>
        ipcRenderer.invoke('whatsapp:template:save', key, body),
    }
  },

  ai: {
    isConfigured:    ():                                                                             Promise<boolean>        => ipcRenderer.invoke('ai:isConfigured'),
    getModels:       ():                                                                             Promise<Record<AIOperation, ClaudeModelId>> => ipcRenderer.invoke('ai:getModels'),
    saveApiKey:      (apiKey: string):                                                               Promise<void>           => ipcRenderer.invoke('ai:saveApiKey', apiKey),
    saveModels:      (models: Record<AIOperation, ClaudeModelId>):                                   Promise<void>           => ipcRenderer.invoke('ai:saveModels', models),
    analyzeDocument:      (params: { filePath: string; operation: AIOperation; extraContext?: string }):    Promise<AIAnalysisResult> => ipcRenderer.invoke('ai:analyzeDocument', params),
    analyzeComexDocument: (params: { docId: string; operationOverride?: AIOperation }): Promise<AIAnalysisResult> => ipcRenderer.invoke('ai:analyzeComexDocument', params),
    analyzeDespacho:      (importId: string, page?: number):                            Promise<AIAnalysisResult> => ipcRenderer.invoke('ai:analyzeDespacho', importId, page ?? 1),
    analyzeBL:            (importId: string):                                            Promise<AIAnalysisResult> => ipcRenderer.invoke('ai:analyzeBL', importId),
    analyzePL:            (importId: string):                                            Promise<AIAnalysisResult> => ipcRenderer.invoke('ai:analyzePL', importId),
    analyzeProforma:      (proformaId: string):                                         Promise<AIAnalysisResult> => ipcRenderer.invoke('ai:analyzeProforma', proformaId),
    analyzeExtraCost:     (costId: string):                                             Promise<AIAnalysisResult> => ipcRenderer.invoke('ai:analyzeExtraCost', costId),
    dashboardChat:   (params: { contextData: unknown; messages: Array<{ role: 'user' | 'assistant'; content: string }> }): Promise<{ content: string; tokens_used: number }> =>
      ipcRenderer.invoke('ai:dashboardChat', params),
    prompts: {
      list:           (): Promise<Array<{ operation: string; label: string; description: string; hasOverride: boolean; notes: string; updated_at: number | null }>> =>
        ipcRenderer.invoke('ai:prompts:list'),
      get:            (operation: string): Promise<{ operation: string; effectivePrompt: string; defaultPrompt: string; override: { system_prompt: string; notes: string; updated_at: number } | null }> =>
        ipcRenderer.invoke('ai:prompts:get', operation),
      save:           (operation: string, systemPrompt: string, notes: string): Promise<{ ok: boolean }> =>
        ipcRenderer.invoke('ai:prompts:save', operation, systemPrompt, notes),
      reset:          (operation: string): Promise<{ ok: boolean }> =>
        ipcRenderer.invoke('ai:prompts:reset', operation),
      test:           (operation: string, systemPromptOverride: string, filePath: string): Promise<{ ok: boolean; result?: unknown; error?: string }> =>
        ipcRenderer.invoke('ai:prompts:test', operation, systemPromptOverride, filePath),
      selectTestFile: (): Promise<string | null> =>
        ipcRenderer.invoke('ai:prompts:selectTestFile'),
      writeToCode:    (operation: string, newPrompt: string): Promise<{ ok: boolean; message?: string; filePath?: string; error?: string }> =>
        ipcRenderer.invoke('ai:prompts:writeToCode', operation, newPrompt),
      isDevMode:      (): Promise<boolean> =>
        ipcRenderer.invoke('ai:prompts:isDevMode'),
    },
    parseExpiryItems: (rawText: string): Promise<Array<{
      title: string; expiry_date: string; holder: string;
      description: string; frequency: string; category_hint: string
    }>> => ipcRenderer.invoke('ai:parseExpiryItems', rawText),
    // Modo "pegar datos" del importador de Finanzas: la IA interpreta texto en
    // cualquier formato (tabla de Excel pegada, listas, notas sueltas) y
    // devuelve filas ya normalizadas con la MISMA forma que el parser de
    // archivos (`ParsedImportRow`), listas para pasar por el preview existente.
    parseFinanceImportText: (rawText: string, month: number, year: number): Promise<Array<{
      rawConceptName: string
      amount:         number | null
      status:         FinanceMovementStatus
      paymentDate:    number | null
      notes:          string
    }>> => ipcRenderer.invoke('ai:finance:parseImportText', rawText, month, year),
  },

  expiry: {
    categories: {
      list:   (): Promise<ExpiryCategory[]>                                        => ipcRenderer.invoke('expiry:categories:list'),
      create: (data: { name: string; icon: string; color: string }): Promise<ExpiryCategory> => ipcRenderer.invoke('expiry:categories:create', data),
      update: (id: string, data: { name?: string; icon?: string; color?: string }): Promise<ExpiryCategory> => ipcRenderer.invoke('expiry:categories:update', id, data),
      delete: (id: string): Promise<void>                                          => ipcRenderer.invoke('expiry:categories:delete', id),
    },
    items: {
      list:    (): Promise<ExpiryItem[]>                                              => ipcRenderer.invoke('expiry:items:list'),
      get:     (id: string): Promise<ExpiryItem | null>                             => ipcRenderer.invoke('expiry:items:get', id),
      create:  (data: CreateExpiryItemInput): Promise<ExpiryItem>                   => ipcRenderer.invoke('expiry:items:create', data),
      update:  (id: string, data: Partial<CreateExpiryItemInput>): Promise<ExpiryItem> => ipcRenderer.invoke('expiry:items:update', id, data),
      renew:   (id: string, renewedDate: number): Promise<ExpiryItem>               => ipcRenderer.invoke('expiry:items:renew', id, renewedDate),
      unrenew: (id: string): Promise<ExpiryItem>                                    => ipcRenderer.invoke('expiry:items:unrenew', id),
      delete:  (id: string): Promise<void>                                           => ipcRenderer.invoke('expiry:items:delete', id),
    },
    alerts: {
      listByItem:  (itemId: string): Promise<ExpiryAlert[]>                                      => ipcRenderer.invoke('expiry:alerts:listByItem', itemId),
      setForItem:  (itemId: string, alerts: CreateExpiryAlertInput[]): Promise<ExpiryAlert[]>    => ipcRenderer.invoke('expiry:alerts:setForItem', itemId, alerts),
    }
  },

  settings: {
    getPersonalContact:  (): Promise<PersonalContactInfo>                            => ipcRenderer.invoke('settings:personal:get'),
    savePersonalContact: (data: Partial<PersonalContactInfo>): Promise<PersonalContactInfo> => ipcRenderer.invoke('settings:personal:save', data),
  },

  finance: {
    accounts: {
      list:   (): Promise<FinanceAccount[]>                                                => ipcRenderer.invoke('finance:accounts:list'),
      create: (data: CreateFinanceAccountInput): Promise<FinanceAccount>                   => ipcRenderer.invoke('finance:accounts:create', data),
      update: (id: string, data: Partial<CreateFinanceAccountInput>): Promise<FinanceAccount> => ipcRenderer.invoke('finance:accounts:update', id, data),
      delete: (id: string): Promise<void>                                                  => ipcRenderer.invoke('finance:accounts:delete', id),
    },
    categories: {
      list:   (): Promise<FinanceCategory[]>                                                => ipcRenderer.invoke('finance:categories:list'),
      create: (data: CreateFinanceCategoryInput): Promise<FinanceCategory>                  => ipcRenderer.invoke('finance:categories:create', data),
      update: (id: string, data: Partial<CreateFinanceCategoryInput>): Promise<FinanceCategory> => ipcRenderer.invoke('finance:categories:update', id, data),
      delete: (id: string): Promise<void>                                                   => ipcRenderer.invoke('finance:categories:delete', id),
    },
    paymentMethods: {
      list:   (): Promise<FinancePaymentMethodEntity[]>                                                => ipcRenderer.invoke('finance:paymentMethods:list'),
      create: (data: CreateFinancePaymentMethodInput): Promise<FinancePaymentMethodEntity>             => ipcRenderer.invoke('finance:paymentMethods:create', data),
      update: (id: string, data: Partial<CreateFinancePaymentMethodInput>): Promise<FinancePaymentMethodEntity> => ipcRenderer.invoke('finance:paymentMethods:update', id, data),
      delete: (id: string): Promise<void>                                                              => ipcRenderer.invoke('finance:paymentMethods:delete', id),
    },
    concepts: {
      list:   (opts?: { activeOnly?: boolean }): Promise<FinanceConcept[]>                  => ipcRenderer.invoke('finance:concepts:list', opts),
      get:    (id: string): Promise<FinanceConcept | null>                                  => ipcRenderer.invoke('finance:concepts:get', id),
      create: (data: CreateFinanceConceptInput): Promise<FinanceConcept>                    => ipcRenderer.invoke('finance:concepts:create', data),
      update: (id: string, data: Partial<CreateFinanceConceptInput> & { is_active?: number }): Promise<FinanceConcept> =>
        ipcRenderer.invoke('finance:concepts:update', id, data),
      delete: (id: string): Promise<void>                                                   => ipcRenderer.invoke('finance:concepts:delete', id),
    },
    movements: {
      list:   (month: number, year: number): Promise<FinanceMovement[]>                     => ipcRenderer.invoke('finance:movements:list', month, year),
      listUpcoming: (): Promise<FinanceMovement[]>                                          => ipcRenderer.invoke('finance:movements:listUpcoming'),
      get:    (id: string): Promise<FinanceMovement | null>                                 => ipcRenderer.invoke('finance:movements:get', id),
      create: (data: CreateFinanceMovementInput): Promise<FinanceMovement>                  => ipcRenderer.invoke('finance:movements:create', data),
      update: (id: string, data: Partial<CreateFinanceMovementInput>): Promise<FinanceMovement> =>
        ipcRenderer.invoke('finance:movements:update', id, data),
      quickUpdate: (id: string, data: {
        amount_actual?: number | null
        status?:        FinanceMovementStatus
        payment_date?:  number | null
        due_date?:      number | null
        notes?:         string
      }): Promise<FinanceMovement> => ipcRenderer.invoke('finance:movements:quickUpdate', id, data),
      delete:           (id: string): Promise<void>                                         => ipcRenderer.invoke('finance:movements:delete', id),
      generateForMonth: (month: number, year: number): Promise<FinanceMovement[]>           => ipcRenderer.invoke('finance:movements:generateForMonth', month, year),
      generateFromPreviousMonth: (month: number, year: number): Promise<FinanceMovement[]>  => ipcRenderer.invoke('finance:movements:generateFromPreviousMonth', month, year),
    },
    // Registro de cargas — conceptos multi-carga (Opción C): sub-ledger de
    // entradas que se suman dentro de un único movimiento mensual (p. ej.
    // "Nafta" con 3 cargas en el mes en vez de "Nafta 1/2/3").
    movementEntries: {
      list:   (movementId: string): Promise<FinanceMovementEntry[]>                          => ipcRenderer.invoke('finance:movementEntries:list', movementId),
      add:    (data: CreateFinanceMovementEntryInput): Promise<FinanceMovementEntry>          => ipcRenderer.invoke('finance:movementEntries:add', data),
      update: (id: string, data: UpdateFinanceMovementEntryInput): Promise<FinanceMovementEntry> =>
        ipcRenderer.invoke('finance:movementEntries:update', id, data),
      remove: (id: string): Promise<void>                                                    => ipcRenderer.invoke('finance:movementEntries:remove', id),
    },
    summary: {
      get: (month: number, year: number): Promise<FinanceMonthSummary> => ipcRenderer.invoke('finance:summary:get', month, year),
    },
    insights: {
      get:              (month: number, year: number): Promise<FinanceMonthInsight | null> => ipcRenderer.invoke('finance:insights:get', month, year),
      saveNotes:        (month: number, year: number, notes: string): Promise<FinanceMonthInsight>   => ipcRenderer.invoke('finance:insights:saveNotes', month, year, notes),
      generateAnalysis: (month: number, year: number): Promise<string>                               => ipcRenderer.invoke('finance:insights:generateAnalysis', month, year),
      saveAnalysis:     (month: number, year: number, analysis: string): Promise<FinanceMonthInsight> => ipcRenderer.invoke('finance:insights:saveAnalysis', month, year, analysis),
    },
    analytics: {
      categoryBreakdown: (month: number, year: number): Promise<FinanceCategoryBreakdownItem[]> =>
        ipcRenderer.invoke('finance:analytics:categoryBreakdown', month, year),
      history: (month: number, year: number, monthsBack: number): Promise<FinanceHistoryEntry[]> =>
        ipcRenderer.invoke('finance:analytics:history', month, year, monthsBack),
      topConcepts: (month: number, year: number, limit?: number): Promise<FinanceRankingConcept[]> =>
        ipcRenderer.invoke('finance:analytics:topConcepts', month, year, limit),
      topIncreases: (month: number, year: number, limit?: number): Promise<FinanceRankingIncrease[]> =>
        ipcRenderer.invoke('finance:analytics:topIncreases', month, year, limit),
    },
    // Fase 5 — Importación / Exportación / Seguridad
    import: {
      selectFile: (month: number, year: number): Promise<FinanceImportPreviewResult | null> =>
        ipcRenderer.invoke('finance:import:selectFile', month, year),
      confirm: (items: FinanceImportConfirmItem[], month: number, year: number): Promise<FinanceImportResult> =>
        ipcRenderer.invoke('finance:import:confirm', items, month, year),
      // Modo "pegar datos": misma previsualización que `selectFile`, pero a partir
      // de texto pegado a mano que la IA interpreta y normaliza primero.
      parseText: (rawText: string, month: number, year: number): Promise<FinanceImportPreviewResult> =>
        ipcRenderer.invoke('finance:import:parseText', rawText, month, year),
    },
    export: {
      movements: (month: number, year: number, format: 'xlsx' | 'csv'): Promise<{ filePath: string } | null> =>
        ipcRenderer.invoke('finance:export:movements', month, year, format),
      selection: (movements: FinanceMovement[], format: 'xlsx' | 'csv'): Promise<{ filePath: string } | null> =>
        ipcRenderer.invoke('finance:export:selection', movements, format),
      summaryPdf: (month: number, year: number): Promise<{ filePath: string } | null> =>
        ipcRenderer.invoke('finance:export:summaryPdf', month, year),
    },
    security: {
      status:  (): Promise<FinanceSecurityStatus>                                  => ipcRenderer.invoke('finance:security:status'),
      setup:   (pin: string): Promise<FinanceSecurityStatus>                       => ipcRenderer.invoke('finance:security:setup', pin),
      verify:  (pin: string): Promise<boolean>                                     => ipcRenderer.invoke('finance:security:verify', pin),
      disable: (currentPin: string): Promise<boolean>                              => ipcRenderer.invoke('finance:security:disable', currentPin),
      change:  (currentPin: string, newPin: string): Promise<boolean>              => ipcRenderer.invoke('finance:security:change', currentPin, newPin),
    }
  },
  companyFinance: {
    accounts: {
      list:   (): Promise<FinanceAccount[]>                                                => ipcRenderer.invoke('companyFinance:accounts:list'),
      create: (data: CreateFinanceAccountInput): Promise<FinanceAccount>                   => ipcRenderer.invoke('companyFinance:accounts:create', data),
      update: (id: string, data: Partial<CreateFinanceAccountInput>): Promise<FinanceAccount> => ipcRenderer.invoke('companyFinance:accounts:update', id, data),
      delete: (id: string): Promise<void>                                                  => ipcRenderer.invoke('companyFinance:accounts:delete', id),
    },
    categories: {
      list:   (): Promise<FinanceCategory[]>                                                => ipcRenderer.invoke('companyFinance:categories:list'),
      create: (data: CreateFinanceCategoryInput): Promise<FinanceCategory>                  => ipcRenderer.invoke('companyFinance:categories:create', data),
      update: (id: string, data: Partial<CreateFinanceCategoryInput>): Promise<FinanceCategory> => ipcRenderer.invoke('companyFinance:categories:update', id, data),
      delete: (id: string): Promise<void>                                                   => ipcRenderer.invoke('companyFinance:categories:delete', id),
    },
    paymentMethods: {
      list:   (): Promise<FinancePaymentMethodEntity[]>                                                => ipcRenderer.invoke('companyFinance:paymentMethods:list'),
      create: (data: CreateFinancePaymentMethodInput): Promise<FinancePaymentMethodEntity>             => ipcRenderer.invoke('companyFinance:paymentMethods:create', data),
      update: (id: string, data: Partial<CreateFinancePaymentMethodInput>): Promise<FinancePaymentMethodEntity> => ipcRenderer.invoke('companyFinance:paymentMethods:update', id, data),
      delete: (id: string): Promise<void>                                                              => ipcRenderer.invoke('companyFinance:paymentMethods:delete', id),
    },
    concepts: {
      list:   (opts?: { activeOnly?: boolean }): Promise<FinanceConcept[]>                  => ipcRenderer.invoke('companyFinance:concepts:list', opts),
      get:    (id: string): Promise<FinanceConcept | null>                                  => ipcRenderer.invoke('companyFinance:concepts:get', id),
      create: (data: CreateFinanceConceptInput): Promise<FinanceConcept>                    => ipcRenderer.invoke('companyFinance:concepts:create', data),
      update: (id: string, data: Partial<CreateFinanceConceptInput> & { is_active?: number }): Promise<FinanceConcept> =>
        ipcRenderer.invoke('companyFinance:concepts:update', id, data),
      delete: (id: string): Promise<void>                                                   => ipcRenderer.invoke('companyFinance:concepts:delete', id),
    },
    movements: {
      list:   (month: number, year: number): Promise<FinanceMovement[]>                     => ipcRenderer.invoke('companyFinance:movements:list', month, year),
      listUpcoming: (): Promise<FinanceMovement[]>                                          => ipcRenderer.invoke('companyFinance:movements:listUpcoming'),
      get:    (id: string): Promise<FinanceMovement | null>                                 => ipcRenderer.invoke('companyFinance:movements:get', id),
      create: (data: CreateFinanceMovementInput): Promise<FinanceMovement>                  => ipcRenderer.invoke('companyFinance:movements:create', data),
      update: (id: string, data: Partial<CreateFinanceMovementInput>): Promise<FinanceMovement> =>
        ipcRenderer.invoke('companyFinance:movements:update', id, data),
      quickUpdate: (id: string, data: {
        amount_actual?: number | null
        status?:        FinanceMovementStatus
        payment_date?:  number | null
        due_date?:      number | null
        notes?:         string
      }): Promise<FinanceMovement> => ipcRenderer.invoke('companyFinance:movements:quickUpdate', id, data),
      delete:           (id: string): Promise<void>                                         => ipcRenderer.invoke('companyFinance:movements:delete', id),
      generateForMonth: (month: number, year: number): Promise<FinanceMovement[]>           => ipcRenderer.invoke('companyFinance:movements:generateForMonth', month, year),
      generateFromPreviousMonth: (month: number, year: number): Promise<FinanceMovement[]>  => ipcRenderer.invoke('companyFinance:movements:generateFromPreviousMonth', month, year),
    },
    // Registro de cargas — conceptos multi-carga (Opción C): sub-ledger de
    // entradas que se suman dentro de un único movimiento mensual (p. ej.
    // "Nafta" con 3 cargas en el mes en vez de "Nafta 1/2/3").
    movementEntries: {
      list:   (movementId: string): Promise<FinanceMovementEntry[]>                          => ipcRenderer.invoke('companyFinance:movementEntries:list', movementId),
      add:    (data: CreateFinanceMovementEntryInput): Promise<FinanceMovementEntry>          => ipcRenderer.invoke('companyFinance:movementEntries:add', data),
      update: (id: string, data: UpdateFinanceMovementEntryInput): Promise<FinanceMovementEntry> =>
        ipcRenderer.invoke('companyFinance:movementEntries:update', id, data),
      remove: (id: string): Promise<void>                                                    => ipcRenderer.invoke('companyFinance:movementEntries:remove', id),
    },
    summary: {
      get: (month: number, year: number): Promise<FinanceMonthSummary> => ipcRenderer.invoke('companyFinance:summary:get', month, year),
    },
    insights: {
      get:              (month: number, year: number): Promise<FinanceMonthInsight | null> => ipcRenderer.invoke('companyFinance:insights:get', month, year),
      saveNotes:        (month: number, year: number, notes: string): Promise<FinanceMonthInsight>   => ipcRenderer.invoke('companyFinance:insights:saveNotes', month, year, notes),
      generateAnalysis: (month: number, year: number): Promise<string>                               => ipcRenderer.invoke('companyFinance:insights:generateAnalysis', month, year),
      saveAnalysis:     (month: number, year: number, analysis: string): Promise<FinanceMonthInsight> => ipcRenderer.invoke('companyFinance:insights:saveAnalysis', month, year, analysis),
    },
    analytics: {
      categoryBreakdown: (month: number, year: number): Promise<FinanceCategoryBreakdownItem[]> =>
        ipcRenderer.invoke('companyFinance:analytics:categoryBreakdown', month, year),
      history: (month: number, year: number, monthsBack: number): Promise<FinanceHistoryEntry[]> =>
        ipcRenderer.invoke('companyFinance:analytics:history', month, year, monthsBack),
      topConcepts: (month: number, year: number, limit?: number): Promise<FinanceRankingConcept[]> =>
        ipcRenderer.invoke('companyFinance:analytics:topConcepts', month, year, limit),
      topIncreases: (month: number, year: number, limit?: number): Promise<FinanceRankingIncrease[]> =>
        ipcRenderer.invoke('companyFinance:analytics:topIncreases', month, year, limit),
    },
    // Fase 5 — Importación / Exportación / Seguridad
    import: {
      selectFile: (month: number, year: number): Promise<FinanceImportPreviewResult | null> =>
        ipcRenderer.invoke('companyFinance:import:selectFile', month, year),
      confirm: (items: FinanceImportConfirmItem[], month: number, year: number): Promise<FinanceImportResult> =>
        ipcRenderer.invoke('companyFinance:import:confirm', items, month, year),
      // Modo "pegar datos": misma previsualización que `selectFile`, pero a partir
      // de texto pegado a mano que la IA interpreta y normaliza primero.
      parseText: (rawText: string, month: number, year: number): Promise<FinanceImportPreviewResult> =>
        ipcRenderer.invoke('companyFinance:import:parseText', rawText, month, year),
    },
    export: {
      movements: (month: number, year: number, format: 'xlsx' | 'csv'): Promise<{ filePath: string } | null> =>
        ipcRenderer.invoke('companyFinance:export:movements', month, year, format),
      selection: (movements: FinanceMovement[], format: 'xlsx' | 'csv'): Promise<{ filePath: string } | null> =>
        ipcRenderer.invoke('companyFinance:export:selection', movements, format),
      summaryPdf: (month: number, year: number): Promise<{ filePath: string } | null> =>
        ipcRenderer.invoke('companyFinance:export:summaryPdf', month, year),
    },
    security: {
      status:  (): Promise<FinanceSecurityStatus>                                  => ipcRenderer.invoke('companyFinance:security:status'),
      setup:   (pin: string): Promise<FinanceSecurityStatus>                       => ipcRenderer.invoke('companyFinance:security:setup', pin),
      verify:  (pin: string): Promise<boolean>                                     => ipcRenderer.invoke('companyFinance:security:verify', pin),
      disable: (currentPin: string): Promise<boolean>                              => ipcRenderer.invoke('companyFinance:security:disable', currentPin),
      change:  (currentPin: string, newPin: string): Promise<boolean>              => ipcRenderer.invoke('companyFinance:security:change', currentPin, newPin),
    }
  },

  powersync: {
    getStatus: (): Promise<PowerSyncStatusInfo | null> => ipcRenderer.invoke('powersync:getStatus'),
    restoreComex: (): Promise<{ ok: boolean }> => ipcRenderer.invoke('powersync:restoreComex')
  },

  auth: {
    login:      (email: string, password: string): Promise<AuthLoginResult> => ipcRenderer.invoke('auth:login', email, password),
    logout:     (): Promise<void>                                            => ipcRenderer.invoke('auth:logout'),
    getSession: (): Promise<AuthSession | null>                              => ipcRenderer.invoke('auth:getSession')
  },

  app: {
    getVersion: (): Promise<string> => ipcRenderer.invoke('app:getVersion'),
    checkForUpdates: (): Promise<UpdateCheckResult> => ipcRenderer.invoke('app:checkForUpdates'),
    downloadUpdate: (): Promise<void> => ipcRenderer.invoke('app:downloadUpdate'),
    installUpdate: (): Promise<void> => ipcRenderer.invoke('app:installUpdate'),
    quit: (): Promise<void> => ipcRenderer.invoke('app:quit'),
    onUpdateProgress: (callback: (progress: UpdateDownloadProgress) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, progress: UpdateDownloadProgress): void => callback(progress)
      ipcRenderer.on('updater:progress', listener)
      return () => ipcRenderer.removeListener('updater:progress', listener)
    },
    onUpdateDownloaded: (callback: (version: string) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, version: string): void => callback(version)
      ipcRenderer.on('updater:downloaded', listener)
      return () => ipcRenderer.removeListener('updater:downloaded', listener)
    },
    onUpdateError: (callback: (message: string) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, message: string): void => callback(message)
      ipcRenderer.on('updater:error', listener)
      return () => ipcRenderer.removeListener('updater:error', listener)
    }
  },

  permissions: {
    listMine: (): Promise<UserPermission[]> => ipcRenderer.invoke('permissions:listMine'),
    listAll: (): Promise<UserPermission[]> => ipcRenderer.invoke('permissions:listAll'),
    setLevel: (input: { user_id: string; module_key: string; submodule_key?: string | null; level: PermissionLevel }): Promise<UserPermission> =>
      ipcRenderer.invoke('permissions:setLevel', input)
  },

  calendar: {
    status: (): Promise<CalendarConnectionStatus> => ipcRenderer.invoke('calendar:status'),
    connect: (): Promise<CalendarConnectionStatus> => ipcRenderer.invoke('calendar:connect'),
    disconnect: (): Promise<void> => ipcRenderer.invoke('calendar:disconnect'),
    listCalendars: (): Promise<GoogleCalendarInfo[]> => ipcRenderer.invoke('calendar:listCalendars'),
    setEnabledCalendars: (calendarIds: string[]): Promise<CalendarConnectionStatus> =>
      ipcRenderer.invoke('calendar:setEnabledCalendars', calendarIds),
    getEvents: (startDate: number, endDate: number): Promise<UnifiedCalendarEvent[]> =>
      ipcRenderer.invoke('calendar:getEvents', startDate, endDate),
    syncNow: (): Promise<{ synced: number }> => ipcRenderer.invoke('calendar:syncNow'),

    createEvent: (calendarId: string, input: CalendarEventInput): Promise<UnifiedCalendarEvent> =>
      ipcRenderer.invoke('calendar:createEvent', calendarId, input),
    updateEvent: (calendarId: string, googleEventId: string, input: CalendarEventInput): Promise<void> =>
      ipcRenderer.invoke('calendar:updateEvent', calendarId, googleEventId, input),
    deleteEvent: (calendarId: string, googleEventId: string): Promise<void> =>
      ipcRenderer.invoke('calendar:deleteEvent', calendarId, googleEventId),

    getLinks: (sourceModule: CalendarEventLink['source_module'], sourceEventIds: string[]): Promise<CalendarEventLink[]> =>
      ipcRenderer.invoke('calendar:getLinks', sourceModule, sourceEventIds),
    linkEntity: (input: LinkEntityInput): Promise<CalendarEventLink> =>
      ipcRenderer.invoke('calendar:linkEntity', input),
    unlinkEntity: (linkId: string): Promise<void> =>
      ipcRenderer.invoke('calendar:unlinkEntity', linkId),
    refreshLinkedEvent: (linkId: string, input: { title: string; dueAtMs: number }): Promise<CalendarEventLink> =>
      ipcRenderer.invoke('calendar:refreshLinkedEvent', linkId, input),
    scheduleWaReminder: (id: string, phone: string, message: string, sendAt: number): Promise<void> =>
      ipcRenderer.invoke('calendar:scheduleWaReminder', id, phone, message, sendAt),
    cancelWaReminder: (id: string): Promise<void> =>
      ipcRenderer.invoke('calendar:cancelWaReminder', id),
    getWaReminder: (eventId: string): Promise<CalendarWaReminder | null> =>
      ipcRenderer.invoke('calendar:getWaReminder', eventId)
  },

  quotes: {
    companies: {
      list: (): Promise<QuoteCompany[]> => ipcRenderer.invoke('quotes:companies:list'),
      create: (data: CreateQuoteCompanyInput): Promise<QuoteCompany> => ipcRenderer.invoke('quotes:companies:create', data),
      update: (id: string, data: Partial<CreateQuoteCompanyInput>): Promise<QuoteCompany> => ipcRenderer.invoke('quotes:companies:update', id, data),
      delete: (id: string): Promise<void> => ipcRenderer.invoke('quotes:companies:delete', id)
    },
    contacts: {
      list: (companyId?: string): Promise<QuoteContact[]> => ipcRenderer.invoke('quotes:contacts:list', companyId),
      create: (data: CreateQuoteContactInput): Promise<QuoteContact> => ipcRenderer.invoke('quotes:contacts:create', data),
      update: (id: string, data: Partial<Omit<CreateQuoteContactInput, 'company_id'>>): Promise<QuoteContact> => ipcRenderer.invoke('quotes:contacts:update', id, data),
      delete: (id: string): Promise<void> => ipcRenderer.invoke('quotes:contacts:delete', id)
    },
    list: (filters?: { status?: string; priority?: string; assigned_to?: string }): Promise<Quote[]> => ipcRenderer.invoke('quotes:list', filters),
    get: (id: string): Promise<Quote | null> => ipcRenderer.invoke('quotes:get', id),
    create: (data: CreateQuoteInput, userId: string): Promise<Quote> => ipcRenderer.invoke('quotes:create', data, userId),
    update: (id: string, data: UpdateQuoteInput, userId: string): Promise<Quote> => ipcRenderer.invoke('quotes:update', id, data, userId),
    delete: (id: string): Promise<void> => ipcRenderer.invoke('quotes:delete', id),
    activities: {
      list: (quoteId: string): Promise<QuoteActivity[]> => ipcRenderer.invoke('quotes:activities:list', quoteId),
      add: (data: AddQuoteActivityInput): Promise<QuoteActivity> => ipcRenderer.invoke('quotes:activities:add', data)
    },
    kpis: {
      get: (): Promise<QuoteKPIs> => ipcRenderer.invoke('quotes:kpis:get')
    }
  },

  email: {
    accounts: {
      list: (): Promise<EmailAccount[]> => ipcRenderer.invoke('email:accounts:list'),
      get: (id: string): Promise<EmailAccount | null> => ipcRenderer.invoke('email:accounts:get', id),
      create: (data: CreateEmailAccountInput): Promise<EmailAccount> => ipcRenderer.invoke('email:accounts:create', data),
      update: (id: string, data: Partial<CreateEmailAccountInput>): Promise<EmailAccount> => ipcRenderer.invoke('email:accounts:update', id, data),
      delete: (id: string): Promise<void> => ipcRenderer.invoke('email:accounts:delete', id)
    },
    test: {
      imap: (host: string, port: number, secure: boolean, user: string, pass: string): Promise<{ ok: boolean; error?: string; folders?: string[] }> =>
        ipcRenderer.invoke('email:test:imap', host, port, secure, user, pass),
      smtp: (host: string, port: number, secure: boolean, user: string, pass: string): Promise<{ ok: boolean; error?: string }> =>
        ipcRenderer.invoke('email:test:smtp', host, port, secure, user, pass),
      fetch: (host: string, port: number, secure: boolean, user: string, pass: string): Promise<{ ok: boolean; error?: string; total?: number; subjects?: string[] }> =>
        ipcRenderer.invoke('email:test:fetch', host, port, secure, user, pass),
      send: (host: string, port: number, secure: boolean, user: string, pass: string, toEmail: string, displayName: string): Promise<{ ok: boolean; error?: string }> =>
        ipcRenderer.invoke('email:test:send', host, port, secure, user, pass, toEmail, displayName)
    },
    folders: {
      list: (accountId: string): Promise<string[]> => ipcRenderer.invoke('email:folders:list', accountId)
    },
    resetSync: (accountId: string): Promise<{ ok: boolean; error?: string }> => ipcRenderer.invoke('email:reset-sync', accountId),
    sync: (accountId: string, folder?: string): Promise<{ ok: boolean; error?: string }> => ipcRenderer.invoke('email:sync', accountId, folder ?? 'INBOX'),
    onSyncProgress: (cb: (data: { accountId: string; synced: number; total: number }) => void): (() => void) => {
      const handler = (_: Electron.IpcRendererEvent, data: { accountId: string; synced: number; total: number }) => cb(data)
      ipcRenderer.on('email:sync:progress', handler)
      return () => ipcRenderer.removeListener('email:sync:progress', handler)
    },
    messages: {
      list: (filters: EmailListFilters): Promise<EmailMessage[]> => ipcRenderer.invoke('email:messages:list', filters),
      get: (id: string): Promise<EmailMessage | null> => ipcRenderer.invoke('email:messages:get', id),
      markRead: (id: string, isRead: boolean): Promise<void> => ipcRenderer.invoke('email:messages:markRead', id, isRead),
      markStarred: (id: string, isStarred: boolean): Promise<void> => ipcRenderer.invoke('email:messages:markStarred', id, isStarred),
      updateAI: (id: string, category: string, summary: string): Promise<void> => ipcRenderer.invoke('email:messages:updateAI', id, category, summary),
      linkQuote: (id: string, quoteId: string): Promise<void> => ipcRenderer.invoke('email:messages:linkQuote', id, quoteId),
      linkImport: (id: string, importId: string): Promise<void> => ipcRenderer.invoke('email:messages:linkImport', id, importId),
      delete: (id: string): Promise<void> => ipcRenderer.invoke('email:messages:delete', id),
      purge: (id: string): Promise<void> => ipcRenderer.invoke('email:messages:purge', id),
      restore: (id: string): Promise<void> => ipcRenderer.invoke('email:messages:restore', id),
      unreadCount: (accountId: string): Promise<number> => ipcRenderer.invoke('email:messages:unreadCount', accountId)
    },
    attachments: {
      list: (messageId: string): Promise<EmailAttachment[]> => ipcRenderer.invoke('email:attachments:list', messageId),
      path: (localPath: string): Promise<string | null> => ipcRenderer.invoke('email:attachments:path', localPath)
    },
    send: (input: SendEmailInput): Promise<{ ok: boolean; messageId?: string; error?: string }> =>
      ipcRenderer.invoke('email:send', input)
  },

  recon: {
    periods: {
      list: (): Promise<ReconPeriod[]> =>
        ipcRenderer.invoke('recon:periods:list'),
      get: (id: string): Promise<ReconPeriod | null> =>
        ipcRenderer.invoke('recon:periods:get', id),
      create: (data: CreateReconPeriodInput, userId: string): Promise<ReconPeriod> =>
        ipcRenderer.invoke('recon:periods:create', data, userId),
      setStatus: (id: string, status: ReconPeriodStatus, closedBy?: string): Promise<void> =>
        ipcRenderer.invoke('recon:periods:setStatus', id, status, closedBy),
      delete: (id: string): Promise<void> =>
        ipcRenderer.invoke('recon:periods:delete', id),
    },
    imports: {
      list: (periodId: string): Promise<ReconImport[]> =>
        ipcRenderer.invoke('recon:imports:list', periodId),
      importFile: (
        periodId: string,
        source: ReconImportSource,
        importedBy: string,
        filePath?: string
      ): Promise<{ ok: boolean; count?: number; filename?: string; canceled?: boolean; error?: string }> =>
        ipcRenderer.invoke('recon:import', periodId, source, importedBy, filePath),
    },
    data: {
      invoices: (periodId: string): Promise<ReconInvoice[]> =>
        ipcRenderer.invoke('recon:data:invoices', periodId),
      cupones: (periodId: string): Promise<ReconCupon[]> =>
        ipcRenderer.invoke('recon:data:cupones', periodId),
      mlops: (periodId: string): Promise<ReconMLOp[]> =>
        ipcRenderer.invoke('recon:data:mlops', periodId),
    },
    run: (periodId: string): Promise<{ ok: boolean; inserted?: number; error?: string }> =>
      ipcRenderer.invoke('recon:run', periodId),
    results: {
      list: (periodId: string, estado?: ReconEstado): Promise<ReconResult[]> =>
        ipcRenderer.invoke('recon:results:list', periodId, estado),
      update: (id: string, data: { estado?: ReconEstado; notes?: string; override_by?: string }): Promise<void> =>
        ipcRenderer.invoke('recon:results:update', id, data),
    },
    kpis: {
      get: (periodId: string): Promise<ReconKPIs> =>
        ipcRenderer.invoke('recon:kpis:get', periodId),
    },
  },

  on: (
    channel: 'sync:complete' | 'reminder:sent' | 'task:updated' | 'message:sent' | 'question:answered' | 'comex:import:folderReady' | 'backup:complete' | 'backup:local:complete' | 'drive:sessionExpired' | 'chat:chunk' | 'chat:done' | 'chat:error' | 'chat:dataChanged' | 'chat:proactiveAlerts' | 'powersync:status' | 'powersync:dataChanged' | 'auth:sessionChanged',
    callback: (data: unknown) => void
  ) => {
    ipcRenderer.on(channel, (_event, data) => callback(data))
  },

  off: (channel: string) => {
    ipcRenderer.removeAllListeners(channel)
  }
}

contextBridge.exposeInMainWorld('api', api)

export type SummitAPI = typeof api
