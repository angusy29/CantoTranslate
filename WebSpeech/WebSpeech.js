// This file is composed of three parts - WebSpeech, AJAST and SoundManager.
// Each part has its own license description just before the content.

/***************************************************************************
 * Copyright (C) 2011-2023 by Cameron Wong                                 *
 * name in passport: HUANG GUANNENG                                        *
 * email: hgneng at gmail.com                                              *
 * website: https://eguidedog.net                                       *
 *                                                                         *
 * This program is free software; you can redistribute it and/or           *
 * modify it under the terms of the GNU General Public License             *
 * as published by the Free Software Foundation; either version 2          *
 * of the License, or (at your option) any later version.                  *
 *                                                                         *
 * This program is distributed in the hope that it will be useful,         *
 * but WITHOUT ANY WARRANTY; without even the implied warranty of          *
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the           *
 * GNU General Public License for more details.                            *
 *                                                                         *
 * To get detail description of GPL2,                                      *
 * please refer to http://www.gnu.org/licenses/gpl-2.0.htm                 *
 *                                                                         *
 **************************************************************************/

// follwing comment is for passing JSLint: http://www.jslint.com/
/*global document: false, escape: false, soundManager: false, OX: false, MD5: false, window: false */
if (typeof(WebSpeech) === "undefined") {
var WebSpeech = {
  version: '7.0',
  debug: true,
  protocol: 'https', //window.location.href.indexOf('https') >= 0 ? 'https' : 'http',
  server: 'zhiwei-tech.com/cgi-bin/ekho2.pl', // don't add https:// prefix!! // eguidedog.net/cgi-bin/ekho3.pl'
  serverReturnType: 'MP3',
  voice: 'CoquiMandarin',
//  voice: 'en',
  speedDelta: 0,
  pitchDelta: 0,
  volumeDelta: 0,

  referer: null,
  sm2ready: false,
  speechQueue: [],
  frameStack: [],
  state: 'NONE', // 'SPEAKHTML', 'SPEAK_ONE_CLAUSE', 'SPEAK_PARAGRAPH', 'SPEAK_HEADING', 'SPEAK_FOCUSABLE'
  rootNode: null, // root node of speakHtml
  curNode: null,
  curPos: 0,
  curText: '',
  curSpeech: null,
  foundNewParagraph: false,
  headingTags: 'H1 H2 H3 H4 H5 H6',
  foundNewHeading: false,
  paragraphTags: 'P DIV H1 H2 H3 H4 H5 H6 HR BR',
  preHighLightNode: null,
  highLightNode: null,
  seperators: [".",
    "。", // Chinese full stop (12290, \u3002)
    ",",
    "，", // Chinese comma
    ";",
    "；", // Chinese semi-colon
    "！",
    "!",
    "？",
    "?",
    "：",
    ":",
    /*
    "“",
    "”",
    '"',
    "(",
    "（", // Chinese left brace
    ")",
    "）", // Chinese right brace
    "「",
    "」",
    "《",
    "》",
    "、",
    "【",
    "】",*/
    "\n"],

  cacheNode: null,
  cachePos: 0,
  cacheCount: 0,
  cacheMaxCount: 1, // number of speech to pre-cache
  cacheRequesting: false,

  // force load only one audio at one time.
  // need to implement cache through base64
  // Currently, in singletonCacheMode should set cacheMaxCount to 1,
  // variable will conflict when this value greater than 1
  singletonCacheMode: true, 

  isCtrlKeyDown: false,
  isShiftKeyDown: false,

  htmlStartId: null, // element ID for speakHtml. if null, <body> will be used

  onready: function () {
    this.sm2ready = true;
    WebSpeech.playNextSpeech();
  },
  ready: function (f) {
    var self = this;
    this.onready = function () {
      self.sm2ready = true;
      f();
    }
  },
  onfinish: function () {},

  text2url: {}, // hash of text (md5 with prefix 's') to url
  text2audio: {}, // hash of text (md5 with prefix 's') to SM object
  text2base64: {}, // has of text to its content encoded in base64

  log: function (msg) {
    // there should be such element in page: <div id='WebSpeechLog'></div>
    var logDiv = document.getElementById('WebSpeechLog');
    if (logDiv && this.debug) {
      logDiv.innerHTML += msg + '<br/>';
    }
  },

  getStyle: function (elem, styleName) {
    if (elem.nodeType !== 1) { // Element.nodeType === 1
      return null;
    }

    try {
      if (elem.currentStyle) {
        return elem.currentStyle[styleName];
      } else if (window.getComputedStyle) {
        return window.getComputedStyle(elem, null).getPropertyValue(styleName);
      }
    } catch (e) {
      return null;
    }
  },

  fastestServers: {},

  findFastestServer: function (voice, servers) {
    if (!jQuery) {
      return;
    }

    for (var i = 0; i < servers.length; i++) {
      var callbacki = new Function('response', '\
          if (!WebSpeech.fastestServers.' + voice + ') {\
            WebSpeech.fastestServers.' + voice + ' = "' + servers[i].server + '";\
          }');

      jQuery.ajax({
          url: servers[i].server + servers[i].param,
          jsonp: "callback",
          dataType: "jsonp",
          success: callbacki
      });
      /* AJAST貌似有bug，不能同时发多个请求
      OX.AJAST.call(servers[i], 'callback', function (isSuccess, result) {
        if (isSuccess) {
          console.log('get ' + voice + ' ' + servers[i]);
          if (!WebSpeech.fastestServers[voice]) {
            WebSpeech.fastestServers[voice] = servers[i];
          }
        }
      });*/
    }
  },

  getUrl: function (cmd, text) {
    if (this.voice === 'Android') {
      return '[Android|' + cmd + ']' + text;
    }

    var server = WebSpeech.protocol + '://' + this.server;

    if (this.fastestServers[this.voice]) {
      server = this.fastestServers[this.voice];
    } else if (this.voice === 'CoquiMandarin') {
      server = 'https://chengjiyun.com/coqui/client.php';
    }

    var param2 = '&voice=' +
      this.voice + '&speedDelta=' + this.speedDelta + '&pitchDelta=' +
      this.pitchDelta + '&volumeDelta=' + this.volumeDelta + '&text=' +
      encodeURIComponent(text) + (this.referer ? '&referer=' + encodeURIComponent(this.referer) : '');

    var param = '?cmd=' + cmd + param2;

    return server + param;
  },

  playNextSpeech: function () {
    var text, speechId, url, speechRef;

    if (this.voice === 'None') {
      this.speechQueue = [];
      return;
    }

    if (!soundManager.supported()) {
      return;
    }

    if (!this.sm2ready) {
      soundManager.onready(function() { WebSpeech.playNextSpeech(); });
      return;
    }

    // no speech left
    if (this.speechQueue.length === 0) {
      if (this.state === 'SPEAKHTML') {
        text = this.getNextClause();
        if (text.length > 0) {
          speechId = this.getSpeechId(text);
          this.speechQueue.push(speechId);
          if (!this.text2url[speechId]) {
            url = this.getUrl('SPEAK', text);
            if (this.serverReturnType === 'URL') {
              speechRef = this;
              OX.AJAST.call(url, 'callback', function (isSuccess, result) {
                if (isSuccess) {
                  speechRef.text2url[speechId] = result;
                  speechRef.playNextSpeech();
                }
              });
            } else {
              this.text2url[speechId] = url;
            }
          }
          this.playNextSpeech();
        } else {
          this.onfinish();
        }
      } else {
        this.onfinish();
      }
      return;
    //} else if (!this.text2url[this.speechQueue[0]]) {
      // audio url is not ready
      //return;
    }

    speechId = this.speechQueue.shift();

    if (this.state !== 'NONE') {
      this.highLightCurText();
    }

    if (this.voice === 'Android') {
      if (typeof Android != 'undefined' && Android.ttsSpeak) {
        var text = this.text2url[speechId];
        console.log(text);
        var start = text.indexOf(']');
        if (start > 0) {
          Android.ttsSpeak(text.substr(start + 1), 'WebSpeech.playNextSpeech();');
        }
      }
    } else {
      if (!this.text2audio[speechId]) {
        this.text2audio[speechId] = soundManager.createSound({
          id: speechId,
          url: this.text2base64[speechId] ? this.text2base64[speechId] : this.text2url[speechId],
          multiShot: true,
          onconnect: function(bConnect) {
            // this.connected can also be used
            soundManager._writeDebug(this.id+' connected: '+(bConnect?'true':'false'));
          },
          ondataerror: function() {
            soundManager._writeDebug('data error');
          }
        });
      }

      speechRef = this;
      if (WebSpeech.debug) {
        //console.log('play ' + speechId);
        //console.log(this.text2audio[speechId]);
      }

      this.text2audio[speechId].play({
        onfinish: function () {
          speechRef.text2base64[speechId] = null; // release memory
          speechRef.text2url[speechId] = null; // release memory
          speechRef.playNextSpeech();
        }
      });

      this.curSpeech = this.text2audio[speechId];
      if (this.cacheCount > 0) {
        this.cacheCount -= 1;
      }

      WebSpeech.cacheNextSpeech();
    }
  },

  filterPinyin: function(text) {
    return text.replace(/ *[a-z]*[À-ȳ][a-z]* */gi, '');
  },

  // push speech into queue and play on sequence
  speak: function (text) {
    var speechId, speechRef, url;

    if (this.debug) {
      console.log('speak: ' + text);
    }

    text = WebSpeech.filterPinyin(text);
    if (text.length === 0) {
      return WebSpeech.playNextSpeech();
    }

    speechId = this.getSpeechId(text);
    this.speechQueue.push(speechId);
    url = this.getUrl('SPEAK', text);
    if (!this.text2url[speechId]) {
      if (this.serverReturnType === 'URL') {
        speechRef = this;
        OX.AJAST.call(url, 'callback', function (isSuccess, result) {
          if (isSuccess) {
            speechRef.text2url[speechId] = result;
            speechRef.playNextSpeech();
          }
        });
      } else {
        this.text2url[speechId] = url;
        this.playNextSpeech();
      }
    } else {
      this.playNextSpeech();
    }
  },

  getSpeechId: function (text) {
    return 's' + this.voice + 's' + this.speedDelta + 'p' + this.pitchDelta +
        'v' + this.volumeDelta + MD5(text);
  },

  disableHighLight: function () {
    var parentNode;

    // disable previous high light
    if (this.highLightNode) {
      parentNode = this.highLightNode.parentNode;
      parentNode.replaceChild(this.preHighLightNode, this.highLightNode);
      if (this.curNode.parentNode === this.highLightNode) {
        if (this.curNode.previousSibling) {
          if (this.curNode.previousSibling.tagName === 'SPAN') {
            this.curPos += this.curNode.previousSibling.firstChild.length;
            if (this.curNode.previousSibling.previousSibling) {
              this.curPos += this.curNode.previousSibling.previousSibling.length;
            }
          } else {
            this.curPos += this.curNode.previousSibling.length;
          }
        }
        this.curNode = this.preHighLightNode;
      } else if (this.curNode.parentNode &&
          this.curNode.parentNode.parentNode === this.highLightNode) {
        this.curNode = this.preHighLightNode;
      }
      this.preHighLightNode = null;
      this.highLightNode = null;
    }
  },

  highLightCurText: function () {
    var part1, part2, part3, parentNode;

    this.disableHighLight();

    if (!this.curNode.nodeValue)
      return;

    // high light new node
    part1 = this.curNode.nodeValue.substr(0, this.curPos - this.curText.length);
    part2 = '<span id="WebSpeechHighLight" style="background-color:#ff0; color:#000">' + this.curText + '</span>';
    part3 = this.curNode.nodeValue.substr(this.curPos);
    this.highLightNode = document.createElement('span');
    this.highLightNode.innerHTML = part1 + part2 + part3;
    parentNode = this.curNode.parentNode;
    this.preHighLightNode = this.curNode;
    parentNode.replaceChild(this.highLightNode, this.curNode);
    if (this.highLightNode.childNodes[0].tagName === 'SPAN') {
      this.curNode = this.highLightNode.childNodes[0].firstChild;
    } else {
      this.curNode = this.highLightNode.childNodes[1].firstChild;
    }

    // scroll window if highlight text is out of screen
    if (typeof jQuery !== 'undefined') {
      var offset = jQuery('#WebSpeechHighLight').offset();
      if (offset && offset.top + 30 > window.pageYOffset + jQuery(window).height()) {
        window.scrollTo(0, offset.top - 150);
      }
    }
  },

  cacheSpeech: function (speechId, text) {
    var speechRef = this;

    if (this.voice === 'None' || !soundManager.supported()) {
      return;
    }

    if (!this.text2audio[speechId]) {
      if (this.singletonCacheMode) {
        if (!this.text2url[speechId]) {
          url = this.getUrl('BASE64', text);
          this.cacheRequesting = true;
          OX.AJAST.call(url, 'callback', function(status, data) {
            speechRef.cacheRequesting = false;
            if (status) {
              if (WebSpeech.debug) {
                console.log('got: ' + text);
              }
              speechRef.text2base64[speechId] = 'data:audio/mp3;base64,' + data;

              // 由于OX.AJAST.call还没有删除前一个cache的callback，这里不能马上cache下一句
              setTimeout(function() { WebSpeech.cacheNextSpeech(); }, 100);
            } else {
              if (WebSpeech.debug) {
                console.log('fail to get: ' + text);
              }
            }
          });
        }
      } else {
        url = this.getUrl('SPEAK', text);
        this.text2audio[speechId] = soundManager.createSound({
          id: speechId,
          url: url,
          multiShot: true,
          onfinish: function () {
            speechRef.cacheNextSpeech();
          },
          onconnect: function(bConnect) {
            // this.connected can also be used
            soundManager._writeDebug(this.id+' connected: '+(bConnect?'true':'false'));
          },
          ondataerror: function() {
            soundManager._writeDebug('data error');
          },
        });
      }
    }
  },

  cacheNextSpeech: function () {
    var curNode, curPos, curText, text, speechId, url, speechRef;

    if (this.cacheCount >= this.cacheMaxCount || this.cacheRequesting || this.voice == 'Android') {
      return;
    }
    this.cacheCount += 1;

    // backup current position
    curNode = this.curNode;
    curPos = this.curPos;
    curText = this.curText;

    text = this.getNextClause();
    if (text.length > 0) {
      speechId = this.getSpeechId(text);

      if (!this.text2audio[speechId] && !this.text2base64[speechId]) {
        if (this.debug) {
            console.log('cache: ' + text);
        }

        if (this.serverReturnType === 'URL') {
          url = this.getUrl('SPEAK', text);
          speechRef = this;
          OX.AJAST.call(url, 'callback', function (isSuccess, result) {
            if (isSuccess) {
              speechRef.text2url[speechId] = result;
              speechRef.cacheSpeech(speechId);
            }
          });
        } else {
          this.cacheSpeech(speechId, text);
        }
      }
    }

    // restore current position
    this.curText = curText;
    this.curPos = curPos;
    this.curNode = curNode;
  },

  setHtmlStartId: function (id) {
    this.htmlStartId = id;
  },

  speakHtml: function (rootNode, curNode, curPos) {
    var text, speechId, url, speechRef;

    if (!curPos) {
      curPos = 0;
    }

    this.speechQueue = [];

    if (this.voice === 'None') {
      return;
    }

    this.state = 'SPEAKHTML';

    if (rootNode) {
      if (typeof(rootNode) === 'object') {
        this.rootNode = rootNode;
      } else {
        this.rootNode = document.getElementById(rootNode);
      }
    } else if (this.htmlStartId) {
      this.rootNode = document.getElementById(this.htmlStartId);
    } else {
      this.rootNode = document.body;
    }

    if (!curNode) {
      curNode = this.rootNode
    }

    this.curNode = curNode;
    this.curPos = curPos;

    // prepare the first speech
    text = this.getNextClause(curPos);
    if (!text) {
      return;
    }
    this.cacheNode = this.curNode;
    this.cachePos = this.curPos;

    /*
    if (!this.fastestServers[this.voice]) {
      var test_param = '?cmd=BASE64&voice=' + this.voice + '&text=1' +
        (this.referer ? '&referer=' + encodeURIComponent(this.referer) : '');        
      if (//this.voice === 'iflytekXiaomei' || this.voice === 'iflytekJohn' ||
          //this.voice === 'iflytekCatherine' || this.voice === 'iflytek' ||
          //this.voice === 'iflytekXiaolin' || books服务器貌似不能用讯飞了
          this.voice === 'BaiduMandarinFemale' ||
          this.voice === 'BaiduMandarinMale' || this.voice === 'BaiduMandarinMaleXiaoyao' ||
          this.voice === 'BaiduMandarinFemaleYy') {
        this.findFastestServer(this.voice, [{
            'server': WebSpeech.protocol + '://books.eguidedog.net/cgi-bin/ekho2.pl',
            'param': test_param
          }, {
            'server': WebSpeech.protocol + '://zhiwei-tech.com/cgi-bin/ekho3.pl',
            'param': test_param
          }]);
      }

      setTimeout(function() {
        WebSpeech.speak(text);
      }, 1000);
    } else {*/
      this.speak(text);
    //}

    // prepare next speech
    //this.cacheNextSpeech();
  },

  speakPreviousClause: function () {
    var text, speechId, url;

    this.stopHtml();
    this.state = 'SPEAK_ONE_CLAUSE';
    text = this.getPreviousClause(); // this is current clause
    text = this.getPreviousClause(); // this is real previous clause
    this.curPos += text.length;
    if (!text) {
      return;
    }
    this.cacheNode = this.curNode;
    this.cachePos = this.curPos;
    this.speak(text);
  },

  speakNextClause: function () {
    var text;

    this.stopHtml();
    this.state = 'SPEAK_ONE_CLAUSE';
    text = this.getNextClause();
    if (!text) {
      return;
    }
    this.cacheNode = this.curNode;
    this.cachePos = this.curPos;
    this.speak(text);

    // prepare next speech
    this.cacheNextSpeech();
  },

  speakNextParagraph: function () {
    var text;

    this.stopHtml();
    this.state = 'SPEAK_PARAGRAPH';
    this.foundNewParagraph = false;

    do {
      text = this.getNextClause();
    } while (!this.foundNewParagraph && text);

    if (!this.foundNewParagraph) {
      text = 'No more paragraphs.';
    }

    this.speak(text);
  },

  speakPreviousParagraph: function () {
    var text;

    this.stopHtml();
    this.state = 'SPEAK_PARAGRAPH';

    this.getPreviousClause();
    this.getPreviousClause();
    this.foundNewParagraph = false;
    do {
      text = this.getPreviousClause();
    } while (!this.foundNewParagraph && text);

    if (!this.foundNewParagraph) {
      text = 'No more paragraphs.';
    } else {
      text = this.getNextClause();
      text = this.getNextClause();
    }

    this.speak(text);
  },

  speakNextHeading: function () {
    var text;

    this.stopHtml();
    this.state = 'SPEAK_HEADING';
    this.foundNewHeading = false;

    do {
      text = this.getNextClause();
    } while (!this.foundNewHeading && text);

    if (!this.foundNewHeading) {
      text = 'No more headings.';
    }

    this.speak(text);
  },

  speakPreviousHeading: function () {
    var text;

    this.stopHtml();
    this.state = 'SPEAK_HEADING';

    this.getPreviousClause();
    this.getPreviousClause();
    this.foundNewHeading = false;
    do {
      text = this.getPreviousClause();
    } while (!this.foundNewHeading && text);

    if (!this.foundNewHeading) {
      text = 'No more headings.';
    } else if (!text) {
      // the heading is on top of content
      text = this.getNextClause();
    } else {
      text = this.getNextClause();
      text = this.getNextClause();
    }

    this.speak(text);
  },

  getFirstClause: function (text) {
    var i;
    for (i in this.seperators) {
      var sep = this.seperators[i];
      var startPos = 0;
      var pos = 0;
      var doAgain;

      do { 
        doAgain = false;
        if (startPos > 0) {
          var text2 = text.substr(startPos);
          pos = text2.indexOf(sep);
          if (pos > 0) {
            pos += startPos;
          }
        } else {
          pos = text.indexOf(sep);
        }

        // 处理小数点
        if (pos > 0 && sep === '.' && text.length - pos > 1) {
          var c = text.substr(pos + 1, 1);
          if (c >= '0' && c <= '9') {
            startPos = pos + 1;
            doAgain = true;
          }
        }
      } while (doAgain);

      if (pos > 0) {
        text = text.substr(0, pos + 1);
      }
    }

    text = text.replace(/(^\s*)|(\s*$)/g, '');
    return text;
  },

  // @TODO: 根据getFirstClause更新算法
  getLastClause: function (text) {
    var i, clauses;
    for (i in this.seperators) {
      clauses = text.split(this.seperators[i]);
      text = clauses[clauses.length - 1];
    }
    text = text.replace(/(^\s*)|(\s*$)/g, '');
    return text;
  },

  getPreviousClause: function () {
    var text;
    if (!this.curNode) {
      return '';
    }

    if (this.curNode.nodeName === 'FRAME' ||
        this.curNode.nodeName === 'IFRAME') {
      if (this.curNode.contentDocument) {
        this.frameStack.push(this.curNode);
        this.curNode = this.curNode.contentDocument.body;
      }
    }
    
    if (this.curNode.nodeName === 'NOFRAMES' ||
        this.curNode.nodeName === '#comment' ||
        this.curNode.nodeName === 'NOSCRIPT' ||
        this.getStyle(this.curNode, 'display') === 'none' ||
        this.getStyle(this.curNode, 'visibility') === 'hidden') {
      text = ''; // this is meaningless only for passing JSLint
    } else if (!this.curNode.hasChildNodes()) {
      // text node, try to get text to speak
      if (this.curNode.nodeValue) {
        text = this.curNode.nodeValue.substr(0, this.curPos);
        if (text.length > 0) {
          text = this.getLastClause(text);
          if (text.length > 0) {
            this.curPos = this.curNode.nodeValue.lastIndexOf(text, this.curPos - 1);
            // this is it!
            this.curText = text;
            return text;
          }
        }

        do {
          this.curPos -= 1;
        } while (this.curPos >= 0 &&
            this.curNode.nodeValue.charAt(this.curPos).match(/\s/));
        if (this.curPos >= 0) {
          return this.getPreviousClause();
        }
      }
    } else {
      while (this.curNode.lastChild) {
        this.curNode = this.curNode.lastChild;
      }
      this.curPos = this.curNode.length;
      this.curText = '';
      return this.getPreviousClause();
    }

    if (this.curNode.previousSibling && this.curNode !== this.rootNode) {
      // turn to previous sibling
      this.curNode = this.curNode.previousSibling;
      this.curPos = this.curNode.length;
      this.curText = '';
      return this.getPreviousClause();
    } else {
      // turn to parent node's sibling
      do {
        if (!this.curNode.parentNode) {
          if (this.curNode.nodeName === '#document' &&
              this.frameStack.length > 0) {
            this.curNode = this.frameStack.pop();
          } else {
            this.log('no parent');
            this.curNode = this.rootNode; // something wrong
          }
        } else {
          this.curNode = this.curNode.parentNode;

          if (this.headingTags.indexOf(this.curNode.nodeName) >= 0) { 
            this.foundNewHeading = true;
          }

          if (this.paragraphTags.indexOf(this.curNode.nodeName) >= 0) {
            this.foundNewParagraph = true;
          }
        }
      } while (this.curNode !== this.rootNode && (!this.curNode.previousSibling));

      this.curPos = this.curNode.length;
      this.curText = '';
      if (this.curNode === this.rootNode) {
        return '';
      } else {
        this.curNode = this.curNode.previousSibling;
        return this.getPreviousClause();
      }
    }
  },

  // 设置跳过的元素，例如注释
  skipElements: [],
  addSkipElement: function (selector) {
    this.skipElements.push(selector);
  },

  isSkipElement: function (node) {
    // 暂时只支持.class
    for (var i = 0; i < this.skipElements.length; i++) {
      if (this.skipElements[i][0] === '.') {
        if (node.className &&
            node.className.indexOf(this.skipElements[i].substr(1)) != -1) {
          return true;
        }
      }
    }

    return false;
  },

  getNextClause: function (curPos) {
    var text;

    if (!curPos) {
      curPos = 0;
    }

    if (!this.curNode) {
      return '';
    }

    if (this.headingTags.indexOf(this.curNode.nodeName) >= 0) { 
      this.foundNewHeading = true;
    }

    if (this.paragraphTags.indexOf(this.curNode.nodeName) >= 0) {
      this.foundNewParagraph = true;
    }

    if (this.curNode.nodeName === 'NOFRAMES' ||
        this.curNode.nodeName === '#comment' ||
        this.curNode.nodeName === 'NOSCRIPT' ||
        this.getStyle(this.curNode, 'display') === 'none' ||
        this.getStyle(this.curNode, 'visibility') === 'hidden' ||
        this.isSkipElement(this.curNode)) {
      text = ''; // this is meaningless only for passing JSLint
    } else if (this.curNode.nodeName === 'FRAME' ||
        this.curNode.nodeName === 'IFRAME') {
      this.curPos = 0;
      this.curText = '';
      try {
        if (this.curNode.contentDocument) {
          this.frameStack.push(this.curNode);
          this.curNode = this.curNode.contentDocument.body;
          return this.getNextClause();
        }
      } catch (e) {
        text = '';
      }
    } else if (!this.curNode.hasChildNodes()) {
      // text node, try to get text to speak
      if (this.curNode.nodeValue) {
        text = this.curNode.nodeValue.substr(this.curPos,
            this.curNode.nodeValue.length - this.curPos);
        if (text.length > 0) {
          text = this.getFirstClause(text);
          if (text.length > 0) {
            this.curPos = this.curNode.nodeValue.indexOf(text, this.curPos) + text.length;
            // this is it!
            this.curText = text;
            text = WebSpeech.filterPinyin(text);
            if (text.length > 0) {
              return text;
            } else {
              return this.getNextClause();
            }
          }
        }

        do {
          this.curPos += 1;
        } while (this.curPos < this.curNode.nodeValue.length &&
            this.curNode.nodeValue.charAt(this.curPos).match(/\s/));
        if (this.curPos < this.curNode.nodeValue.length) {
          return this.getNextClause();
        }
      }
    } else {
      this.curPos = curPos;
      this.curText = '';
      this.curNode = this.curNode.firstChild;
      return this.getNextClause();
    }

    if (this.curNode.nextSibling && this.curNode !== this.rootNode) {
      // turn to next sibling
      this.curNode = this.curNode.nextSibling;
      this.curPos = 0;
      this.curText = '';
      return this.getNextClause();
    } else {
      // turn to parent node's sibling
      this.curPos = 0;
      this.curText = '';
      do {
        if (!this.curNode.parentNode) {
          if (this.curNode.nodeName === '#document' &&
              this.frameStack.length > 0) {
            this.curNode = this.frameStack.pop();
          } else {
            this.log('no parent');
            this.curNode = this.rootNode;
          }
        } else {
          this.curNode = this.curNode.parentNode;
        }
      } while (this.curNode !== this.rootNode && (!this.curNode.nextSibling));

      if (this.curNode === this.rootNode) {
        return '';
      } else {
        this.curNode = this.curNode.nextSibling;
        return this.getNextClause();
      }
    }
  },

  handleNavigationKeyUp: function (e) {
    // Usage: insert follwing code to <body>
    // onkeydown = 'if (typeof(WebSpeech) !== "undefined")
    //     { WebSpeech.handleNavigationKeyUp(event); }'
    // Return true if the key is handled
    // Key event reference: http://www.quirksmode.org/js/keys.html
    var code;
    if (window.event) { // IE
      code = e.keyCode;
    } else if (e.which) { // Netscape/Firefox/Opera
      code = e.which;
    }

    //this.log('key up: ' + code); 
    switch (code) {
    case 17:
      // CTRL (pause)
      this.isCtrlKeyDown = false;
      return false;
    case 16:
      // SHIFT (continue)
      this.isShiftKeyDown = false;
      return false;
    case 38:
      // ARROW-UP (previous sentence)
      if (this.state !== 'SPEAKHTML') {
        return false;
      }
      this.speakPreviousClause();
      return true;
    case 40:
      // ARROW-DOWN (next sentence)
      if (this.state !== 'SPEAKHTML') {
        return false;
      }
      this.speakNextClause();
      return true;
    case 72:
      // h/H (next heading)
      if (this.state !== 'SPEAKHTML') {
        return false;
      } 
      if (this.isShiftKeyDown) {
        // SHIFT + h/H
        this.speakPreviousHeading();
      } else {
        this.speakNextHeading();
      }
      return true;
    case 80:
      // p next paragraph
      if (this.state !== 'SPEAKHTML') {
        return false;
      }
      if (this.isShiftKeyDown) {
        // SHIFT + p/P
        this.speakPreviousParagraph();
      } else {
        this.speakNextParagraph();
      }
      return true;

      // next/previous page

      // TAB (next element)
      // SHIFT + TAB (previous element)
    default:
      //this.log('unhandled key up: ' + code);
      return false;
    }
  },

  handleNavigationKeyDown: function (e) {
    // Usage: insert follwing code to <body>
    // onkeydown = 'if (typeof(WebSpeech) !== "undefined")
    //     { WebSpeech.handleNavigationKeyDown(event); }'
    // Return true if the key is handled
    // Key event reference: http://www.quirksmode.org/js/keys.html
    var code;
    if (window.event) { // IE
      code = e.keyCode;
    } else if (e.which) { // Netscape/Firefox/Opera
      code = e.which;
    }

    //this.log('key down: ' + code); 
    switch (code) {
    case 17:
      // CTRL (pause)
      this.isCtrlKeyDown = true;
      if (this.isShiftKeyDown) {
        if (this.state === 'SPEAKHTML') {
          this.stopHtml();
        } else {
          this.speakHtml();
        }
      } else {
        this.pauseHtml();
      }
      return true;
    case 16:
      // SHIFT (continue)
      this.isShiftKeyDown = true;
      if (this.isCtrlKeyDown) {
        if (this.state === 'SPEAKHTML') {
          this.stopHtml();
        } else {
          this.speakHtml();
        }
      } else {
        this.resumeHtml();
      }
      return true;

    default:
      //this.log('unhandled key down: ' + code);
      return false;
    }
  },

  play: function (name) {
    if (!soundManager.supported()) {
      soundManager.onready(function () { WebSpeech.play(name); });
      return;
    }
    soundManager.play(name, 'sounds/' + name + '.mp3');
  },

  saveMp3: function (text) {
    window.open(this.getUrl('SAVEMP3', text));
  },

  saveOgg: function (text) {
    window.open(this.getUrl('SAVEOGG', text));
  },

  getPhonSymbols: function (text, callback) {
    OX.AJAST.call(this.getUrl('GETPHONSYMBOLS', text), 'callback', callback);
  },

  setVoice: function (voice) {
    if (!soundManager.supported()) {
      soundManager.onready(function () { WebSpeech.setVoice(voice); });
      return;
    }
    this.voice = voice;
  },

  getSpeedDelta: function () { return this.speedDelta; },
  setSpeedDelta: function (speedDelta) {
    if (!soundManager.supported()) {
      soundManager.onready(function () { WebSpeech.setSpeedDelta(speedDelta); });
      return;
    }

    if (speedDelta >= -50 && speedDelta <= 100) {
      this.speedDelta = speedDelta;
    }

    if (this.voice === 'Android' && Android.ttsSetSpeechRate) {
      Android.ttsSetSpeechRate(1 + this.speedDelta / 100);
    }

    return this.speedDelta;
  },

  getPitchDelta: function () { return this.pitchDelta; },
  setPitchDelta: function (pitchDelta) {
    if (!soundManager.supported()) {
      soundManager.onready(function () { WebSpeech.setPitchDelta(pitchDelta); });
      return;
    }
    if (pitchDelta >= -100 && pitchDelta <= 100) {
      this.pitchDelta = pitchDelta;
    }
    return this.pitchDelta;
  },

  getVolumeDelta: function () { return this.volumeDelta; },
  setVolumeDelta: function (volumeDelta) {
    if (!soundManager.supported()) {
      soundManager.onready(function () { WebSpeech.setVolumeDelta(volumeDelta); });
      return;
    }
    if (volumeDelta >= -100 && volumeDelta <= 100) {
      this.volumeDelta = volumeDelta;
    }
    return this.volumeDelta;
  },

  pause: function () {
    if (this.voice == 'Android') {
      if (typeof Android != 'undefined' && Android.ttsPause) {
        Android.ttsPause();
      }
    } else {
      if (this.curSpeech) {
        this.curSpeech.pause();
      }
    }
  },

  pauseHtml: function () {
    this.pause();
  },

  resume: function () {
    if (this.curSpeech && this.curSpeech.paused) {
      this.curSpeech.resume();
    }
  },

  resumeHtml: function () {
    if (this.state === 'SPEAK_ONE_CLAUSE') {
      this.state = 'SPEAKHTML';
    }

    if (this.curSpeech && this.curSpeech.paused) {
      this.curSpeech.resume();
    } else {
      this.playNextSpeech();
    }
  },

  stop: function () {
    if (this.speechQueue.length > 0) {
      if (this.voice == 'Android') {
        if (typeof Android != 'undefined' && Android.ttsStop) {
          Android.ttsStop();
        }
      } else {
        soundManager.stop(this.speechQueue[0]);
      }

      while (this.speechQueue.length > 0) {
        this.speechQueue.pop();
      }
    }
  },

  stopHtml: function () {
    this.speechQueue = [];
    if (this.curSpeech) {
      this.curSpeech.stop();
    }

    if (this.voice == 'Android' &&
        typeof Android != 'undefined' && Android.ttsStop) {
      Android.ttsStop();
    }

    this.state = 'NONE';
    this.disableHighLight();
    this.cacheCount = 0;
  },

  hasGetUserMedia: function () {
    return !!(navigator.mediaDevices &&
      navigator.mediaDevices.getUserMedia);
  },

  // speech regconition
  srAudio: null,
  srInit: function() {
    WebSpeech.srAudio = document.createElement("audio");
    var bodys = document.getElementsByTagName("body");
    if (bodys.length > 0) {
      bodys[0].appendChild(WebSpeech.srAudio);
    }
  },

  srCaptureMicrophone: function(callback) {
    navigator.mediaDevices.getUserMedia({audio: true})
      .then(callback).catch(function(error) {
        alert('Unable to access your microphone.');
        console.error(error);
    });
  },

  srRecord: null,
  srTimeout: null,
  srStart: function () {
    WebSpeech.srCaptureMicrophone(function(microphone) {
      WebSpeech.srAudio.srcObject = microphone;
      WebSpeech.srRecord = RecordRTC(microphone, {
        type: 'audio',
        recorderType: StereoAudioRecorder,
        desiredSampRate: 16000,
        numberOfAudioChannels: 1,
        timeSlice: 200,
        ondataavailable: function(blob) {
          var reader = new FileReader();
          reader.onload = function(){
            if (!WebSpeech.srAudioStarted) {
              WebSpeech.srDetectAudio(reader.result);
            } else {
              if (!WebSpeech.srDetectAudio(reader.result)) {
                WebSpeech.srAudioStop();
              }
            }
            //console.log(new Int16Array(buffer));
          };
          reader.readAsArrayBuffer(blob);
        }
      });
      WebSpeech.srRecord.startRecording();
      // release microphone on stopRecording
      WebSpeech.srRecord.microphone = microphone;
    });

    WebSpeech.srTimeout = setTimeout(WebSpeech.srStop, 30000);
  },

  srStop: function() {
    clearTimeout(WebSpeech.srTimeout);
    WebSpeech.srRecord.stopRecording();
  },

  srPcmChunks: [],
  srAudioStarted: false,
  srDetectAudio: function (wav) {
    var pcm = new Int16Array(wav);
    for (var i = 22; i < pcm.length; i++) {
      // 如果出现超过10%音量（3276）则认为有声音
      if (Math.abs(pcm[i]) > 3276) {
        WebSpeech.srPcmChunks.push(pcm.slice(22));
        WebSpeech.srAudioStarted = true;
        console.log('detectAudioStart: true');
        return true;
      }
    }

    console.log('detectAudioStart: false');
    return false;
  },

  srAudioStop: function () {
    WebSpeech.srAudioStarted = false;
    if (WebSpeech.srPcmChunks.length > 2) {
      // 抛弃小于0.3秒的音频
      WebSpeech.srSpeechRecognize();
    }
    WebSpeech.srPcmChunks = [];
  },

  srWriteUTFBytes: function (view, offset, string) {
    var lng = string.length;
    for (var i = 0; i < lng; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  },

  srGenerateWav: function() {
    var fileSize = 44;
    for (var i = 0; i < WebSpeech.srPcmChunks.length; i++) {
      fileSize += WebSpeech.srPcmChunks[i].length * 2;
    }

    var buffer = new ArrayBuffer(fileSize);
    var view = new DataView(buffer);

    // RIFF chunk descriptor/identifier 
    WebSpeech.srWriteUTFBytes(view, 0, 'RIFF');
    // RIFF chunk length
    view.setUint32(4, fileSize, true);
    // RIFF type 
    WebSpeech.srWriteUTFBytes(view, 8, 'WAVE');
    // format chunk identifier 
    // FMT sub-chunk
    WebSpeech.srWriteUTFBytes(view, 12, 'fmt ');
    // format chunk length 
    view.setUint32(16, 16, true);
    // sample format (raw)
    view.setUint16(20, 1, true);
    // stereo (2 channels)
    view.setUint16(22, 1, true);
    // sample rate 
    view.setUint32(24, 16000, true);
    // byte rate (sample rate * block align)
    view.setUint32(28, 16000, true);
    // block align (channel count * bytes per sample) 
    view.setUint16(32, 2, true);
    // bits per sample 
    view.setUint16(34, 16, true);
    // data sub-chunk
    // data chunk identifier 
    WebSpeech.srWriteUTFBytes(view, 36, 'data');
    // data chunk length 
    view.setUint32(40, fileSize - 44, true);
    // write the PCM samples
    var index = 44;

    for (var i = 0; i < WebSpeech.srPcmChunks.length; i++) {
      for (var j = 0; j < WebSpeech.srPcmChunks[i].length; j++) {
        view.setInt16(index, WebSpeech.srPcmChunks[i][j], true);
        index += 2;
      }
    }

    var blob = new Blob([buffer], {
        type: 'audio/wav'
    });

    return blob;
  },

  srSpeechRecognized: null,

  srSpeechRecognize: function () {
    console.log('srSpeechRecognize');
    WebSpeech.srStop();

    if (typeof jQuery === 'undefined') {
      console.log('jQuery not found');
      return false;
    }

    var fd = new FormData();
    fd.append('voice', WebSpeech.srVoice);
    fd.append('speech', WebSpeech.srGenerateWav());
    jQuery.ajax({
      type: 'POST',
      url: 'https://chengjiyun.com/coqui/client.php', //https://eguidedog.net/cgi-bin/ekho3.pl', // 'http://120.24.87.124/cgi-bin/ekho3.pl',
      data: fd,
      processData: false,
      contentType: false
    }).done(function(data) {
      console.log(data);
      if (data.result) {
        if (typeof WebSpeech.srSpeechRecognized == 'function') {
          WebSpeech.srSpeechRecognized(data.result);
        }
      }
      //WebSpeech.srStart();
    });
  },

  srVoice: 'Mandarin',
  srSetVoice: function(voice) {
    this.srVoice = voice;
  }
};

// This file contains a simple Javascript broker that encapsulates 
// the AJAST technique, allowing for cross-domain REST 
// (REpresentatoinal State Transfer) calls.
// 
// Copyright (c) 2008 Håvard Stranden <havard.stranden@gmail.com>
//
// Permission is hereby granted, free of charge, to any person
// obtaining a copy of this software and associated documentation
// files (the "Software"), to deal in the Software without
// restriction, including without limitation the rights to use,
// copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the
// Software is furnished to do so, subject to the following
// conditions:
// 
// The above copyright notice and this permission notice shall be
// included in all copies or substantial portions of the Software.
// 
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
// EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
// OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
// NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
// HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
// WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
// FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
// OTHER DEALINGS IN THE SOFTWARE.

if(typeof(OX) === 'undefined') OX = {};
OX.AJAST = 
{
  Broker : function(url, callbackparameter, optional_decode_json_response, optional_timeout_milliseconds, optional_default_params)
  {
    this.url = url;
    this.cb = callbackparameter;
    this.params = [];
    this.timeout = optional_timeout_milliseconds || 15000; // Timeout in milliseconds
    if(typeof(optional_default_params) !== 'undefined')
    {
      for(p in optional_default_params)
        this.params.push(p + '=' + encodeURIComponent(optional_default_params[p]));
    }
    
    this.jsonmode = optional_decode_json_response || false;
  },
  
  __callbacks__ : {},
  
  __callid__ : 1,
  
  call: function(url, callbackparameter, callbackfunction, optional_timeout, optional_decode_json_response)
  {
    var callbackid = 'callback' + OX.AJAST.__callid__;
    
    // Append callback parameter (this also implicitly avoids caching, since the callback id is different for each call)
    url += '&' + encodeURIComponent(callbackparameter) + '=' + encodeURIComponent('OX.AJAST.__callbacks__.' + callbackid);
      
    // Create script tag for the call
    var tag = OX.AJAST.createScriptTag(url);
    // Get the head of the document
    var head = document.getElementsByTagName('head').item(0);
    
      
    // Create a timeout function  
    var timedout = function()
    {
      if (typeof(OX.AJAST.__callbacks__[callbackid]) !== 'undefined') // If the callback still exists...
      {
        // Replace original wrapped callback with a dummy that just deletes itself
        OX.AJAST.__callbacks__[callbackid] = function(){ delete OX.AJAST.__callbacks__[callbackid]; }; 
      }    
      // Signal that the call timed out
      callbackfunction(false); 
      // Remove the script tag (timed out)
      head.removeChild(tag); 
    };
    
    // Create timer for the timeout function
    var timer = setTimeout(timedout, optional_timeout || 15000);
      
    var decode_response = optional_decode_json_response || false;
    
    // Create the callback function          
    OX.AJAST.__callbacks__[callbackid] = function(data)
    {
      // Clear the timeout
      clearTimeout(timer);
      
      if(typeof(data) === 'undefined')
        callbackfunction(false); // Callback with nothing
      else
      {
        callbackfunction(true, decode_response ? eval(data) : data);
      }
      // Replace original callback with a dummy function 
      delete OX.AJAST.__callbacks__[callbackid];
      // Remove the script tag (finished)
      head.removeChild(tag);
    };
    
    // Inject the call
    head.appendChild(tag);
  },
  
  createScriptTag: function(url)
  {
    var s = document.createElement('script');
    s.setAttribute('type', 'text/javascript');
    s.setAttribute('id', 'oxajastcall' + OX.AJAST.Broker.__callid__++);
    s.setAttribute('src', url);
    return s;
  }
};

OX.AJAST.Broker.prototype.call = function(params, callback)
{
  // Create arguments
  var args = [];
  for(p in params)
    args.push(p + '=' + encodeURIComponent(params[p]));
  for(p in this.params)
    args.push(this.params[p]);
  OX.AJAST.call(this.url + '?' + args.join('&'), this.cb, callback, this.timeout, this.jsonmode);
};

/**
*
*  MD5 (Message-Digest Algorithm)
*  http://www.webtoolkit.info/
*
**/
 
var MD5 = function (string) {
 
	function RotateLeft(lValue, iShiftBits) {
		return (lValue<<iShiftBits) | (lValue>>>(32-iShiftBits));
	}
 
	function AddUnsigned(lX,lY) {
		var lX4,lY4,lX8,lY8,lResult;
		lX8 = (lX & 0x80000000);
		lY8 = (lY & 0x80000000);
		lX4 = (lX & 0x40000000);
		lY4 = (lY & 0x40000000);
		lResult = (lX & 0x3FFFFFFF)+(lY & 0x3FFFFFFF);
		if (lX4 & lY4) {
			return (lResult ^ 0x80000000 ^ lX8 ^ lY8);
		}
		if (lX4 | lY4) {
			if (lResult & 0x40000000) {
				return (lResult ^ 0xC0000000 ^ lX8 ^ lY8);
			} else {
				return (lResult ^ 0x40000000 ^ lX8 ^ lY8);
			}
		} else {
			return (lResult ^ lX8 ^ lY8);
		}
 	}
 
 	function F(x,y,z) { return (x & y) | ((~x) & z); }
 	function G(x,y,z) { return (x & z) | (y & (~z)); }
 	function H(x,y,z) { return (x ^ y ^ z); }
	function I(x,y,z) { return (y ^ (x | (~z))); }
 
	function FF(a,b,c,d,x,s,ac) {
		a = AddUnsigned(a, AddUnsigned(AddUnsigned(F(b, c, d), x), ac));
		return AddUnsigned(RotateLeft(a, s), b);
	};
 
	function GG(a,b,c,d,x,s,ac) {
		a = AddUnsigned(a, AddUnsigned(AddUnsigned(G(b, c, d), x), ac));
		return AddUnsigned(RotateLeft(a, s), b);
	};
 
	function HH(a,b,c,d,x,s,ac) {
		a = AddUnsigned(a, AddUnsigned(AddUnsigned(H(b, c, d), x), ac));
		return AddUnsigned(RotateLeft(a, s), b);
	};
 
	function II(a,b,c,d,x,s,ac) {
		a = AddUnsigned(a, AddUnsigned(AddUnsigned(I(b, c, d), x), ac));
		return AddUnsigned(RotateLeft(a, s), b);
	};
 
	function ConvertToWordArray(string) {
		var lWordCount;
		var lMessageLength = string.length;
		var lNumberOfWords_temp1=lMessageLength + 8;
		var lNumberOfWords_temp2=(lNumberOfWords_temp1-(lNumberOfWords_temp1 % 64))/64;
		var lNumberOfWords = (lNumberOfWords_temp2+1)*16;
		var lWordArray=Array(lNumberOfWords-1);
		var lBytePosition = 0;
		var lByteCount = 0;
		while ( lByteCount < lMessageLength ) {
			lWordCount = (lByteCount-(lByteCount % 4))/4;
			lBytePosition = (lByteCount % 4)*8;
			lWordArray[lWordCount] = (lWordArray[lWordCount] | (string.charCodeAt(lByteCount)<<lBytePosition));
			lByteCount++;
		}
		lWordCount = (lByteCount-(lByteCount % 4))/4;
		lBytePosition = (lByteCount % 4)*8;
		lWordArray[lWordCount] = lWordArray[lWordCount] | (0x80<<lBytePosition);
		lWordArray[lNumberOfWords-2] = lMessageLength<<3;
		lWordArray[lNumberOfWords-1] = lMessageLength>>>29;
		return lWordArray;
	};
 
	function WordToHex(lValue) {
		var WordToHexValue="",WordToHexValue_temp="",lByte,lCount;
		for (lCount = 0;lCount<=3;lCount++) {
			lByte = (lValue>>>(lCount*8)) & 255;
			WordToHexValue_temp = "0" + lByte.toString(16);
			WordToHexValue = WordToHexValue + WordToHexValue_temp.substr(WordToHexValue_temp.length-2,2);
		}
		return WordToHexValue;
	};
 
	function Utf8Encode(string) {
		string = string.replace(/\r\n/g,"\n");
		var utftext = "";
 
		for (var n = 0; n < string.length; n++) {
 
			var c = string.charCodeAt(n);
 
			if (c < 128) {
				utftext += String.fromCharCode(c);
			}
			else if((c > 127) && (c < 2048)) {
				utftext += String.fromCharCode((c >> 6) | 192);
				utftext += String.fromCharCode((c & 63) | 128);
			}
			else {
				utftext += String.fromCharCode((c >> 12) | 224);
				utftext += String.fromCharCode(((c >> 6) & 63) | 128);
				utftext += String.fromCharCode((c & 63) | 128);
			}
 
		}
 
		return utftext;
	};
 
	var x=Array();
	var k,AA,BB,CC,DD,a,b,c,d;
	var S11=7, S12=12, S13=17, S14=22;
	var S21=5, S22=9 , S23=14, S24=20;
	var S31=4, S32=11, S33=16, S34=23;
	var S41=6, S42=10, S43=15, S44=21;
 
	string = Utf8Encode(string);
 
	x = ConvertToWordArray(string);
 
	a = 0x67452301; b = 0xEFCDAB89; c = 0x98BADCFE; d = 0x10325476;
 
	for (k=0;k<x.length;k+=16) {
		AA=a; BB=b; CC=c; DD=d;
		a=FF(a,b,c,d,x[k+0], S11,0xD76AA478);
		d=FF(d,a,b,c,x[k+1], S12,0xE8C7B756);
		c=FF(c,d,a,b,x[k+2], S13,0x242070DB);
		b=FF(b,c,d,a,x[k+3], S14,0xC1BDCEEE);
		a=FF(a,b,c,d,x[k+4], S11,0xF57C0FAF);
		d=FF(d,a,b,c,x[k+5], S12,0x4787C62A);
		c=FF(c,d,a,b,x[k+6], S13,0xA8304613);
		b=FF(b,c,d,a,x[k+7], S14,0xFD469501);
		a=FF(a,b,c,d,x[k+8], S11,0x698098D8);
		d=FF(d,a,b,c,x[k+9], S12,0x8B44F7AF);
		c=FF(c,d,a,b,x[k+10],S13,0xFFFF5BB1);
		b=FF(b,c,d,a,x[k+11],S14,0x895CD7BE);
		a=FF(a,b,c,d,x[k+12],S11,0x6B901122);
		d=FF(d,a,b,c,x[k+13],S12,0xFD987193);
		c=FF(c,d,a,b,x[k+14],S13,0xA679438E);
		b=FF(b,c,d,a,x[k+15],S14,0x49B40821);
		a=GG(a,b,c,d,x[k+1], S21,0xF61E2562);
		d=GG(d,a,b,c,x[k+6], S22,0xC040B340);
		c=GG(c,d,a,b,x[k+11],S23,0x265E5A51);
		b=GG(b,c,d,a,x[k+0], S24,0xE9B6C7AA);
		a=GG(a,b,c,d,x[k+5], S21,0xD62F105D);
		d=GG(d,a,b,c,x[k+10],S22,0x2441453);
		c=GG(c,d,a,b,x[k+15],S23,0xD8A1E681);
		b=GG(b,c,d,a,x[k+4], S24,0xE7D3FBC8);
		a=GG(a,b,c,d,x[k+9], S21,0x21E1CDE6);
		d=GG(d,a,b,c,x[k+14],S22,0xC33707D6);
		c=GG(c,d,a,b,x[k+3], S23,0xF4D50D87);
		b=GG(b,c,d,a,x[k+8], S24,0x455A14ED);
		a=GG(a,b,c,d,x[k+13],S21,0xA9E3E905);
		d=GG(d,a,b,c,x[k+2], S22,0xFCEFA3F8);
		c=GG(c,d,a,b,x[k+7], S23,0x676F02D9);
		b=GG(b,c,d,a,x[k+12],S24,0x8D2A4C8A);
		a=HH(a,b,c,d,x[k+5], S31,0xFFFA3942);
		d=HH(d,a,b,c,x[k+8], S32,0x8771F681);
		c=HH(c,d,a,b,x[k+11],S33,0x6D9D6122);
		b=HH(b,c,d,a,x[k+14],S34,0xFDE5380C);
		a=HH(a,b,c,d,x[k+1], S31,0xA4BEEA44);
		d=HH(d,a,b,c,x[k+4], S32,0x4BDECFA9);
		c=HH(c,d,a,b,x[k+7], S33,0xF6BB4B60);
		b=HH(b,c,d,a,x[k+10],S34,0xBEBFBC70);
		a=HH(a,b,c,d,x[k+13],S31,0x289B7EC6);
		d=HH(d,a,b,c,x[k+0], S32,0xEAA127FA);
		c=HH(c,d,a,b,x[k+3], S33,0xD4EF3085);
		b=HH(b,c,d,a,x[k+6], S34,0x4881D05);
		a=HH(a,b,c,d,x[k+9], S31,0xD9D4D039);
		d=HH(d,a,b,c,x[k+12],S32,0xE6DB99E5);
		c=HH(c,d,a,b,x[k+15],S33,0x1FA27CF8);
		b=HH(b,c,d,a,x[k+2], S34,0xC4AC5665);
		a=II(a,b,c,d,x[k+0], S41,0xF4292244);
		d=II(d,a,b,c,x[k+7], S42,0x432AFF97);
		c=II(c,d,a,b,x[k+14],S43,0xAB9423A7);
		b=II(b,c,d,a,x[k+5], S44,0xFC93A039);
		a=II(a,b,c,d,x[k+12],S41,0x655B59C3);
		d=II(d,a,b,c,x[k+3], S42,0x8F0CCC92);
		c=II(c,d,a,b,x[k+10],S43,0xFFEFF47D);
		b=II(b,c,d,a,x[k+1], S44,0x85845DD1);
		a=II(a,b,c,d,x[k+8], S41,0x6FA87E4F);
		d=II(d,a,b,c,x[k+15],S42,0xFE2CE6E0);
		c=II(c,d,a,b,x[k+6], S43,0xA3014314);
		b=II(b,c,d,a,x[k+13],S44,0x4E0811A1);
		a=II(a,b,c,d,x[k+4], S41,0xF7537E82);
		d=II(d,a,b,c,x[k+11],S42,0xBD3AF235);
		c=II(c,d,a,b,x[k+2], S43,0x2AD7D2BB);
		b=II(b,c,d,a,x[k+9], S44,0xEB86D391);
		a=AddUnsigned(a,AA);
		b=AddUnsigned(b,BB);
		c=AddUnsigned(c,CC);
		d=AddUnsigned(d,DD);
	}
 
	var temp = WordToHex(a)+WordToHex(b)+WordToHex(c)+WordToHex(d);
 
	return temp.toLowerCase();
};

/** @license
 *
 * SoundManager 2: JavaScript Sound for the Web
 * ----------------------------------------------
 * http://schillmania.com/projects/soundmanager2/
 *
 * Copyright (c) 2007, Scott Schiller. All rights reserved.
 * Code provided under the BSD License:
 * http://schillmania.com/projects/soundmanager2/license.txt
 *
 * V2.97a.20170601
 */
(function(g,h){function v(gb,v){function Z(b){return c.preferFlash&&z&&!c.ignoreFlash&&c.flash[b]!==h&&c.flash[b]}function q(b){return function(c){var d=this._s;return d&&d._a?b.call(this,c):null}}this.setupOptions={url:gb||null,flashVersion:8,debugMode:!0,debugFlash:!1,useConsole:!0,consoleOnly:!0,waitForWindowLoad:!1,bgColor:"#ffffff",useHighPerformance:!1,flashPollingInterval:null,html5PollingInterval:null,flashLoadTimeout:1E3,wmode:null,allowScriptAccess:"always",useFlashBlock:!1,useHTML5Audio:!0,
forceUseGlobalHTML5Audio:!1,ignoreMobileRestrictions:!1,html5Test:/^(probably|maybe)$/i,preferFlash:!1,noSWFCache:!1,idPrefix:"sound"};this.defaultOptions={autoLoad:!1,autoPlay:!1,from:null,loops:1,onid3:null,onerror:null,onload:null,whileloading:null,onplay:null,onpause:null,onresume:null,whileplaying:null,onposition:null,onstop:null,onfinish:null,multiShot:!0,multiShotEvents:!1,position:null,pan:0,playbackRate:1,stream:!0,to:null,type:null,usePolicyFile:!1,volume:100};this.flash9Options={onfailure:null,
isMovieStar:null,usePeakData:!1,useWaveformData:!1,useEQData:!1,onbufferchange:null,ondataerror:null};this.movieStarOptions={bufferTime:3,serverURL:null,onconnect:null,duration:null};this.audioFormats={mp3:{type:['audio/mpeg; codecs="mp3"',"audio/mpeg","audio/mp3","audio/MPA","audio/mpa-robust"],required:!0},mp4:{related:["aac","m4a","m4b"],type:['audio/mp4; codecs="mp4a.40.2"',"audio/aac","audio/x-m4a","audio/MP4A-LATM","audio/mpeg4-generic"],required:!1},ogg:{type:["audio/ogg; codecs=vorbis"],required:!1},
opus:{type:["audio/ogg; codecs=opus","audio/opus"],required:!1},wav:{type:['audio/wav; codecs="1"',"audio/wav","audio/wave","audio/x-wav"],required:!1},flac:{type:["audio/flac"],required:!1}};this.movieID="sm2-container";this.id=v||"sm2movie";this.debugID="soundmanager-debug";this.debugURLParam=/([#?&])debug=1/i;this.versionNumber="V2.97a.20170601";this.altURL=this.movieURL=this.version=null;this.enabled=this.swfLoaded=!1;this.oMC=null;this.sounds={};this.soundIDs=[];this.didFlashBlock=this.muted=
!1;this.filePattern=null;this.filePatterns={flash8:/\.mp3(\?.*)?$/i,flash9:/\.mp3(\?.*)?$/i};this.features={buffering:!1,peakData:!1,waveformData:!1,eqData:!1,movieStar:!1};this.sandbox={};this.html5={usingFlash:null};this.flash={};this.ignoreFlash=this.html5Only=!1;var M,c=this,Na=null,k=null,aa,t=navigator.userAgent,Oa=g.location.href.toString(),n=document,oa,Pa,pa,m,x=[],N=!1,O=!1,l=!1,A=!1,qa=!1,P,w,ra,ba,sa,E,G,H,Qa,ta,ua,ca,I,da,F,va,Q,wa,ea,J,Ra,xa,ya,za,Sa,R=null,Aa=null,S,Ba,K,fa,ga,p,T=
!1,Ca=!1,Ta,Ua,Va,ha=0,U=null,ia,V=[],W,u=null,Wa,ja,X,Xa,C,ka,Da,Ya,r,hb=Array.prototype.slice,y=!1,Ea,z,Fa,Za,B,Y,$a=0,Ga,Ha=t.match(/(ipad|iphone|ipod)/i),Ia=t.match(/android/i),D=t.match(/msie|trident/i),ib=t.match(/webkit/i),la=t.match(/safari/i)&&!t.match(/chrome/i),Ja=t.match(/opera/i),ma=t.match(/(mobile|pre\/|xoom)/i)||Ha||Ia,ab=!Oa.match(/usehtml5audio/i)&&!Oa.match(/sm2-ignorebadua/i)&&la&&!t.match(/silk/i)&&t.match(/OS\sX\s10_6_([3-7])/i),Ka=n.hasFocus!==h?n.hasFocus():null,na=la&&(n.hasFocus===
h||!n.hasFocus()),bb=!na,cb=/(mp3|mp4|mpa|m4a|m4b)/i,La=n.location?n.location.protocol.match(/http/i):null,jb=La?"":"//",db=/^\s*audio\/(?:x-)?(?:mpeg4|aac|flv|mov|mp4|m4v|m4a|m4b|mp4v|3gp|3g2)\s*(?:$|;)/i,eb="mpeg4 aac flv mov mp4 m4v f4v m4a m4b mp4v 3gp 3g2".split(" "),kb=new RegExp("\\.("+eb.join("|")+")(\\?.*)?$","i");this.mimePattern=/^\s*audio\/(?:x-)?(?:mp(?:eg|3))\s*(?:$|;)/i;this.useAltURL=!La;Xa=[null,"MEDIA_ERR_ABORTED","MEDIA_ERR_NETWORK","MEDIA_ERR_DECODE","MEDIA_ERR_SRC_NOT_SUPPORTED"];
var Ma;try{Ma=Audio!==h&&(Ja&&opera!==h&&10>opera.version()?new Audio(null):new Audio).canPlayType!==h}catch(lb){Ma=!1}this.hasHTML5=Ma;this.setup=function(b){var e=!c.url;b!==h&&l&&u&&c.ok();ra(b);if(!y)if(ma){if(!c.setupOptions.ignoreMobileRestrictions||c.setupOptions.forceUseGlobalHTML5Audio)V.push(I.globalHTML5),y=!0}else c.setupOptions.forceUseGlobalHTML5Audio&&(V.push(I.globalHTML5),y=!0);if(!Ga&&ma)if(c.setupOptions.ignoreMobileRestrictions)V.push(I.ignoreMobile);else if(c.setupOptions.useHTML5Audio=
!0,c.setupOptions.preferFlash=!1,Ha)c.ignoreFlash=!0;else if(Ia&&!t.match(/android\s2\.3/i)||!Ia)y=!0;b&&(e&&Q&&b.url!==h&&c.beginDelayedInit(),Q||b.url===h||"complete"!==n.readyState||setTimeout(F,1));Ga=!0;return c};this.supported=this.ok=function(){return u?l&&!A:c.useHTML5Audio&&c.hasHTML5};this.getMovie=function(b){return aa(b)||n[b]||g[b]};this.createSound=function(b,e){function d(){a=fa(a);c.sounds[a.id]=new M(a);c.soundIDs.push(a.id);return c.sounds[a.id]}var a,f=null;if(!l||!c.ok())return!1;
e!==h&&(b={id:b,url:e});a=w(b);a.url=ia(a.url);a.id===h&&(a.id=c.setupOptions.idPrefix+$a++);if(p(a.id,!0))return c.sounds[a.id];if(ja(a))f=d(),f._setup_html5(a);else{if(c.html5Only||c.html5.usingFlash&&a.url&&a.url.match(/data:/i))return d();8<m&&null===a.isMovieStar&&(a.isMovieStar=!!(a.serverURL||a.type&&a.type.match(db)||a.url&&a.url.match(kb)));a=ga(a,void 0);f=d();8===m?k._createSound(a.id,a.loops||1,a.usePolicyFile):(k._createSound(a.id,a.url,a.usePeakData,a.useWaveformData,a.useEQData,a.isMovieStar,
a.isMovieStar?a.bufferTime:!1,a.loops||1,a.serverURL,a.duration||null,a.autoPlay,!0,a.autoLoad,a.usePolicyFile),a.serverURL||(f.connected=!0,a.onconnect&&a.onconnect.apply(f)));a.serverURL||!a.autoLoad&&!a.autoPlay||f.load(a)}!a.serverURL&&a.autoPlay&&f.play();return f};this.destroySound=function(b,e){if(!p(b))return!1;var d=c.sounds[b],a;d.stop();d._iO={};d.unload();for(a=0;a<c.soundIDs.length;a++)if(c.soundIDs[a]===b){c.soundIDs.splice(a,1);break}e||d.destruct(!0);delete c.sounds[b];return!0};this.load=
function(b,e){return p(b)?c.sounds[b].load(e):!1};this.unload=function(b){return p(b)?c.sounds[b].unload():!1};this.onposition=this.onPosition=function(b,e,d,a){return p(b)?c.sounds[b].onposition(e,d,a):!1};this.clearOnPosition=function(b,e,d){return p(b)?c.sounds[b].clearOnPosition(e,d):!1};this.start=this.play=function(b,e){var d=null,a=e&&!(e instanceof Object);if(!l||!c.ok())return!1;if(p(b,a))a&&(e={url:e});else{if(!a)return!1;a&&(e={url:e});e&&e.url&&(e.id=b,d=c.createSound(e).play())}null===
d&&(d=c.sounds[b].play(e));return d};this.setPlaybackRate=function(b,e,d){return p(b)?c.sounds[b].setPlaybackRate(e,d):!1};this.setPosition=function(b,e){return p(b)?c.sounds[b].setPosition(e):!1};this.stop=function(b){return p(b)?c.sounds[b].stop():!1};this.stopAll=function(){for(var b in c.sounds)c.sounds.hasOwnProperty(b)&&c.sounds[b].stop()};this.pause=function(b){return p(b)?c.sounds[b].pause():!1};this.pauseAll=function(){var b;for(b=c.soundIDs.length-1;0<=b;b--)c.sounds[c.soundIDs[b]].pause()};
this.resume=function(b){return p(b)?c.sounds[b].resume():!1};this.resumeAll=function(){var b;for(b=c.soundIDs.length-1;0<=b;b--)c.sounds[c.soundIDs[b]].resume()};this.togglePause=function(b){return p(b)?c.sounds[b].togglePause():!1};this.setPan=function(b,e){return p(b)?c.sounds[b].setPan(e):!1};this.setVolume=function(b,e){var d,a;if(b!==h&&!isNaN(b)&&e===h){d=0;for(a=c.soundIDs.length;d<a;d++)c.sounds[c.soundIDs[d]].setVolume(b);return!1}return p(b)?c.sounds[b].setVolume(e):!1};this.mute=function(b){var e=
0;b instanceof String&&(b=null);if(b)return p(b)?c.sounds[b].mute():!1;for(e=c.soundIDs.length-1;0<=e;e--)c.sounds[c.soundIDs[e]].mute();return c.muted=!0};this.muteAll=function(){c.mute()};this.unmute=function(b){b instanceof String&&(b=null);if(b)return p(b)?c.sounds[b].unmute():!1;for(b=c.soundIDs.length-1;0<=b;b--)c.sounds[c.soundIDs[b]].unmute();c.muted=!1;return!0};this.unmuteAll=function(){c.unmute()};this.toggleMute=function(b){return p(b)?c.sounds[b].toggleMute():!1};this.getMemoryUse=function(){var b=
0;k&&8!==m&&(b=parseInt(k._getMemoryUse(),10));return b};this.disable=function(b){var e;b===h&&(b=!1);if(A)return!1;A=!0;for(e=c.soundIDs.length-1;0<=e;e--)ya(c.sounds[c.soundIDs[e]]);ya(c);P(b);r.remove(g,"load",G);return!0};this.canPlayMIME=function(b){var e;c.hasHTML5&&(e=X({type:b}));!e&&u&&(e=b&&c.ok()?!!(8<m&&b.match(db)||b.match(c.mimePattern)):null);return e};this.canPlayURL=function(b){var e;c.hasHTML5&&(e=X({url:b}));!e&&u&&(e=b&&c.ok()?!!b.match(c.filePattern):null);return e};this.canPlayLink=
function(b){return b.type!==h&&b.type&&c.canPlayMIME(b.type)?!0:c.canPlayURL(b.href)};this.getSoundById=function(b,e){return b?c.sounds[b]:null};this.onready=function(b,c){if("function"===typeof b)c||(c=g),sa("onready",b,c),E();else throw S("needFunction","onready");return!0};this.ontimeout=function(b,c){if("function"===typeof b)c||(c=g),sa("ontimeout",b,c),E({type:"ontimeout"});else throw S("needFunction","ontimeout");return!0};this._wD=this._writeDebug=function(b,c){return!0};this._debug=function(){};
this.reboot=function(b,e){var d,a,f;for(d=c.soundIDs.length-1;0<=d;d--)c.sounds[c.soundIDs[d]].destruct();if(k)try{D&&(Aa=k.innerHTML),R=k.parentNode.removeChild(k)}catch(h){}Aa=R=u=k=null;c.enabled=Q=l=T=Ca=N=O=A=y=c.swfLoaded=!1;c.soundIDs=[];c.sounds={};$a=0;Ga=!1;if(b)x=[];else for(d in x)if(x.hasOwnProperty(d))for(a=0,f=x[d].length;a<f;a++)x[d][a].fired=!1;c.html5={usingFlash:null};c.flash={};c.html5Only=!1;c.ignoreFlash=!1;g.setTimeout(function(){e||c.beginDelayedInit()},20);return c};this.reset=
function(){return c.reboot(!0,!0)};this.getMoviePercent=function(){return k&&"PercentLoaded"in k?k.PercentLoaded():null};this.beginDelayedInit=function(){qa=!0;F();setTimeout(function(){if(Ca)return!1;ea();da();return Ca=!0},20);H()};this.destruct=function(){c.disable(!0)};M=function(b){var e,d,a=this,f,L,fb,g,n,q,t=!1,l=[],u=0,x,A,v=null,z;d=e=null;this.sID=this.id=b.id;this.url=b.url;this._iO=this.instanceOptions=this.options=w(b);this.pan=this.options.pan;this.volume=this.options.volume;this.isHTML5=
!1;this._a=null;z=!this.url;this.id3={};this._debug=function(){};this.load=function(b){var e=null,d;b!==h?a._iO=w(b,a.options):(b=a.options,a._iO=b,v&&v!==a.url&&(a._iO.url=a.url,a.url=null));a._iO.url||(a._iO.url=a.url);a._iO.url=ia(a._iO.url);d=a.instanceOptions=a._iO;if(!d.url&&!a.url)return a;if(d.url===a.url&&0!==a.readyState&&2!==a.readyState)return 3===a.readyState&&d.onload&&Y(a,function(){d.onload.apply(a,[!!a.duration])}),a;a.loaded=!1;a.readyState=1;a.playState=0;a.id3={};if(ja(d))e=a._setup_html5(d),
e._called_load||(a._html5_canplay=!1,a.url!==d.url&&(a._a.src=d.url,a.setPosition(0)),a._a.autobuffer="auto",a._a.preload="auto",a._a._called_load=!0);else{if(c.html5Only||a._iO.url&&a._iO.url.match(/data:/i))return a;try{a.isHTML5=!1,a._iO=ga(fa(d)),a._iO.autoPlay&&(a._iO.position||a._iO.from)&&(a._iO.autoPlay=!1),d=a._iO,8===m?k._load(a.id,d.url,d.stream,d.autoPlay,d.usePolicyFile):k._load(a.id,d.url,!!d.stream,!!d.autoPlay,d.loops||1,!!d.autoLoad,d.usePolicyFile)}catch(f){J({type:"SMSOUND_LOAD_JS_EXCEPTION",
fatal:!0})}}a.url=d.url;return a};this.unload=function(){0!==a.readyState&&(a.isHTML5?(g(),a._a&&(a._a.pause(),v=ka(a._a))):8===m?k._unload(a.id,"about:blank"):k._unload(a.id),f());return a};this.destruct=function(b){a.isHTML5?(g(),a._a&&(a._a.pause(),ka(a._a),y||fb(),a._a._s=null,a._a=null)):(a._iO.onfailure=null,k._destroySound(a.id));b||c.destroySound(a.id,!0)};this.start=this.play=function(b,e){var d,f,g,L;d=!0;e=e===h?!0:e;b||(b={});a.url&&(a._iO.url=a.url);a._iO=w(a._iO,a.options);a._iO=w(b,
a._iO);a._iO.url=ia(a._iO.url);a.instanceOptions=a._iO;if(!a.isHTML5&&a._iO.serverURL&&!a.connected)return a.getAutoPlay()||a.setAutoPlay(!0),a;ja(a._iO)&&(a._setup_html5(a._iO),n());if(1===a.playState&&!a.paused&&(d=a._iO.multiShot,!d))return a.isHTML5&&a.setPosition(a._iO.position),a;b.url&&b.url!==a.url&&(a.readyState||a.isHTML5||8!==m||!z?a.load(a._iO):z=!1);if(!a.loaded)if(0===a.readyState){if(a.isHTML5||c.html5Only)if(a.isHTML5)a.load(a._iO);else return a;else a._iO.autoPlay=!0,a.load(a._iO);
a.instanceOptions=a._iO}else if(2===a.readyState)return a;!a.isHTML5&&9===m&&0<a.position&&a.position===a.duration&&(b.position=0);a.paused&&0<=a.position&&(!a._iO.serverURL||0<a.position)?a.resume():(a._iO=w(b,a._iO),(!a.isHTML5&&null!==a._iO.position&&0<a._iO.position||null!==a._iO.from&&0<a._iO.from||null!==a._iO.to)&&0===a.instanceCount&&0===a.playState&&!a._iO.serverURL&&(d=function(){a._iO=w(b,a._iO);a.play(a._iO)},a.isHTML5&&!a._html5_canplay?a.load({_oncanplay:d}):a.isHTML5||a.loaded||a.readyState&&
2===a.readyState||a.load({onload:d}),a._iO=A()),(!a.instanceCount||a._iO.multiShotEvents||a.isHTML5&&a._iO.multiShot&&!y||!a.isHTML5&&8<m&&!a.getAutoPlay())&&a.instanceCount++,a._iO.onposition&&0===a.playState&&q(a),a.playState=1,a.paused=!1,a.position=a._iO.position===h||isNaN(a._iO.position)?0:a._iO.position,a.isHTML5||(a._iO=ga(fa(a._iO))),a._iO.onplay&&e&&(a._iO.onplay.apply(a),t=!0),a.setVolume(a._iO.volume,!0),a.setPan(a._iO.pan,!0),1!==a._iO.playbackRate&&a.setPlaybackRate(a._iO.playbackRate),
a.isHTML5?2>a.instanceCount?(n(),d=a._setup_html5(),a.setPosition(a._iO.position),d.play()):(f=new Audio(a._iO.url),g=function(){r.remove(f,"ended",g);a._onfinish(a);ka(f);f=null},L=function(){r.remove(f,"canplay",L);try{f.currentTime=a._iO.position/1E3}catch(b){}f.play()},r.add(f,"ended",g),a._iO.volume!==h&&(f.volume=Math.max(0,Math.min(1,a._iO.volume/100))),a.muted&&(f.muted=!0),a._iO.position?r.add(f,"canplay",L):f.play()):(d=k._start(a.id,a._iO.loops||1,9===m?a.position:a.position/1E3,a._iO.multiShot||
!1),9!==m||d||a._iO.onplayerror&&a._iO.onplayerror.apply(a)));return a};this.stop=function(b){var c=a._iO;1===a.playState&&(a._onbufferchange(0),a._resetOnPosition(0),a.paused=!1,a.isHTML5||(a.playState=0),x(),c.to&&a.clearOnPosition(c.to),a.isHTML5?a._a&&(b=a.position,a.setPosition(0),a.position=b,a._a.pause(),a.playState=0,a._onTimer(),g()):(k._stop(a.id,b),c.serverURL&&a.unload()),a.instanceCount=0,a._iO={},c.onstop&&c.onstop.apply(a));return a};this.setAutoPlay=function(b){a._iO.autoPlay=b;a.isHTML5||
(k._setAutoPlay(a.id,b),b&&(a.instanceCount||1!==a.readyState||a.instanceCount++))};this.getAutoPlay=function(){return a._iO.autoPlay};this.setPlaybackRate=function(b){b=Math.max(.5,Math.min(4,b));if(a.isHTML5)try{a._iO.playbackRate=b,a._a.playbackRate=b}catch(c){}return a};this.setPosition=function(b){b===h&&(b=0);var c=a.isHTML5?Math.max(b,0):Math.min(a.duration||a._iO.duration,Math.max(b,0));a.position=c;b=a.position/1E3;a._resetOnPosition(a.position);a._iO.position=c;if(!a.isHTML5)b=9===m?a.position:
b,a.readyState&&2!==a.readyState&&k._setPosition(a.id,b,a.paused||!a.playState,a._iO.multiShot);else if(a._a){if(a._html5_canplay){if(a._a.currentTime.toFixed(3)!==b.toFixed(3))try{a._a.currentTime=b,(0===a.playState||a.paused)&&a._a.pause()}catch(d){}}else if(b)return a;a.paused&&a._onTimer(!0)}return a};this.pause=function(b){if(a.paused||0===a.playState&&1!==a.readyState)return a;a.paused=!0;a.isHTML5?(a._setup_html5().pause(),g()):(b||b===h)&&k._pause(a.id,a._iO.multiShot);a._iO.onpause&&a._iO.onpause.apply(a);
return a};this.resume=function(){var b=a._iO;if(!a.paused)return a;a.paused=!1;a.playState=1;a.isHTML5?(a._setup_html5().play(),n()):(b.isMovieStar&&!b.serverURL&&a.setPosition(a.position),k._pause(a.id,b.multiShot));!t&&b.onplay?(b.onplay.apply(a),t=!0):b.onresume&&b.onresume.apply(a);return a};this.togglePause=function(){if(0===a.playState)return a.play({position:9!==m||a.isHTML5?a.position/1E3:a.position}),a;a.paused?a.resume():a.pause();return a};this.setPan=function(b,c){b===h&&(b=0);c===h&&
(c=!1);a.isHTML5||k._setPan(a.id,b);a._iO.pan=b;c||(a.pan=b,a.options.pan=b);return a};this.setVolume=function(b,d){b===h&&(b=100);d===h&&(d=!1);a.isHTML5?a._a&&(c.muted&&!a.muted&&(a.muted=!0,a._a.muted=!0),a._a.volume=Math.max(0,Math.min(1,b/100))):k._setVolume(a.id,c.muted&&!a.muted||a.muted?0:b);a._iO.volume=b;d||(a.volume=b,a.options.volume=b);return a};this.mute=function(){a.muted=!0;a.isHTML5?a._a&&(a._a.muted=!0):k._setVolume(a.id,0);return a};this.unmute=function(){a.muted=!1;var b=a._iO.volume!==
h;a.isHTML5?a._a&&(a._a.muted=!1):k._setVolume(a.id,b?a._iO.volume:a.options.volume);return a};this.toggleMute=function(){return a.muted?a.unmute():a.mute()};this.onposition=this.onPosition=function(b,c,d){l.push({position:parseInt(b,10),method:c,scope:d!==h?d:a,fired:!1});return a};this.clearOnPosition=function(a,b){var c;a=parseInt(a,10);if(!isNaN(a))for(c=0;c<l.length;c++)a!==l[c].position||b&&b!==l[c].method||(l[c].fired&&u--,l.splice(c,1))};this._processOnPosition=function(){var b,c;b=l.length;
if(!b||!a.playState||u>=b)return!1;for(--b;0<=b;b--)c=l[b],!c.fired&&a.position>=c.position&&(c.fired=!0,u++,c.method.apply(c.scope,[c.position]));return!0};this._resetOnPosition=function(a){var b,c;b=l.length;if(!b)return!1;for(--b;0<=b;b--)c=l[b],c.fired&&a<=c.position&&(c.fired=!1,u--);return!0};A=function(){var b=a._iO,c=b.from,d=b.to,e,f;f=function(){a.clearOnPosition(d,f);a.stop()};e=function(){if(null!==d&&!isNaN(d))a.onPosition(d,f)};null===c||isNaN(c)||(b.position=c,b.multiShot=!1,e());return b};
q=function(){var b,c=a._iO.onposition;if(c)for(b in c)if(c.hasOwnProperty(b))a.onPosition(parseInt(b,10),c[b])};x=function(){var b,c=a._iO.onposition;if(c)for(b in c)c.hasOwnProperty(b)&&a.clearOnPosition(parseInt(b,10))};n=function(){a.isHTML5&&Ta(a)};g=function(){a.isHTML5&&Ua(a)};f=function(b){b||(l=[],u=0);t=!1;a._hasTimer=null;a._a=null;a._html5_canplay=!1;a.bytesLoaded=null;a.bytesTotal=null;a.duration=a._iO&&a._iO.duration?a._iO.duration:null;a.durationEstimate=null;a.buffered=[];a.eqData=
[];a.eqData.left=[];a.eqData.right=[];a.failures=0;a.isBuffering=!1;a.instanceOptions={};a.instanceCount=0;a.loaded=!1;a.metadata={};a.readyState=0;a.muted=!1;a.paused=!1;a.peakData={left:0,right:0};a.waveformData={left:[],right:[]};a.playState=0;a.position=null;a.id3={}};f();this._onTimer=function(b){var c,f=!1,h={};(a._hasTimer||b)&&a._a&&(b||(0<a.playState||1===a.readyState)&&!a.paused)&&(c=a._get_html5_duration(),c!==e&&(e=c,a.duration=c,f=!0),a.durationEstimate=a.duration,c=1E3*a._a.currentTime||
0,c!==d&&(d=c,f=!0),(f||b)&&a._whileplaying(c,h,h,h,h));return f};this._get_html5_duration=function(){var b=a._iO;return(b=a._a&&a._a.duration?1E3*a._a.duration:b&&b.duration?b.duration:null)&&!isNaN(b)&&Infinity!==b?b:null};this._apply_loop=function(a,b){a.loop=1<b?"loop":""};this._setup_html5=function(b){b=w(a._iO,b);var c=y?Na:a._a,d=decodeURI(b.url),e;y?d===decodeURI(Ea)&&(e=!0):d===decodeURI(v)&&(e=!0);if(c){if(c._s)if(y)c._s&&c._s.playState&&!e&&c._s.stop();else if(!y&&d===decodeURI(v))return a._apply_loop(c,
b.loops),c;e||(v&&f(!1),c.src=b.url,Ea=v=a.url=b.url,c._called_load=!1)}else b.autoLoad||b.autoPlay?(a._a=new Audio(b.url),a._a.load()):a._a=Ja&&10>opera.version()?new Audio(null):new Audio,c=a._a,c._called_load=!1,y&&(Na=c);a.isHTML5=!0;a._a=c;c._s=a;L();a._apply_loop(c,b.loops);b.autoLoad||b.autoPlay?a.load():(c.autobuffer=!1,c.preload="auto");return c};L=function(){if(a._a._added_events)return!1;var b;a._a._added_events=!0;for(b in B)B.hasOwnProperty(b)&&a._a&&a._a.addEventListener(b,B[b],!1);
return!0};fb=function(){var b;a._a._added_events=!1;for(b in B)B.hasOwnProperty(b)&&a._a&&a._a.removeEventListener(b,B[b],!1)};this._onload=function(b){var c=!!b||!a.isHTML5&&8===m&&a.duration;a.loaded=c;a.readyState=c?3:2;a._onbufferchange(0);c||a.isHTML5||a._onerror();a._iO.onload&&Y(a,function(){a._iO.onload.apply(a,[c])});return!0};this._onerror=function(b,c){a._iO.onerror&&Y(a,function(){a._iO.onerror.apply(a,[b,c])})};this._onbufferchange=function(b){if(0===a.playState||b&&a.isBuffering||!b&&
!a.isBuffering)return!1;a.isBuffering=1===b;a._iO.onbufferchange&&a._iO.onbufferchange.apply(a,[b]);return!0};this._onsuspend=function(){a._iO.onsuspend&&a._iO.onsuspend.apply(a);return!0};this._onfailure=function(b,c,d){a.failures++;if(a._iO.onfailure&&1===a.failures)a._iO.onfailure(b,c,d)};this._onwarning=function(b,c,d){if(a._iO.onwarning)a._iO.onwarning(b,c,d)};this._onfinish=function(){var b=a._iO.onfinish;a._onbufferchange(0);a._resetOnPosition(0);a.instanceCount&&(a.instanceCount--,a.instanceCount||
(x(),a.playState=0,a.paused=!1,a.instanceCount=0,a.instanceOptions={},a._iO={},g(),a.isHTML5&&(a.position=0)),(!a.instanceCount||a._iO.multiShotEvents)&&b&&Y(a,function(){b.apply(a)}))};this._whileloading=function(b,c,d,e){var f=a._iO;a.bytesLoaded=b;a.bytesTotal=c;a.duration=Math.floor(d);a.bufferLength=e;a.durationEstimate=a.isHTML5||f.isMovieStar?a.duration:f.duration?a.duration>f.duration?a.duration:f.duration:parseInt(a.bytesTotal/a.bytesLoaded*a.duration,10);a.isHTML5||(a.buffered=[{start:0,
end:a.duration}]);(3!==a.readyState||a.isHTML5)&&f.whileloading&&f.whileloading.apply(a)};this._whileplaying=function(b,c,d,e,f){var g=a._iO;if(isNaN(b)||null===b)return!1;a.position=Math.max(0,b);a._processOnPosition();!a.isHTML5&&8<m&&(g.usePeakData&&c!==h&&c&&(a.peakData={left:c.leftPeak,right:c.rightPeak}),g.useWaveformData&&d!==h&&d&&(a.waveformData={left:d.split(","),right:e.split(",")}),g.useEQData&&f!==h&&f&&f.leftEQ&&(b=f.leftEQ.split(","),a.eqData=b,a.eqData.left=b,f.rightEQ!==h&&f.rightEQ&&
(a.eqData.right=f.rightEQ.split(","))));1===a.playState&&(a.isHTML5||8!==m||a.position||!a.isBuffering||a._onbufferchange(0),g.whileplaying&&g.whileplaying.apply(a));return!0};this._oncaptiondata=function(b){a.captiondata=b;a._iO.oncaptiondata&&a._iO.oncaptiondata.apply(a,[b])};this._onmetadata=function(b,c){var d={},e,f;e=0;for(f=b.length;e<f;e++)d[b[e]]=c[e];a.metadata=d;a._iO.onmetadata&&a._iO.onmetadata.call(a,a.metadata)};this._onid3=function(b,c){var d=[],e,f;e=0;for(f=b.length;e<f;e++)d[b[e]]=
c[e];a.id3=w(a.id3,d);a._iO.onid3&&a._iO.onid3.apply(a)};this._onconnect=function(b){b=1===b;if(a.connected=b)a.failures=0,p(a.id)&&(a.getAutoPlay()?a.play(h,a.getAutoPlay()):a._iO.autoLoad&&a.load()),a._iO.onconnect&&a._iO.onconnect.apply(a,[b])};this._ondataerror=function(b){0<a.playState&&a._iO.ondataerror&&a._iO.ondataerror.apply(a)}};wa=function(){return n.body||n.getElementsByTagName("div")[0]};aa=function(b){return n.getElementById(b)};w=function(b,e){var d=b||{},a,f;a=e===h?c.defaultOptions:
e;for(f in a)a.hasOwnProperty(f)&&d[f]===h&&(d[f]="object"!==typeof a[f]||null===a[f]?a[f]:w(d[f],a[f]));return d};Y=function(b,c){b.isHTML5||8!==m?c():g.setTimeout(c,0)};ba={onready:1,ontimeout:1,defaultOptions:1,flash9Options:1,movieStarOptions:1};ra=function(b,e){var d,a=!0,f=e!==h,g=c.setupOptions;for(d in b)if(b.hasOwnProperty(d))if("object"!==typeof b[d]||null===b[d]||b[d]instanceof Array||b[d]instanceof RegExp)f&&ba[e]!==h?c[e][d]=b[d]:g[d]!==h?(c.setupOptions[d]=b[d],c[d]=b[d]):ba[d]===h?
a=!1:c[d]instanceof Function?c[d].apply(c,b[d]instanceof Array?b[d]:[b[d]]):c[d]=b[d];else if(ba[d]===h)a=!1;else return ra(b[d],d);return a};r=function(){function b(a){a=hb.call(a);var b=a.length;d?(a[1]="on"+a[1],3<b&&a.pop()):3===b&&a.push(!1);return a}function c(b,e){var h=b.shift(),g=[a[e]];if(d)h[g](b[0],b[1]);else h[g].apply(h,b)}var d=g.attachEvent,a={add:d?"attachEvent":"addEventListener",remove:d?"detachEvent":"removeEventListener"};return{add:function(){c(b(arguments),"add")},remove:function(){c(b(arguments),
"remove")}}}();B={abort:q(function(){}),canplay:q(function(){var b=this._s,c;if(!b._html5_canplay){b._html5_canplay=!0;b._onbufferchange(0);c=b._iO.position===h||isNaN(b._iO.position)?null:b._iO.position/1E3;if(this.currentTime!==c)try{this.currentTime=c}catch(d){}b._iO._oncanplay&&b._iO._oncanplay()}}),canplaythrough:q(function(){var b=this._s;b.loaded||(b._onbufferchange(0),b._whileloading(b.bytesLoaded,b.bytesTotal,b._get_html5_duration()),b._onload(!0))}),durationchange:q(function(){var b=this._s,
c;c=b._get_html5_duration();isNaN(c)||c===b.duration||(b.durationEstimate=b.duration=c)}),ended:q(function(){this._s._onfinish()}),error:q(function(){var b=Xa[this.error.code]||null;this._s._onload(!1);this._s._onerror(this.error.code,b)}),loadeddata:q(function(){var b=this._s;b._loaded||la||(b.duration=b._get_html5_duration())}),loadedmetadata:q(function(){}),loadstart:q(function(){this._s._onbufferchange(1)}),play:q(function(){this._s._onbufferchange(0)}),playing:q(function(){this._s._onbufferchange(0)}),
progress:q(function(b){var c=this._s,d,a,f=0,f=b.target.buffered;d=b.loaded||0;var h=b.total||1;c.buffered=[];if(f&&f.length){d=0;for(a=f.length;d<a;d++)c.buffered.push({start:1E3*f.start(d),end:1E3*f.end(d)});f=1E3*(f.end(0)-f.start(0));d=Math.min(1,f/(1E3*b.target.duration))}isNaN(d)||(c._whileloading(d,h,c._get_html5_duration()),d&&h&&d===h&&B.canplaythrough.call(this,b))}),ratechange:q(function(){}),suspend:q(function(b){var c=this._s;B.progress.call(this,b);c._onsuspend()}),stalled:q(function(){}),
timeupdate:q(function(){this._s._onTimer()}),waiting:q(function(){this._s._onbufferchange(1)})};ja=function(b){return b&&(b.type||b.url||b.serverURL)?b.serverURL||b.type&&Z(b.type)?!1:b.type?X({type:b.type}):X({url:b.url})||c.html5Only||b.url.match(/data:/i):!1};ka=function(b){var e;b&&(e=la?"about:blank":c.html5.canPlayType("audio/wav")?"data:audio/wave;base64,/UklGRiYAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQIAAAD//w==":"about:blank",b.src=e,b._called_unload!==h&&(b._called_load=!1));y&&(Ea=
null);return e};X=function(b){if(!c.useHTML5Audio||!c.hasHTML5)return!1;var e=b.url||null;b=b.type||null;var d=c.audioFormats,a;if(b&&c.html5[b]!==h)return c.html5[b]&&!Z(b);if(!C){C=[];for(a in d)d.hasOwnProperty(a)&&(C.push(a),d[a].related&&(C=C.concat(d[a].related)));C=new RegExp("\\.("+C.join("|")+")(\\?.*)?$","i")}(a=e?e.toLowerCase().match(C):null)&&a.length?a=a[1]:b&&(e=b.indexOf(";"),a=(-1!==e?b.substr(0,e):b).substr(6));a&&c.html5[a]!==h?e=c.html5[a]&&!Z(a):(b="audio/"+a,e=c.html5.canPlayType({type:b}),
e=(c.html5[a]=e)&&c.html5[b]&&!Z(b));return e};Ya=function(){function b(a){var b,d=b=!1;if(!e||"function"!==typeof e.canPlayType)return b;if(a instanceof Array){k=0;for(b=a.length;k<b;k++)if(c.html5[a[k]]||e.canPlayType(a[k]).match(c.html5Test))d=!0,c.html5[a[k]]=!0,c.flash[a[k]]=!!a[k].match(cb);b=d}else a=e&&"function"===typeof e.canPlayType?e.canPlayType(a):!1,b=!(!a||!a.match(c.html5Test));return b}if(!c.useHTML5Audio||!c.hasHTML5)return u=c.html5.usingFlash=!0,!1;var e=Audio!==h?Ja&&10>opera.version()?
new Audio(null):new Audio:null,d,a,f={},g,k;g=c.audioFormats;for(d in g)if(g.hasOwnProperty(d)&&(a="audio/"+d,f[d]=b(g[d].type),f[a]=f[d],d.match(cb)?(c.flash[d]=!0,c.flash[a]=!0):(c.flash[d]=!1,c.flash[a]=!1),g[d]&&g[d].related))for(k=g[d].related.length-1;0<=k;k--)f["audio/"+g[d].related[k]]=f[d],c.html5[g[d].related[k]]=f[d],c.flash[g[d].related[k]]=f[d];f.canPlayType=e?b:null;c.html5=w(c.html5,f);c.html5.usingFlash=Wa();u=c.html5.usingFlash;return!0};I={};S=function(){};fa=function(b){8===m&&
1<b.loops&&b.stream&&(b.stream=!1);return b};ga=function(b,c){b&&!b.usePolicyFile&&(b.onid3||b.usePeakData||b.useWaveformData||b.useEQData)&&(b.usePolicyFile=!0);return b};oa=function(){return!1};ya=function(b){for(var c in b)b.hasOwnProperty(c)&&"function"===typeof b[c]&&(b[c]=oa)};za=function(b){b===h&&(b=!1);(A||b)&&c.disable(b)};Sa=function(b){var e=null;if(b)if(b.match(/\.swf(\?.*)?$/i)){if(e=b.substr(b.toLowerCase().lastIndexOf(".swf?")+4))return b}else b.lastIndexOf("/")!==b.length-1&&(b+=
"/");b=(b&&-1!==b.lastIndexOf("/")?b.substr(0,b.lastIndexOf("/")+1):"./")+c.movieURL;c.noSWFCache&&(b+="?ts="+(new Date).getTime());return b};ua=function(){m=parseInt(c.flashVersion,10);8!==m&&9!==m&&(c.flashVersion=m=8);var b=c.debugMode||c.debugFlash?"_debug.swf":".swf";c.useHTML5Audio&&!c.html5Only&&c.audioFormats.mp4.required&&9>m&&(c.flashVersion=m=9);c.version=c.versionNumber+(c.html5Only?" (HTML5-only mode)":9===m?" (AS3/Flash 9)":" (AS2/Flash 8)");8<m?(c.defaultOptions=w(c.defaultOptions,
c.flash9Options),c.features.buffering=!0,c.defaultOptions=w(c.defaultOptions,c.movieStarOptions),c.filePatterns.flash9=new RegExp("\\.(mp3|"+eb.join("|")+")(\\?.*)?$","i"),c.features.movieStar=!0):c.features.movieStar=!1;c.filePattern=c.filePatterns[8!==m?"flash9":"flash8"];c.movieURL=(8===m?"soundmanager2.swf":"soundmanager2_flash9.swf").replace(".swf",b);c.features.peakData=c.features.waveformData=c.features.eqData=8<m};Ra=function(b,c){k&&k._setPolling(b,c)};xa=function(){};p=this.getSoundById;
K=function(){var b=[];c.debugMode&&b.push("sm2_debug");c.debugFlash&&b.push("flash_debug");c.useHighPerformance&&b.push("high_performance");return b.join(" ")};Ba=function(){S("fbHandler");var b=c.getMoviePercent(),e={type:"FLASHBLOCK"};c.html5Only||(c.ok()?c.oMC&&(c.oMC.className=[K(),"movieContainer","swf_loaded"+(c.didFlashBlock?" swf_unblocked":"")].join(" ")):(u&&(c.oMC.className=K()+" movieContainer "+(null===b?"swf_timedout":"swf_error")),c.didFlashBlock=!0,E({type:"ontimeout",ignoreInit:!0,
error:e}),J(e)))};sa=function(b,c,d){x[b]===h&&(x[b]=[]);x[b].push({method:c,scope:d||null,fired:!1})};E=function(b){b||(b={type:c.ok()?"onready":"ontimeout"});if(!l&&b&&!b.ignoreInit||"ontimeout"===b.type&&(c.ok()||A&&!b.ignoreInit))return!1;var e={success:b&&b.ignoreInit?c.ok():!A},d=b&&b.type?x[b.type]||[]:[],a=[],f,e=[e],h=u&&!c.ok();b.error&&(e[0].error=b.error);b=0;for(f=d.length;b<f;b++)!0!==d[b].fired&&a.push(d[b]);if(a.length)for(b=0,f=a.length;b<f;b++)a[b].scope?a[b].method.apply(a[b].scope,
e):a[b].method.apply(this,e),h||(a[b].fired=!0);return!0};G=function(){g.setTimeout(function(){c.useFlashBlock&&Ba();E();"function"===typeof c.onload&&c.onload.apply(g);c.waitForWindowLoad&&r.add(g,"load",G)},1)};Fa=function(){if(z!==h)return z;var b=!1,c=navigator,d,a=g.ActiveXObject,f;try{f=c.plugins}catch(k){f=void 0}if(f&&f.length)(c=c.mimeTypes)&&c["application/x-shockwave-flash"]&&c["application/x-shockwave-flash"].enabledPlugin&&c["application/x-shockwave-flash"].enabledPlugin.description&&
(b=!0);else if(a!==h&&!t.match(/MSAppHost/i)){try{d=new a("ShockwaveFlash.ShockwaveFlash")}catch(n){d=null}b=!!d}return z=b};Wa=function(){var b,e,d=c.audioFormats;Ha&&t.match(/os (1|2|3_0|3_1)\s/i)?(c.hasHTML5=!1,c.html5Only=!0,c.oMC&&(c.oMC.style.display="none")):!c.useHTML5Audio||c.html5&&c.html5.canPlayType||(c.hasHTML5=!1);if(c.useHTML5Audio&&c.hasHTML5)for(e in W=!0,d)d.hasOwnProperty(e)&&d[e].required&&(c.html5.canPlayType(d[e].type)?c.preferFlash&&(c.flash[e]||c.flash[d[e].type])&&(b=!0):
(W=!1,b=!0));c.ignoreFlash&&(b=!1,W=!0);c.html5Only=c.hasHTML5&&c.useHTML5Audio&&!b;return!c.html5Only};ia=function(b){var e,d,a=0;if(b instanceof Array){e=0;for(d=b.length;e<d;e++)if(b[e]instanceof Object){if(c.canPlayMIME(b[e].type)){a=e;break}}else if(c.canPlayURL(b[e])){a=e;break}b[a].url&&(b[a]=b[a].url);b=b[a]}return b};Ta=function(b){b._hasTimer||(b._hasTimer=!0,!ma&&c.html5PollingInterval&&(null===U&&0===ha&&(U=setInterval(Va,c.html5PollingInterval)),ha++))};Ua=function(b){b._hasTimer&&(b._hasTimer=
!1,!ma&&c.html5PollingInterval&&ha--)};Va=function(){var b;if(null===U||ha)for(b=c.soundIDs.length-1;0<=b;b--)c.sounds[c.soundIDs[b]].isHTML5&&c.sounds[c.soundIDs[b]]._hasTimer&&c.sounds[c.soundIDs[b]]._onTimer();else clearInterval(U),U=null};J=function(b){b=b!==h?b:{};"function"===typeof c.onerror&&c.onerror.apply(g,[{type:b.type!==h?b.type:null}]);b.fatal!==h&&b.fatal&&c.disable()};Za=function(){if(ab&&Fa()){var b=c.audioFormats,e,d;for(d in b)if(b.hasOwnProperty(d)&&("mp3"===d||"mp4"===d)&&(c.html5[d]=
!1,b[d]&&b[d].related))for(e=b[d].related.length-1;0<=e;e--)c.html5[b[d].related[e]]=!1}};this._setSandboxType=function(b){};this._externalInterfaceOK=function(b){c.swfLoaded||(c.swfLoaded=!0,na=!1,ab&&Za(),setTimeout(pa,D?100:1))};ea=function(b,e){function d(a,b){return'<param name="'+a+'" value="'+b+'" />'}if(N&&O)return!1;if(c.html5Only)return ua(),c.oMC=aa(c.movieID),pa(),O=N=!0,!1;var a=e||c.url,f=c.altURL||a,g=wa(),k=K(),m=null,m=n.getElementsByTagName("html")[0],l,q,p,m=m&&m.dir&&m.dir.match(/rtl/i);
b=b===h?c.id:b;ua();c.url=Sa(La?a:f);e=c.url;c.wmode=!c.wmode&&c.useHighPerformance?"transparent":c.wmode;null!==c.wmode&&(t.match(/msie 8/i)||!D&&!c.useHighPerformance)&&navigator.platform.match(/win32|win64/i)&&(V.push(I.spcWmode),c.wmode=null);g={name:b,id:b,src:e,quality:"high",allowScriptAccess:c.allowScriptAccess,bgcolor:c.bgColor,pluginspage:jb+"www.macromedia.com/go/getflashplayer",title:"JS/Flash audio component (SoundManager 2)",type:"application/x-shockwave-flash",wmode:c.wmode,hasPriority:"true"};
c.debugFlash&&(g.FlashVars="debug=1");c.wmode||delete g.wmode;if(D)a=n.createElement("div"),q=['<object id="'+b+'" data="'+e+'" type="'+g.type+'" title="'+g.title+'" classid="clsid:D27CDB6E-AE6D-11cf-96B8-444553540000" codebase="http://download.macromedia.com/pub/shockwave/cabs/flash/swflash.cab#version=6,0,40,0">',d("movie",e),d("AllowScriptAccess",c.allowScriptAccess),d("quality",g.quality),c.wmode?d("wmode",c.wmode):"",d("bgcolor",c.bgColor),d("hasPriority","true"),c.debugFlash?d("FlashVars",g.FlashVars):
"","</object>"].join("");else for(l in a=n.createElement("embed"),g)g.hasOwnProperty(l)&&a.setAttribute(l,g[l]);xa();k=K();if(g=wa())if(c.oMC=aa(c.movieID)||n.createElement("div"),c.oMC.id)p=c.oMC.className,c.oMC.className=(p?p+" ":"movieContainer")+(k?" "+k:""),c.oMC.appendChild(a),D&&(l=c.oMC.appendChild(n.createElement("div")),l.className="sm2-object-box",l.innerHTML=q),O=!0;else{c.oMC.id=c.movieID;c.oMC.className="movieContainer "+k;l=k=null;c.useFlashBlock||(c.useHighPerformance?k={position:"fixed",
width:"8px",height:"8px",bottom:"0px",left:"0px",overflow:"hidden"}:(k={position:"absolute",width:"6px",height:"6px",top:"-9999px",left:"-9999px"},m&&(k.left=Math.abs(parseInt(k.left,10))+"px")));ib&&(c.oMC.style.zIndex=1E4);if(!c.debugFlash)for(p in k)k.hasOwnProperty(p)&&(c.oMC.style[p]=k[p]);try{D||c.oMC.appendChild(a),g.appendChild(c.oMC),D&&(l=c.oMC.appendChild(n.createElement("div")),l.className="sm2-object-box",l.innerHTML=q),O=!0}catch(r){throw Error(S("domError")+" \n"+r.toString());}}return N=
!0};da=function(){if(c.html5Only)return ea(),!1;if(k||!c.url)return!1;k=c.getMovie(c.id);k||(R?(D?c.oMC.innerHTML=Aa:c.oMC.appendChild(R),R=null,N=!0):ea(c.id,c.url),k=c.getMovie(c.id));"function"===typeof c.oninitmovie&&setTimeout(c.oninitmovie,1);return!0};H=function(){setTimeout(Qa,1E3)};ta=function(){g.setTimeout(function(){c.setup({preferFlash:!1}).reboot();c.didFlashBlock=!0;c.beginDelayedInit()},1)};Qa=function(){var b,e=!1;c.url&&!T&&(T=!0,r.remove(g,"load",H),z&&na&&!Ka||(l||(b=c.getMoviePercent(),
0<b&&100>b&&(e=!0)),setTimeout(function(){b=c.getMoviePercent();e?(T=!1,g.setTimeout(H,1)):!l&&bb&&(null===b?c.useFlashBlock||0===c.flashLoadTimeout?c.useFlashBlock&&Ba():!c.useFlashBlock&&W?ta():E({type:"ontimeout",ignoreInit:!0,error:{type:"INIT_FLASHBLOCK"}}):0!==c.flashLoadTimeout&&(!c.useFlashBlock&&W?ta():za(!0)))},c.flashLoadTimeout)))};ca=function(){if(Ka||!na)return r.remove(g,"focus",ca),!0;Ka=bb=!0;T=!1;H();r.remove(g,"focus",ca);return!0};P=function(b){if(l)return!1;if(c.html5Only)return l=
!0,G(),!0;var e=!0,d;c.useFlashBlock&&c.flashLoadTimeout&&!c.getMoviePercent()||(l=!0);d={type:!z&&u?"NO_FLASH":"INIT_TIMEOUT"};if(A||b)c.useFlashBlock&&c.oMC&&(c.oMC.className=K()+" "+(null===c.getMoviePercent()?"swf_timedout":"swf_error")),E({type:"ontimeout",error:d,ignoreInit:!0}),J(d),e=!1;A||(c.waitForWindowLoad&&!qa?r.add(g,"load",G):G());return e};Pa=function(){var b,e=c.setupOptions;for(b in e)e.hasOwnProperty(b)&&(c[b]===h?c[b]=e[b]:c[b]!==e[b]&&(c.setupOptions[b]=c[b]))};pa=function(){if(l)return!1;
if(c.html5Only)return l||(r.remove(g,"load",c.beginDelayedInit),c.enabled=!0,P()),!0;da();try{k._externalInterfaceTest(!1),Ra(!0,c.flashPollingInterval||(c.useHighPerformance?10:50)),c.debugMode||k._disableDebug(),c.enabled=!0,c.html5Only||r.add(g,"unload",oa)}catch(b){return J({type:"JS_TO_FLASH_EXCEPTION",fatal:!0}),za(!0),P(),!1}P();r.remove(g,"load",c.beginDelayedInit);return!0};F=function(){if(Q)return!1;Q=!0;Pa();xa();!z&&c.hasHTML5&&c.setup({useHTML5Audio:!0,preferFlash:!1});Ya();!z&&u&&(V.push(I.needFlash),
c.setup({flashLoadTimeout:1}));n.removeEventListener&&n.removeEventListener("DOMContentLoaded",F,!1);da();return!0};Da=function(){"complete"===n.readyState&&(F(),n.detachEvent("onreadystatechange",Da));return!0};va=function(){qa=!0;F();r.remove(g,"load",va)};Fa();r.add(g,"focus",ca);r.add(g,"load",H);r.add(g,"load",va);n.addEventListener?n.addEventListener("DOMContentLoaded",F,!1):n.attachEvent?n.attachEvent("onreadystatechange",Da):J({type:"NO_DOM2_EVENTS",fatal:!0})}if(!g||!g.document)throw Error("SoundManager requires a browser with window and document objects.");
var M=null;g.SM2_DEFER!==h&&SM2_DEFER||(M=new v);"object"===typeof module&&module&&"object"===typeof module.exports?(module.exports.SoundManager=v,module.exports.soundManager=M):"function"===typeof define&&define.amd&&define(function(){return{constructor:v,getInstance:function(h){!g.soundManager&&h instanceof Function&&(h=h(v),h instanceof v&&(g.soundManager=h));return g.soundManager}}});g.SoundManager=v;g.soundManager=M})(window);

// init
soundManager.setup({
  url: '/WebSpeech/soundmanager2',
  debugMode: false,
  onready: function() { WebSpeech.onready(); }
});

if (WebSpeech.debug) {
  console.log('browser: ' + navigator.userAgent);
}

if (navigator.userAgent.indexOf('Android 4.4') > 0) {
  WebSpeech.cacheMaxCount = 0;
}
  //soundManager.flashVersion = 9;

var g_try_times = 0;
window.onerror = function (errorMsg, url, lineNumber) {
  if (WebSpeech.state === 'SPEAKHTML') {
    if (g_try_times < 3) {
      g_try_times++;
      WebSpeech.playNextSpeech();
    }
  }
  //console.log('Error: ' + errorMsg + ' Script: ' + url + ' Line: ' + lineNumber);
}

}

(function() {
  WebSpeech.srInit();
})();
