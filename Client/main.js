// Electron
const electron = require('electron');
const url = require('url');
const path = require('path');
const{app,BrowserWindow,Menu, ipcMain, dialog} = electron;
const fs = require('fs');
const storage = require('electron-json-storage');

// Client Config
// TODO geht noch nicht - lädt nur lokale nicht veränderbare
var config = require('./config.json');

storage.has('config', function(error, hasKey) {
    if (error) throw error;
  
    if (hasKey) {
        storage.get('config', function(error, data) {
            if (error) throw error;
            config = data.config;
        });
    }else{
        storage.set('config', { con }, function(error) {
            if (error) throw error;
        });
    }
});

// SocketIO
const ioUrl = config.url+':'+config.port;
const io = require("socket.io-client");
const ioClient = io.connect(ioUrl);

// Files
const readMultipleFiles = require('read-multiple-files');

// Variables
let serverList = new Map();
let userMe;

// Custom Modules
const msgModule = require('./shared-objects/message-object.js');  
const Message = msgModule.Message;
const usrModule = require('./shared-objects/user-object.js');  
const User = usrModule.User;
const utils = require('./custom-modules/utils.js');

// Main Fenster
let mainWindow;

// Main Fenster Größe
let currentWidth = 1220;
let currentHeight = 630;

/*
//////////////////////////// Electron App Main ////////////////////////////////////////
*/

app.on('window-all-closed', app.quit);

app.on('ready', function(){

    if(config.dev) require('devtron').install();

    // ----- MAIN WINDOW -----

    // Applikations Fenster
    mainWindow =  new BrowserWindow({
        width: currentWidth, 
        height: currentHeight,
        minHeight: 550,
        minWidth: 1050,
        backgroundColor:'#fff',
        show: false,
        title:'Copsi'
    });

    // Lade Login Form zuerst
    mainWindow.loadURL(url.format({
        pathname: path.join(__dirname, 'login-form.html'),
        protocol:'file:',
        slashes: true
    }));

    // Ready to show verhindert 'weißes aufblinken' wie man es vom browser kennt
    mainWindow.once('ready-to-show', ()=>{
       mainWindow.show();
       mainWindow.webContents.send('window:resize', currentHeight);
       if(config.dev) mainWindow.webContents.openDevTools();
    });

    // Send current height on resize to adjust scrollbar
    mainWindow.on('resize', function(e){
        var height = mainWindow.getSize()[1];
        if(currentHeight != height){
            currentHeight = height;
            mainWindow.webContents.send('window:resize', height);
        }
    });

    // Wenn Applikation geschlossen wird
    mainWindow.on('closed', function(){
        app.quit();
    });

});

/*
//////////////////////////// IPC MAIN ////////////////////////////////////////
*/

// Wenn User versucht sich einzuloggen sende Loginversuch an Server weiter
ipcMain.on('user:login',function(e,loginData){
    ioClient.emit('user:login',[loginData[0],loginData[1]]);
});

// Wenn User eine Nachricht sendet, leite sie an Server weiter
ipcMain.on('server:message:send',function(e,msg){
    
    // Server aus Serverliste finden mithilfe der ID obj[0]
    serverList.get(msg.serverId)[0].emit('server:message:'+msg.channelId, msg);
    
});

// Wenn ein Channel geladen werden soll fordert dieses Event den Server auf
ipcMain.on('channel:get:old-messages',function(e,tmpInfo){
    
    serverList.get(tmpInfo.serverId)[0].emit('channel:get:old-messages',tmpInfo);

});

// Wenn ein Channel geladen werden soll fordert dieses Event den Server auf
ipcMain.on('channel:files:get:metadata',function(e,tmpInfo){
    
    serverList.get(tmpInfo.serverId)[0].emit('channel:files:get:metadata',tmpInfo);

});

// Aufgerufen durch klicken des Upload buttons in Files Channels
ipcMain.on('channel:files:upload',function(e,tmpInfo){
    
    var filenames = dialog.showOpenDialog({ properties: ['openFile', 'multiSelections'] });

    // Wenn User eine oder mehrere Dateien ausgewählt hat und nicht abbrechen gedrückt hat
    if(filenames!=undefined && filenames != null){

        tmpInfo.files = [];
        readMultipleFiles(filenames).subscribe({
            next(result) {
                var file = {name: result.path.replace(/^.*[\\\/]/, ''), file: result.contents};
                tmpInfo.files.push(file);
            },
            error(err) {
              console.log(err);
            },
            complete() {
                // Zu Objekt hinzufügen und an Server senden
                serverList.get(tmpInfo.serverId)[0].emit('channel:files:upload',tmpInfo);
            }
          });
    }
});

// Wenn ein Channel geladen werden soll fordert dieses Event den Server auf
ipcMain.on('channel:file:download',function(e,tmpInfo){
    
    serverList.get(tmpInfo.serverId)[0].emit('channel:file:download',tmpInfo.filename);

});

/*
//////////////////////////// SOCKET.IO EVENTS ////////////////////////////////////////
*/

// Bei Verbindung
ioClient.on('connect', function () {
    mainWindow.webContents.send('server:connected');

    //TODO Dev / Remove
    //ioClient.emit('user:login',['sesc0043','123']);
    if(config.autologin) ioClient.emit('user:login',['diwa0015','123']);
});

// Wenn eingeloggt
ioClient.on("user:logged-in:personal-info", function(userData){

    userMe = userData[0];
    var serverData = userData[1];

    console.log('Logged in as '+userMe.nickname);

    // Iteration durch alle Server dieses Users
    for(var i=0;i<serverData.length;i++){
        
        // Verbinde mit jedem Sub-Server aus der Liste und speichere in map
        var tmpServer = io.connect(ioUrl+'/'+serverData[i].id);

        // Wenn eine Nachricht auf diesem Server empfangen wird
        tmpServer.on('server:message', (msg) => {
            mainWindow.webContents.send('server:message',msg);
        });

        // Bekomme alte Nachrichten des aktuell selektierten Channels
        tmpServer.on('channel:receive:old-messages', (messages) => {
            mainWindow.webContents.send('channel:receive:old-messages',messages);
        });

        // Bekomme metadata der Dateien eines Channels
        tmpServer.on('channel:files:set:metadata', (package) => {
            mainWindow.webContents.send('channel:files:set:metadata',package);
        });
        
        // Metadaten zur letzten hochgeladenen Datei
        tmpServer.on('channel:files:get:uploaded', (fileMetadata) => {
            mainWindow.webContents.send('channel:files:get:uploaded',fileMetadata);
        });
        
        // Zur Server Map hinzufügen
        serverList.set(serverData[i].id,[tmpServer,serverData[i]]);
    }

    switchScreen('start-overview.html');

    // Sende ServerDaten via ipc wenn Fenster fertig geladen hat
    mainWindow.webContents.on('did-finish-load', function() {
        mainWindow.webContents.send('user:personal-user-info',[serverData,userMe]);
    });
});

// Leite falsche Loginversuch Events weiter an Html
ioClient.on('user:wrong-login:username', () => {
    mainWindow.webContents.send('user:wrong-login:username');
});

ioClient.on('user:wrong-login:duplicate', () => {
    mainWindow.webContents.send('user:wrong-login:duplicate');
});

ioClient.on('user:wrong-login:password', () => {
    mainWindow.webContents.send('user:wrong-login:password');
});

/*
//////////////////////////// FUNCTIONS ////////////////////////////////////////
*/

// Wechsel aktives Html zum startscreen
function switchScreen(screenHtml) {
    mainWindow.loadURL(url.format({
        pathname: path.join(__dirname, screenHtml),
        protocol:'file:',
        slashes: true
    }));
}
