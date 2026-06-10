import { electronAPI } from '@electron-toolkit/preload'
import { contextBridge } from 'electron'

// Custom APIs for renderer — replaced by the typed IPC bridge in S0.2
const api = {}

contextBridge.exposeInMainWorld('electron', electronAPI)
contextBridge.exposeInMainWorld('api', api)
