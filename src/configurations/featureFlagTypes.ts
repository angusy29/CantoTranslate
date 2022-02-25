// All these are global types, defined in webpack.dev.js and webpack.prod.js
// https://stackoverflow.com/questions/44655095/global-variables-are-undefined-in-typescript-coming-from-webpack

// declare statement required to silence typescript
// as webpack defines global variables
declare const mock_get_definition: boolean;
const _mock_get_definition = mock_get_definition;
export { _mock_get_definition as mock_get_definition };