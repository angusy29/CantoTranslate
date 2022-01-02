import PouchDB from 'pouchdb';

const RESOURCE_PATH : string = "../resources/data.json";

let db: PouchDB.Database;

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({"appState": true});
  chrome.storage.local.set({"setupComplete": false});
  db = new PouchDB('CantoTranslate');
  populateDefinitions();
});

chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.get("setupComplete", (data) => {
    if (data.setupComplete) {
      chrome.storage.local.set({"appState": true});
      chrome.storage.local.set({"setupComplete": false});
      db = new PouchDB('CantoTranslate');
      populateDefinitions();  
    }
  })
});

chrome.runtime.onMessage.addListener((message: any, sender: chrome.runtime.MessageSender, sendResponse: any) => {
  if (message.action === "get-definition") {
    chrome.storage.local.get("setupComplete", (response) => {
      if (!response.setupComplete) {
        // If the database is not populated, exit immediately
        // So we can still render translation popup box without waiting
        // for results from the dictionary
        sendResponse({_id: message.text});
        return;
      }

      getDocument(message.text).then((data) => {
        sendResponse(data);
      }).catch((err) => {
        sendResponse({_id: message.text});
        console.warn(err);
      });

      return true;
    });

    // Return true allows us to keep the communication channel open
    // so we can sendResponse back
    return true;
  }
});

async function getDocument(identifier: string) {
  const document = await db.get(identifier);
  return document;
}

// TODO: Consider re-evaluating this and moving into
// a database instead and expose via an API
const populateDefinitions = () => {
  const startTime: Date = new Date();

  fetch(RESOURCE_PATH)
    .then(response => response.json())
    .then(json => {
      console.debug("Populating definitions...");
      db.bulkDocs(json).then(() => {
        const endTime: Date = new Date();
        const timeDiff = endTime.valueOf() - startTime.valueOf();
        chrome.storage.local.set({"setupComplete": true});
        console.debug(`Completed population in ${timeDiff} milliseconds`);
      }).catch((err) => {
        console.warn(err);
      });
    });
}
