import { DefinitionEntry } from "./types";
import { getDefinition } from "./api_client/client";
import PouchDB from "pouchdb";
import { API_ACTIONS } from "./api_client/constants";

let db: PouchDB.Database = new PouchDB("CantoTranslate");

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ appState: true });
});

chrome.runtime.onMessage.addListener(
  (message: any, sender: chrome.runtime.MessageSender, sendResponse: any) => {
    if (message.action === API_ACTIONS.GET_DEFINITION) {
      getDefinition(message.text).then((definitionEntry: DefinitionEntry) => {
        sendResponse(definitionEntry);
      });

      // Return true allows us to keep the communication channel open
      // so we can sendResponse back
      return true;
    }

    if (message.action === "set-cache") {
      let entry = message.data;
      entry["_id"] = entry["traditional"];

      db.put(entry).catch((err) => {
        sendResponse(err);
      });

      return true;
    }

    if (message.action === "get-cache") {
      db.get(message.text)
        .then((definitionEntry) => {
          sendResponse(definitionEntry);
        })
        .catch((err) => {
          sendResponse(err);
        });

      return true;
    }
  }
);
