/*
 * Copyright 2016 Teppo Kurki <teppo.kurki@iki.fi>, Antti Risteli
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0

 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const WebSocket = require('ws');

// 10k items in queue is less than 100M of heap usage
const MAX_SEND_QUEUE = 10000; 
const MAX_INFLIGHT_MESSAGES = 100;
const INTERESTING_PATHS = [
  'navigation.position', 'navigation.speedOverGround', 'navigation.courseOverGroundTrue'
];
const RECEIVER_URL = process.env.SIGNALK_CLOUD_RECEIVER || "http://localhost:3005/signalk-input"

var selfUuid, ws, lastSentMsgId = 1;
var sendQueue = [];
var waitingForAck = {};
var sentDates = {};

module.exports = function(app) {
  var api = {};

  api.start = function() {
    selfUuid = app.signalk.self.uuid;
    doLog("got self uuid", selfUuid);
    app.signalk.on('delta', onDelta);
    setInterval(() => {
      if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) {
        return;
      }
      ws = new WebSocket(RECEIVER_URL);
      ws.on('message', onMessage)
      ws.on('open', () => {
        doLog("connected to receiver!")
        ws.send('silvio');
        sendNextIfNeeded();
      })
      ws.on('error', () => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          resetWaitingForAck();
          doLog("connection error")
        }
        ws = null;
      })
      ws.on('close', () => {
        doLog("connection closed")
        resetWaitingForAck();
      })
    }, 1000);
  };

  api.stop = function() {
    app.signalk.removeListener('delta', onDelta);
  };

  return api;
};


function onDelta(delta) {
  // TODO: no reason to send deltas for stuff that hasn't changed at all
  //       and the last sent one was very close
  const isSelf = delta.context === ("vessels." + selfUuid);
  if (!isSelf) {
    return;
  }
  var updateLen = delta.updates ? delta.updates.length : 0;
  if (updateLen > 0) {
    if (sendQueue.length === MAX_SEND_QUEUE) {
      sendQueue.shift();
    }
    sendQueue.push(delta);
    sendNextIfNeeded();
  }
  /*for (var i = 0; i < updateLen; i++) {
    var pathValues = delta.updates[i].values;
    var pathValuesLen = pathValues.length;
    for (var j = 0; j < pathValuesLen; j++) {
      const update = {
        timestamp: delta.updates[i].timestamp,
        path: pathValues[j].path,
        value: pathValues[j].value
      }
      if (sendQueue.length === MAX_SEND_QUEUE) {
        sendQueue.shift();
      }
      console.log(JSON.stringify(update));
      sendQueue.push(update);
      sendNextIfNeeded();
    }
  }*/
}

function onMessage(msg) {
  const parsed = tryParseJSON(msg);
  if (!parsed) {
    return;
  }

  if (typeof parsed.ACK === 'number' || typeof parsed.INVALID === 'number') {
    // ACK & INVALID don't require resend
    const msgId = typeof parsed.ACK === 'number' ? parsed.ACK : parsed.INVALID;
    doLog("ACK latency "+(new Date() - sentDates[msgId]));
    delete waitingForAck[msgId];
    delete sentDates[msgId];
    sendNextIfNeeded();
  } else if (typeof parsed.ERRACK === 'number') {
    // TODO: send again
    delete waitingForAck[parsed.ERRACK];
    sendNextIfNeeded();
  }
}

function sendNextIfNeeded() {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return;
  }

  while (Object.keys(waitingForAck).length < MAX_INFLIGHT_MESSAGES && sendQueue.length > 0) {
    var deltaUpdate = sendQueue.pop();
    deltaUpdate.msgId = lastSentMsgId++;
    waitingForAck[deltaUpdate.msgId] = deltaUpdate;
    sentDates[deltaUpdate.msgId] = new Date();
    ws.send(JSON.stringify(deltaUpdate));
    doLog("sent msg " + deltaUpdate.msgId + " queue len " + sendQueue.length);
  }
}

function tryParseJSON(string) {
  try {
    return JSON.parse(string);
  } catch (e) {
    return null;
  }
}

function resetWaitingForAck() {
  var keys = Object.keys(waitingForAck);
  keys.forEach((packetId) => {
    sendQueue.push(waitingForAck[packetId]);
    doLog("removing " + packetId + " from waitingForAck")
  })
  waitingForAck = {};
  sentDates = {};
}

function doLog(str) {
  console.log(new Date().toISOString() + ": " + str)
}
