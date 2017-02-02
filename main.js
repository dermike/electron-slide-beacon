/* eslint no-console: 0 */
'use strict';
const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const WebSocketServer = require('ws').Server;
const wss = new WebSocketServer({ 'port': 1234 });
const EddystoneBeacon = require('eddystone-beacon');
const mdns = require('mdns');
let mainWindow = null,
  mdnsAd = null,
  stopAd = null,
  modeBLE = null,
  modeMDNS = null,
  activeModes = '';

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  app.quit();
});

function setBleUrl(url, ws) {
  return new Promise((resolve, reject) => {
    try {
      EddystoneBeacon.advertiseUrl(url);
      activeModes += '<span class="modes">Bluetooth</span>';
      mainWindow.webContents.send('status', [`${url} ${activeModes}`, 'Broadcasting', true]);
      console.log(`ble broadcasting: ${url}`);
      if (ws) {
        ws.send(`ble broadcasting: ${url}`);
      }
      resolve();
    } catch (e) {
      console.log(`error: ${e}`);
      mainWindow.webContents.send('status', [e.message, 'Error', false]);
      if (ws) {
        ws.send(`error: ${e}`);
      }
      reject();
    }
  });
}

function setMdnsUrl(url, ws) {
  return new Promise((resolve, reject) => {
    try {
      let urlParts = url.split('/'),
        protocol = urlParts[0].replace(':', ''),
        port = protocol === 'https' ? 443 : 80,
        host = urlParts[2],
        path = urlParts.filter((part, i) => {
          return i > 2 ? part : false;
        }).join('/');
      mdnsAd = new mdns.Advertisement(mdns.tcp(protocol), port, {
        'name': url,
        'txtRecord': {
          'path': path
        },
        'host': host,
        'domain': 'local',
        'ip': host
      });
      mdnsAd.start();
      activeModes += '<span class="modes">mDNS</span>';
      mainWindow.webContents.send('status', [`${url} ${activeModes}`, 'Broadcasting', true]);
      console.log(`mdns broadcasting: ${url}`);
      if (ws) {
        ws.send(`mdns broadcasting: ${url}`);
      }
      resolve();
    } catch (e) {
      console.log(`error: ${e}`);
      mainWindow.webContents.send('status', [e.message, 'Error', false]);
      if (ws) {
        ws.send(`error: ${e}`);
      }
      reject();
    }
  });
}

function stopMdns() {
  if (mdnsAd) {
    mdnsAd.stop();
  }
}

function setUrl(url, ws) {
  activeModes = '';
  stopMdns();
  if (modeBLE.checked || modeMDNS.checked) {
    if (modeBLE.checked) {
      setBleUrl(url, ws).then(() => {
        if (modeMDNS.checked) {
          setMdnsUrl(url, ws);
        }
        stopAd.enabled = true;
      });
    }
    if (!modeBLE.checked && modeMDNS.checked) {
      setMdnsUrl(url, ws);
      stopAd.enabled = true;
    }
  } else {
    mainWindow.webContents.send('status', ['Choose at least one broadcasting mode', 'Error', false]);
  }
}

function toggleMode(item) {
  if (item.checked) {
    mainWindow.webContents.send('mode', [item.id, true]);
  } else {
    mainWindow.webContents.send('mode', [item.id, false]);
  }
}

app.on('ready', () => {
  const menuTemplate = [
    {
      'label': 'Eddystone',
      'submenu': [
        {
          'label': 'Broadcast URL',
          'accelerator': 'Command+B',
          'click': () => {
            mainWindow.webContents.send('enter-url', 'go');
          }
        },
        {
          'label': 'Stop broadcasting',
          'accelerator': 'Command+S',
          'enabled': false,
          'click': () => {
            EddystoneBeacon.stop();
            stopMdns();
            stopAd.enabled = false;
            mainWindow.webContents.send('status', ['<span class="key" aria-label="command">&#8984;</span> + <span class="key">B</span> to enter URL (or use <a target="_new" href="https://github.com/dermike/slide-beacon">reveal.js presentation plugin</a>)', 'Waiting', true]);
          }
        },
        {
          'label': 'Clear history',
          'accelerator': 'Command+H',
          'click': () => {
            mainWindow.webContents.send('clear-history');
          }
        },
        {
          'label': 'Quit',
          'accelerator': 'Command+Q',
          'click': () => { app.quit(); }
        }
      ]
    },
    {
      'label': 'Edit',
      'submenu': [
        { 'label': 'Paste', 'accelerator': 'CmdOrCtrl+V', 'selector': 'paste:' }
      ]
    },
    {
      'label': 'Broadcasting modes',
      'submenu': [
        {
          'label': 'Bluetooth',
          'type': 'checkbox',
          'id': 'mode-ble',
          'checked': true,
          'click': item => {
            toggleMode(item);
          }
        },
        {
          'label': 'mDNS',
          'type': 'checkbox',
          'id': 'mode-mdns',
          'checked': false,
          'click': item => {
            toggleMode(item);
          }
        }
      ]
    }
  ];

  let menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);
  stopAd = menu.items[0].submenu.items[1];
  modeBLE = menu.items[2].submenu.items[0];
  modeMDNS = menu.items[2].submenu.items[1];

  mainWindow = new BrowserWindow({'width': 600, 'height': 450, 'resizable': false});
  mainWindow.loadURL(`file://${__dirname}/index.html`);
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('status', ['<span class="key" aria-label="command">&#8984;</span> + <span class="key">B</span> to enter URL (or use <a target="_new" href="https://github.com/dermike/slide-beacon">reveal.js presentation plugin</a>)', 'Waiting', true]);
  });

  wss.on('connection', ws => {
    ws.on('message', url => {
      console.log(`received: ${url}`);
      ws.send(`received: ${url}`);
      setUrl(url, ws);
    });
  });

  ipcMain.on('set-url', (event, arg) => {
    setUrl(arg);
  });

  ipcMain.on('set-mode', (event, arg) => {
    switch (arg) {
    case 'mode-ble':
      modeBLE.checked ? modeBLE.checked = false : modeBLE.checked = true;
      toggleMode(modeBLE);
      break;
    case 'mode-mdns':
      modeMDNS.checked ? modeMDNS.checked = false : modeMDNS.checked = true;
      toggleMode(modeMDNS);
      break;
    default:
      break;
    }
  });
});
