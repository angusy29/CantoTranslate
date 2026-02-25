# CantoTranslate Browser Extension

Learn Cantonese straight from your web browser!

Translates and speaks Cantonese from traditional Chinese words!

Supports Chrome and Firefox!

How to use:
* Simply **double click** or **highlight and hover** on a word or phrase and definitions and Jyutping will appear!
* You can also click on the sound icon to hear the pronunciation in Cantonese!
* Any words without definitions will link you to a Google Translate link!

**Version 1.1**
* Allow user to highlight and hover over text to translate text

## Release

Chrome Extension: https://chrome.google.com/webstore/detail/cantotranslate/idagpklnbkefmgdajpopkngfnnjiiadj

Firefox Extension: https://addons.mozilla.org/en-US/firefox/addon/cantotranslate/

## Chrome: Install and develop

To install, please do the following:
1. Run `npm install` to install dependencies
1. Run `npm run watch-chrome` to build the application into `dist` folder with development feature flags, this will hot reload changes
1. Load `dist` folder into Chrome extensions to install extension

Note: Turn on and off feature flags in `webpack.dev.js`

## Chrome: Install and distribute

To install, please do the following:
1. Run `npm install` to install dependencies
1. Run `npm run build-chrome` to build the application into `dist` folder
1. Zip up `dist` folder, this is what will be uploaded to Chrome developer dashboard


## Firefox: Install and develop

To install, please do the following:
1. Run `npm install` to install dependencies
1. Run `npm run watch-firefox` to build the application into `dist` folder with development feature flags, this will hot reload changes
1. Go to Firefox URL `about:debugging#/setup` and click on `manifest.json` in `dist` folder to install extension

Note: Turn on and off feature flags in `webpack.dev.js`

## Firefox: Install and distribute

To install, please do the following:
1. Run `npm install` to install dependencies
1. Run `npm run build-firefox` to build the application into `dist` folder
1. Go into the dist folder, select all the contents (files) in the dist folder and zip it
1. Submit the zip to Firefox addons developer dashboard

## Screenshots

<p align="center">
  <img src="Screenshots/screenshot1.png" width="50%"/>
  <img src="Screenshots/screenshot2.png" width="50%"/>
  <img src="Screenshots/screenshot3.png" width="50%"/>
</p>

---

## Credits

### Dictionaries

Definitions and readings were sourced from the following sites:

* cc-cedict: https://www.mdbg.net/chinese/dictionary?page=cc-cedict
  * [cedict dictionary download](https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz)
* cc-canto: https://cantonese.org/download.html
  * [ccanto dictionary download](https://cantonese.org/cccanto-170202.zip)
  * [cccedict-canto readings download](https://cantonese.org/cccedict-canto-readings-150923.zip)

### Icons

<a href="https://www.flaticon.com/free-icons/hong-kong" title="hong kong icons">Hong kong icons created by Good Ware - Flaticon</a>


### Development

* For the Chrome Extension Typescript React boilerplate: https://github.com/chibat/chrome-extension-typescript-starter
