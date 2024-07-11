//
// AJAST- Asynchronous Javascript and Script Tags v1.0
//
// Copyright (c) 2009, Jason Riffel
// All rights reserved.
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are met:
//     * Redistributions of source code must retain the above copyright
//       notice, this list of conditions and the following disclaimer.
//     * Redistributions in binary form must reproduce the above copyright
//       notice, this list of conditions and the following disclaimer in the
//       documentation and/or other materials provided with the distribution.
//     * Neither the name of the orgranization nor the
//       names of its contributors may be used to endorse or promote products
//       derived from this software without specific prior written permission.
//
// THIS SOFTWARE IS PROVIDED BY Jason Riffel ''AS IS'' AND ANY
// EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
// WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
// DISCLAIMED. IN NO EVENT SHALL Jason Riffel  BE LIABLE FOR ANY
// DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
// (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
// LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
// ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
// (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
// SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
//
// AJAST is a library that implements a Javascript objected named JsHttpRequest
// which can be used in place of the standard XmlHttpRequest object for
// performing AJAX requests. The main advantage of AJAST is its ability to make
// requests to foreign hosts which a standard AJAX request cannot do.
//
// The form of the request is:
//
// http[s]://[host]/[path]/jsproxy.js?ajast_s=s&ajast_l=l[&ajast_k=k]&ajast_p=p
//
// Where:
//
// ajast_s - The sequence number, required to generate unique global return
//           value variables in the return javascript. This should be unique
//           per transaction for any given client.
//
// ajast_l - The total length of the entire post payload being sent.
//
// ajast_p - The post being proxied to the remote host. This entire post may
//           not be accepted completely by the proxy, in which case the http
//           status code 100 'Continue' will be returned.  The HTTP status
//           string will contain a continuation key and the total length
//           received so far.
//
// ajast_k - The continuation key which was provided in the status text response
//           of a 100 'Continue' which was issued because they entire payload was
//           not recieved.  The client must send this along with the continued
//           payload to complete a transaction so the server can stitch the
//           partial deliveries back together before proceding.
//
// The form of the response is a javascript source file containing:
//
// AJAST.INCOMING.tN.status
//
//   This will be set to valid HTTP result status codes most likely from the
//   remote host except in proxy error cases and partial upload in which case
//   100 (Continue) will be returned.
//
// AJAST.INCOMING.tN.statusText
//
//   This value contains the statusText string from the remote host or proxy
//   describing the result of the last transaction.
//
// AJAST.INCOMING.tN.responseText
//
//   This value contains the payload returned form the remote server if any.
//   In partial messages or error cases in the proxy this value will be a blank
//   string.
//
// WHERE: tN = 't' + Sequence
//

// Create and use AJAST namespace to avoid conflicts and pollution of the 
// global namespace.
if (typeof AJAST == 'undefined') AJAST = {};

(function () 
{
  // A unique sequence number to each request which can be integrated into 
  // the global variables returned by the javascript file responses.  This 
  // is far better than using global variables in the javascript payload 
  // which can collide.
  if (typeof AJAST.Sequence == 'undefined') AJAST.Sequence = 0;

  // My research shows IE has a hard limit of URL length of 2083 while other 
  // mainstream browsers have much higher, if not unlimited lengths.  We'll 
  // use 2083 as the default for everyone.
  if (typeof AJAST.MaxPost == 'undefined') AJAST.MaxURL = 2083;

  // The configuration for the rate (in MS) in which the browser polls for 
  // the results and checks for timeout.
  if (typeof AJAST.pollingInterval == 'undefined') AJAST.pollingInterval = 25;

  // The configuration for the maximum amount (in MS) of time any request can 
  // take before a failure is reported.
  if (typeof AJAST.maxInterval == 'undefined') AJAST.maxInterval = 15000;

  // Use an internal namespace of 'INCOMING' for inbound request variables so
  // we keep from polluting our own name space.  In a worst case scenario we can
  // prune the INCOMING namespace for garbage collection if we start losing
  // track of our own requests without impacting our other members.
  if (typeof AJAST.INCOMING == 'undefined') AJAST.INCOMING = {};

  if (typeof AJAST.JsHttpRequest == 'undefined') AJAST.JsHttpRequest = function()
  {
    var me = this; // Who am I?

    // ----------------------------------------------------------------------------
    // Public properties
    // ----------------------------------------------------------------------------
    me.readyState      = 0;
    me.status          = 404;
    me.statusText      = 'Requested resource cannot be accessed at this time';
    me.responseText    = '';
    me.responseXML     = null;
    me.elapsedTime     = 0;
    me.sequence        = ++AJAST.Sequence;
    me.maxInterval     = AJAST.maxInterval;
    me.pollingInterval = AJAST.pollingInterval;
    
    // ----------------------------------------------------------------------------
    // Stubbed functions
    // ----------------------------------------------------------------------------
    // Overriden by caller as needed
    me.setRequestHeader    = function() {}
    me.onreadystatechange  = function() {}
    me.respondToReadyState = function() {}

    // Probably should not be overridden, just for compatibility
    me.setRequestHeader      = function () {}
    me.getResponseHeader     = function () { return ''; }
    me.getAllResponseHeaders = function () { return ''; }
    
    // ----------------------------------------------------------------------------
    // Public functions
    // ----------------------------------------------------------------------------
    me.initialize = function() { me.readyState = 0; }
    
    me.open = function(method, url, asynchronous) 
    {
      me.readyState = 1;
      me.respondToReadyState(1);
      me.onreadystatechange();

      // Inject the sequence number and record the URL
      if (url.match(/\?/)) _url = url.replace(/\?/, '?s=' + me.sequence + '&');
      else _url = url + '?ajast_s=' + me.sequence;
    }

    me.send = function(body) 
    {
      // Prepare simulated post into _post if capable
      if (typeof body != 'undefined')
      {
        if (typeof body == 'object')
        {
          if (typeof JSON == 'undefined')
          {
            me.status = 400;
            me.statusText = 'AJAST does not support sending native Javascript objects without first loading json2.js from http://www.json.org';
            return callback(); // Callback will finish the request with an error to the caller
          }
          else _post = JSON.stringify(body);
        }
        else _post = body;
      }

      me.readyState = 2;
      me.onreadystatechange();
      generateScriptTag(_url, 0);
    }

    // Flag as aborted to stop callbacks, try and unload the script tag
    me.abort = function () 
    {
      // Kill the timer if it is still active
      if (_checkTimer) clearInterval(_checkTimer); _checkTimer = null;

      // Enforce aborted status and only allow one call to callback per instance
      if (_aborted) return; _aborted = true; 

      collectGarbage(); // Clean up
    }

    // ----------------------------------------------------------------------------
    // Private properties
    // ----------------------------------------------------------------------------
    var _head = document.getElementsByTagName('HEAD')[0];
    var _startTime = new Date().getTime();
    var _aborted = false;
    var _post = null;
    var _node;
    var _url;
    
    // Polling mechanism for webkit browsers
    var _timepassed = 0;
    var _checkTimer = null;

    // ----------------------------------------------------------------------------
    // Private functions
    // ----------------------------------------------------------------------------
    // The file has loaded, harvest the results from the global variables mashed 
    // with the sequence and notify the client  
    function callback()
    {
      // Kill the timer if it is still active
      if (_checkTimer) clearInterval(_checkTimer); _checkTimer = null;

      // Enforce aborted status and only allow one call to callback per instance
      if (_aborted) return; _aborted = true;

      var t;
      t = getResponseValue('status');       if (t != null) me.status       = t;
      t = getResponseValue('statusText');   if (t != null) me.statusText   = t;
      t = getResponseValue('responseText'); if (t != null) me.responseText = t;

      collectExtras(); // Our nice little extension

      collectGarbage(); // Clean up after ourselves

      // Use try catch to create responseXML, result to NULL on failure
      if (me.responseText.match(/\s*</)) // Appears to contain XML
      {
        try 
        { 
          var parser = new DOMParser();
          me.responseXML = parser.parseFromString(me.responseText, "text/xml"); 
        } 
        catch(e) { me.responseXML = null; }
      }
      
      // Check for post which spans multiple requests
      if (me.status == 100 && _post)
      {
        // Decode: 'Continue at 1377 with key 907' for the offset and key
        var pieces = me.statusText.split(/\s+/);
        try { return generateScriptTag(_url, pieces[2], pieces[5]); } catch(e) { }
      }
      
      // Calculate the elapsed time
      var _endTime = new Date().getTime();
      me.elapsedTime = (_endTime - _startTime) / 1000;

      me.readyState = 4;
      me.onreadystatechange();
    }

    function generateScriptTag(url, postOffset, key)
    {
      // Handle simulated post
      if (_post)
      {
        // Compose the prefix, all leading query data before payload
        var prefix = '&ajast_l=' + _post.length;
        if (key) prefix += '&ajast_k=' + key;
        prefix += '&ajast_p=';

        // Glue together a query string minding the configured maximum length
        var maxPostLen = AJAST.MaxURL - (url.length + prefix.length);
        var payload = encodeURIComponent(_post.substring(postOffset)).substring(0, maxPostLen);
        url += prefix + payload;

        // Need to ensure that a URL encoded character is not split across the end of 
        // the payload, check for a % character in the last 2 bytes... if so strip it off.
        if (url.length == AJAST.MaxURL)
        {
          var offset = url.substring(url.length-2).indexOf('%');
          if (offset > -1) url = url.substring(0, url.length - (2 - offset));
        }
      }

      // Generate <script> node
      _node = document.createElement('script');
      _node.type = 'text/javascript';
      _node.src = url;

      // Notification strategy - Instead of using browser detection employ all three notification
      // strategies in parallel.  This gets us simpler and more reliable code and also adds timeout
      // support for all browser types in an easier way.

      // Gecko based browsers like FireFox will fire the onload method
      _node.onload = function() { callback(); } 

      // IE will fire onreadystatechange events onto the script tag, detect load with that
      _node.onreadystatechange = function()
      {
        if (this.readyState == "complete" || this.readyState == "loaded") 
          return callback();
      }

      // WebKit browsers do not support either of the previous messages so we employ a polling
      // mechanism.  The benefit of the polling mechanism is that the timeout gets applied to
      // all browser types.
      _checkTimer = setInterval(function()
      {
        _timepassed += me.pollingInterval;
        if (null != getResponseValue('status') || _timepassed > me.maxInterval)
        {
          clearInterval(_checkTimer);
          callback(); // If max polling interval was exceeded callback will finish the request with an error to the caller
        }
      }, me.pollingInterval);

      // Inject <script> node into <head> of document
      _aborted = false;
      me.readyState = 3;
      me.onreadystatechange();
      _head.appendChild(_node);
    }

    // Try for the proper result using the sequence number
    function getResponseValue(type)
    {
      try // Try for the proper result using the supplied sequence number
      {
        var val = eval('AJAST.INCOMING.t' + me.sequence + '.' + type);
        if (typeof val != 'undefined' && val != null) return val;
      }
      catch(e) {}
      
      return null; // Not found at all
    }

    // Clean up after ourselves
    function collectGarbage()
    {
      try
      {
        // Remove the script node
        _head.removeChild(_node);
        eval('delete AJAST.INCOMING.t' + me.sequence + ';');
      }
      catch(e) {}
    }

    // Extras collection will take any other received values from the response Javascript
    // and make them publicly available on the JsHttpRequest object.  This is useful for
    // returning other types or values directly from the server.
    function collectExtras()
    {
      var response = eval('AJAST.INCOMING.t' + me.sequence);
      if (typeof response == 'undefined') return;

      for (var n in response)
      {
        if (n == 'status')       continue; // Do not mess with the required values
        if (n == 'statusText')   continue;
        if (n == 'responseText') continue;
        me[n] = response[n];
      }
    }
  }
})();

