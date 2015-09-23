var app = require('app');
var BrowserWindow = require('browser-window')
    ipc = require('ipc'),
    Menu = require('menu');


var WebSocketServer = require('ws').Server,
    wss = new WebSocketServer({ port: 1234 }),
    EddystoneBeacon = require('eddystone-beacon'),
    _ws = null;

var mainWindow = null;

// Quit when all windows are closed.
app.on('window-all-closed', function() {
  if (process.platform != 'darwin') {
    app.quit();
  }
});

function setUrl(url) {
  try {
    EddystoneBeacon.advertiseUrl(url);
    mainWindow.webContents.send('status', [url, 'Advertising', true]);
    console.log('advertising: ' + url);
    if (_ws) {
      _ws.send('advertising: ' + url);
    }
    console.log();
  }
  catch(e) {
    console.log('error: ' + e);
    mainWindow.webContents.send('status', [e.message, 'Error', false]);
    if (_ws) {
      _ws.send('error: ' + e);
    }
    console.log();
  } 
}

app.on('ready', function() {
  
  var menuTemplate = [
    {
      label: 'Eddystone',
      submenu: [
        {
          label: 'Set URL',
          accelerator: 'Command+N',
          click: function() {
            mainWindow.webContents.send('enter-url', 'go');
          }
        },
        {
          label: 'Quit',
          accelerator: 'Command+Q',
          click: function() { app.quit(); }
        }
      ]
    }
  ];
  
  menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);  

  mainWindow = new BrowserWindow({width: 600, height: 400});

  mainWindow.loadUrl('file://' + __dirname + '/index.html');

  mainWindow.on('closed', function() {
    mainWindow = null;
  });
  
  mainWindow.webContents.on('did-finish-load', function() {
    mainWindow.webContents.send('status', ['Use bookmarklet or Cmd+N to enter', 'Waiting', true]);
  });
  
  wss.on('connection', function connection(ws) {
    ws.on('message', function incoming(url) {
      _ws = ws;
      console.log('received: ' + url);
      ws.send('received: ' + url);
      setUrl(url);
    });
  });
  
  ipc.on('set-url', function(event, arg) {
    setUrl(arg);
  });
  
});