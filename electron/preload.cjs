const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("databaseSetup", {
  getInitialData() {
    return ipcRenderer.invoke("setup:get-initial-data");
  },

  saveAndConnect(config) {
    return ipcRenderer.invoke("setup:save-and-connect", config);
  },
});