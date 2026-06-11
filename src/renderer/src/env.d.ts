/// <reference types="vite/client" />

import type { SummitAPI } from '../../preload/index'

declare global {
  interface Window {
    api: SummitAPI
  }
}
