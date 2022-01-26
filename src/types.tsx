export interface DefinitionEntry {
  // this is the key, required for PouchDB, usually same as traditional
  _id: string;
  traditional: string;
  simplified: string;
  pinyin: string;
  jyutping: string;
  definition: string;
}

export interface CardHeading {
  traditional: string;
  simplified?: string;
}
