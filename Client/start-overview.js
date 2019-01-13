// Electron
const electron = require('electron');
const shortid = require('shortid');
const moment = require('moment');
const {ipcRenderer,shell,Menu} = electron;

// Custom Modules
const msgModule = require('../shared-objects/message-object.js');  
const Message = msgModule.Message;

// Server Display Elemente
const divServerUserList = document.getElementById('divServerUserList');
const navServerChannelList = document.getElementById('sm-channel-list');
const ulServerListLeft = document.getElementById('serverListeLinks');

const divContentScroll = document.getElementById('sm-content');
const divMessageContainer = document.getElementById('divMessageContainer');

const txaMessage = document.getElementById('txaMessage');

// Variablen
let selectedServerObject;
let selectedServerId = '';
let selectedChannelId = '';
let serverDataObject;
let userMe;

// IPC 

// Window resize
ipcRenderer.on('window:resize',function(e,height){
  // Trial error value of 186 depends on navbar, infobar and taskbar
  var newHeight = height - 380;
  divContentScroll.style.height = (height - 380)+'px';
  navServerChannelList.style.height = (height - 140)+'px';
});

// Wenn verbindung zu server hergestellt wurde
ipcRenderer.on('server:connected',function(e){

  console.log('connected');

});

// bei login gesendet von server, enthält alle nötigen serverdaten
ipcRenderer.on('user:personal-user-info',function(e,initObject){

  // Server Objekt und eigenes User Objekt
  var serverData = initObject[0];
  userMe = initObject[1];

  // Variablen um aktuell selektierten Server/Channel zu merken
  selectedServerId = serverData[0].id;
  //TODO wechsel aktuellen channel
  channelChanged(serverData[0].channels[1].childChannels[0]);

  // Auf globale Variable setzen
  serverDataObject = serverData;

  // Serverliste erstellen und server selektieren
  setServerList(serverData);
  serverChanged(selectedServerId);
});

// Wenn eine Nachricht empfangen wurde
ipcRenderer.on('server:message',function(e,msg){

  // Check ob Nachricht auf aktuellem Server
  if(msg.serverId == selectedServerId){
    divMessageContainer.appendChild(getMessageElement(msg));
  }

  // Runter Scrollen
  divContentScroll.scrollTop = divContentScroll.scrollHeight;
});

// Empfange alte Nachrichten nachdem der Channel geändert wurde
ipcRenderer.on('channel:receive:old-messages',function(e,messages){

  //TODO nur die letzten 50 Nachrichten laden (am besten schon im server)
  divMessageContainer.innerHTML = '';
  for(var i=0;i<messages.length;i++){
    divMessageContainer.appendChild(getMessageElement(messages[i]));
  }

  // Runter Scrollen
  divContentScroll.scrollTop = divContentScroll.scrollHeight;
});


/*
//////////////////////////// Interface Creation Functions ////////////////////////////////////////
*/

// Dynamische container leeren
function clearServerInterface(){

  // Channels
  navServerChannelList.innerHTML = '';

  // User
  divServerUserList.innerHTML = '';

  // Messages
  divMessageContainer.innerHTML = '';
}

// Serverliste ganz links anzeigen
function setServerList(serverData){

  for(var i=0;i<serverData.length;i++){

    // Link Element A
    var aServerShort = document.createElement('a');
    aServerShort.classList.add('sm-server-shortname');
    aServerShort.innerText = serverData[i].shortName;

    // Onclick in for Schleife muss so aussehen weil: https://stackoverflow.com/questions/6048561/setting-onclick-to-use-current-value-of-variable-in-loop
    var srvId = serverData[i].id;
    aServerShort.onclick = function(arg) {
      return function() {
        serverChanged(arg);
      }
    }(srvId);

    // A Container Div
    var div = document.createElement('div');
    div.classList.add('sm-server-shortname-container');
    div.appendChild(aServerShort);

    // Span
    var spanServerShort = document.createElement('span');
    spanServerShort.classList.add('icon');
    spanServerShort.classList.add('is-medium');
    spanServerShort.appendChild(div);

    // li
    var liServerShort = document.createElement('li');
    liServerShort.appendChild(spanServerShort);

    // Äußerer Container
    var divServerShort = document.createElement('div');
    divServerShort.classList.add('sm-team-icons');
    // Wenn Server der aktuell selektierte ist
    if(serverData[i].id == selectedServerId){
      divServerShort.classList.add('sm-activated');
    }
    divServerShort.appendChild(liServerShort);

    // Zu ul hinzufügen
    ulServerListLeft.appendChild(divServerShort);
  }
}

// Ändere den Server Titel oben links über der Channelübersicht
function setServerTitle(title){
  document.getElementById('hServerTitle').innerText = title;
}

// Channel des Servers darstellen
function setChannels(channels){

  // Für jeden Channel
  for(var i=0;i<channels.length;i++){
    
    // Wenn der Channel eine Kategorie ist
    if(channels[i].isCategory){

      // Kategorie als P Element erstellen
      var pCategoryName = document.createElement('p');
      pCategoryName.classList.add('menu-label');
      pCategoryName.innerText = channels[i].name;
      navServerChannelList.appendChild(pCategoryName);

      // Wenn die Kategorie unter Channel hat
      if(channels[i].childChannels != null && channels[i].childChannels.length != 0){

        // Unter Channel für Kategorie
        var tmpChildChannels = channels[i].childChannels;
        var ulChildChannels = document.createElement('ul');
        ulChildChannels.classList.add('menu-list');
        for(var j=0;j<tmpChildChannels.length;j++){

          // Icon
          var iChildChannelIcon = document.createElement('i');
          iChildChannelIcon.classList.add('fas');
          // Icon Code vom Channel Objekt
          iChildChannelIcon.classList.add(tmpChildChannels[j].picture);

          // Span
          var spanChildChannel = document.createElement('span');
          spanChildChannel.classList.add('is-small');
          spanChildChannel.classList.add('icon');
          spanChildChannel.appendChild(iChildChannelIcon);

          // Tmp Div Container
          var tmpDiv = document.createElement('div');
          tmpDiv.appendChild(spanChildChannel);

          // Link
          var aChildChannelLink = document.createElement('a');
          aChildChannelLink.href = '#';
          aChildChannelLink.innerHTML = tmpDiv.innerHTML + ' ' + tmpChildChannels[j].name;
          aChildChannelLink.onclick = function(arg) {
            return function() {
              // TODO Channel ändern und alte nachrichten laden
              channelChanged(arg);
            }
          }(tmpChildChannels[j]);

          // List Element
          var liChildChannel = document.createElement('li');
          liChildChannel.appendChild(aChildChannelLink);

          // An Liste anhängen
          ulChildChannels.appendChild(liChildChannel);
        }
      

      // An Kategorie anhängen
      navServerChannelList.appendChild(ulChildChannels);
    }

      // Wenn der Channel ein einfacher Channel ist
    }else{

      // TODO kp vielleicht kommt hier was hin. channel außerhalb einer kategorie

    }

  }

}

// Nutzer des servers darstellen
function setServerUserList(currentServerData){

  // Für Jede Rolle ein Abteil
  for(var i=0;i<currentServerData.roles.length;i++){

    // P Element mit Rollen Name
    var txtRoleLabel = document.createElement('p');
    // Set ID
    txtRoleLabel.classList.add('menu-label');
    txtRoleLabel.innerText = currentServerData.roles[i].name;
    txtRoleLabel.id = 'ServerRoleListP_'+currentServerData.roles[i].id;
    divServerUserList.appendChild(txtRoleLabel);

    // Liste der User mit der aktuellen Rolle
    var ulUsersOfRole = document.createElement('ul');
    ulUsersOfRole.classList.add('menu-list');
    ulUsersOfRole.id = 'ServerRoleListUl_'+currentServerData.roles[i].id;

    divServerUserList.appendChild(ulUsersOfRole);
  }

   // Für jeden User
   for(var j=0;j<currentServerData.users.length;j++){

    // Icon
    var iUserIcon = document.createElement('i');
    iUserIcon.classList.add('fas');
    iUserIcon.classList.add('fa-fish');

    // Icon Container
    var spanUserLabelIcon = document.createElement('span');
    spanUserLabelIcon.classList.add('icon');
    spanUserLabelIcon.classList.add('is-small');
    spanUserLabelIcon.appendChild(iUserIcon);
    
    // tmp div um inner Html zu bekommen
    var tmpDivIcon = document.createElement('div');
    tmpDivIcon.appendChild(spanUserLabelIcon);

    // Text und Link
    var aUserLink = document.createElement('a');
    // TODO Verlinkung lol
    aUserLink.href = '/bulma-admin-dashboard-template/forms.html';
    aUserLink.innerHTML = tmpDivIcon.innerHTML+' '+currentServerData.users[j].nickname;
    //aUserLink.innerText = currentServerData.users[j].nickname;
    //aUserLink.appendChild(spanUserLabelIcon);

    // Listen Element
    var liUser = document.createElement('li');
    liUser.appendChild(aUserLink);
    document.getElementById('ServerRoleListUl_'+currentServerData.users[j].role).appendChild(liUser);
  }
}

// Erzeugt eine Nachricht im Html
function getMessageElement(msg){

  // ARTICLE DIV 1
  // Image
  var image = document.createElement('img');
  image.src= 'assets/img/placeholder/prof.png';

  // Figure
  var figure = document.createElement('figure');
  figure.classList.add('image');
  figure.classList.add('is-64x64');
  figure.appendChild(image);

  // Image Div
  var divImage = document.createElement('div');
  divImage.classList.add('media-left');
  divImage.appendChild(figure);

  // ARTICLE DIV 2
  // User Name mit ID aus Server Objekt laden
  var uName = 'name';
  var uRoleId;
  for(var i=0;i<selectedServerObject.users.length;i++){
    if(selectedServerObject.users[i].id==msg.senderId){
      uName = selectedServerObject.users[i].nickname;
      uRoleId = selectedServerObject.users[i].role;
    }
  }
  // Rollen Name mit ID aus Server Objekt laden
  var uRole = 'role';
  for(var i=0;i<selectedServerObject.roles.length;i++){
    if(selectedServerObject.roles[i].id==uRoleId){
      uRole = selectedServerObject.roles[i].name;
    }
  }
  // P Content Element
  var pContent = document.createElement('p');
  pContent.innerHTML = '<strong>'+uName+'</Strong> <small>'+uRole+'</small> <small>'+moment(msg.timestamp).format("DD.MM.YYYY, HH:mm")+'</small> <br>'+msg.content;

  // Content Inner Div
  var divInnerContent = document.createElement('div');
  divInnerContent.classList.add('content');
  divInnerContent.appendChild(pContent);

  // Content Div
  var divContent = document.createElement('div');
  divContent.classList.add('media-content');
  divContent.appendChild(divInnerContent);

  // 
  // ARTICLE
  var article = document.createElement('article');
  article.classList.add('media');
  article.appendChild(divImage);
  article.appendChild(divContent);

  // Äußerer Container
  var divBox = document.createElement('div');
  divBox.classList.add('box');
  divBox.appendChild(article);

  return divBox;
}

/*
//////////////////////////// User Interaction Functions ////////////////////////////////////////
*/

// Aufgerufen beim Start und wenn der Channel gewechselt wird
function channelChanged(arg){
  divMessageContainer.innerHTML = '';
  selectedChannelId = arg.id;
  txaMessage.placeholder = 'Nachricht an @'+arg.name;
  // Event senden um alte Nachrichten zu laden
  ipcRenderer.send('channel:get:old-messages',[selectedServerId,arg.id]);
}

// Enter taste macht neue zeile killme
function onMessageEnterPressed(e){
  if(e.keyCode==13){

    // Erstelle Nachricht
    var tmpmsg = new Message(shortid.generate(), msgModule.type.txt, new Date(), txaMessage.value, userMe.id, selectedChannelId, selectedServerId);

    ipcRenderer.send('server:message:send',tmpmsg);
    txaMessage.value = '';
    return false;
  }
}

// Wird aufgerufen um den aktuell gezeigten Server zu ändern
function serverChanged(selectedServer){

  // Alle dynamischen container leeren
  clearServerInterface();

  // Globale Variable ändern
  selectedServerId = selectedServer;

  // Gehe durch Server Liste um aktuell selektierten zu finden
  for(var i=0;i<serverDataObject.length;i++){
    if(serverDataObject[i].id === selectedServerId){

      // Speichern um die For Schleife zu sparen wenn das Objekt gebraucht wird
      selectedServerObject = serverDataObject[i];

      // UI erstellen
      setServerTitle(serverDataObject[i].shortName);
      setChannels(serverDataObject[i].channels);
      setServerUserList(serverDataObject[i]);
    }
  }
}