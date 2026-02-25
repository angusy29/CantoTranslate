import { CACHE_ACTIONS, DefinitionEntry } from "./types";
import { CantoTranslateClient } from "./api_client/client";
import PouchDB from "pouchdb";
import { API_ACTIONS } from "./api_client/constants";

let db: PouchDB.Database = new PouchDB("CantoTranslate");
const cantoTranslateClient = new CantoTranslateClient();

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ appState: true });
});

chrome.runtime.onMessage.addListener(
  (message: any, _: chrome.runtime.MessageSender, sendResponse: any) => {
    if (message.action === API_ACTIONS.GET_ENTRIES) {
      cantoTranslateClient.getEntries(message.text).then((entries: DefinitionEntry[]) => {
        sendResponse(entries);
      });

      // Return true allows us to keep the communication channel open
      // so we can sendResponse back
      return true;
    }

    if (message.action === CACHE_ACTIONS.SET_CACHE) {
      let entry: DefinitionEntry = message.data;
      // PouchDB requires the primary key to be _id
      entry["_id"] = entry["traditional"];

      db.put(entry).catch((err) => {
        sendResponse(err);
      });

      return true;
    }

    if (message.action === CACHE_ACTIONS.GET_CACHE) {
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
