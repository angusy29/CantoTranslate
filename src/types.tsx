export interface DefinitionEntry {
  // this is the key, required for PouchDB, usually same as traditional
  _id: string;
  traditional: string;
  simplified: string;
  pinyin: string;
  jyutping: string;
  definition: string;
  // custom message string returned back by API
  message: string;
}

export interface CardHeading {
  traditional: string;
  simplified?: string;
}


export enum CACHE_ACTIONS {
  SET_CACHE = "set-cache",
  GET_CACHE = "get-cache"
}