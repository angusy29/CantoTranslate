import { DefinitionEntry } from "../types";
import { API_ACTIONS } from "./constants";

const API_SERVER: string =
  "https://mb0vkk3lb0.execute-api.ap-southeast-2.amazonaws.com/Staging/";

export const getDefinition = async (text: string): Promise<DefinitionEntry | any> => {
  const response = await fetch(
    `${API_SERVER}${API_ACTIONS.GET_DEFINITION}?traditional=${text}`
  );
  const definition = response.json();
  return definition;
};
