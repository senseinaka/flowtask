/// <reference types="vite/client" />

import type { FlowTaskAPI } from '../../preload/index'

declare global {
  interface Window {
    api: FlowTaskAPI
  }
}
