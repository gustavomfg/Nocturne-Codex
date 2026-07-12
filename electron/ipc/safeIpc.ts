import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron'

type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown

export function safeIpcMain(win: BrowserWindow) {
  return {
    handle(channel: string, handler: Handler) {
      ipcMain.handle(channel, (event, ...args) => {
        const trustedContents = win.webContents
        const expectedUrl = trustedContents.getURL()
        if (event.sender !== trustedContents || event.senderFrame !== trustedContents.mainFrame || !expectedUrl || event.senderFrame.url !== expectedUrl) {
          throw new Error(`Origem IPC não autorizada para ${channel}.`)
        }
        return handler(event, ...args)
      })
    },
  }
}
