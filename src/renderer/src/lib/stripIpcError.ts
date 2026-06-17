/** Strip Electron's "Error invoking remote method '…': Error: " prefix off an IPC error message. */
export function stripIpcError(msg: string): string {
  return msg.replace(/^Error invoking remote method '[^']+': Error: /, '')
}
