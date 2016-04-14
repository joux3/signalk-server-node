/*
 * Copyright 2016 Teppo Kurki <teppo.kurki@iki.fi>
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

var selfUuid, ws;
const INTERESTING_PATHS = [
  'navigation.position', 'navigation.speedOverGround', 'navigation.courseOverGroundTrue'
];
const RECEIVER_URL = "http://localhost:3005/signalk-input"

module.exports = function(app) {
  var accumulator = new Accumulator();
  var onDelta = accumulator.addDelta.bind(accumulator);

  var api = {};

  api.start = function() {
    selfUuid = app.signalk.self.uuid;
    console.log("got self uuid", selfUuid);
    app.signalk.on('delta', onDelta);
    setInterval(() => {
      if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) {
        return;
      }
      ws = new WebSocket(RECEIVER_URL);
      ws.on('open', () => {
        console.log("connected to receiver!")
        ws.send('silvio');
      })
      ws.on('error', () => {
        console.log("some error in connection")
        ws = null;
      })
      ws.on('close', () => {
        console.log("connection closed")
      })
    }, 1000);
  };

  api.stop = function() {
    app.signalk.removeListener('delta', onDelta);
  };

  return api;
};


function Accumulator() {
}

Accumulator.prototype.addDelta = function(delta) {
  const isSelf = delta.context === ("vessels." + selfUuid);
  if (!isSelf) {
    return;
  }
  var updateLen = delta.updates ? delta.updates.length : 0;
  for (var i = 0; i < updateLen; i++) {
    var pathValues = delta.updates[i].values;
    var pathValuesLen = pathValues.length;
    for (var j = 0; j < pathValuesLen; j++) {
      const update = {
        timestamp: delta.updates[i].timestamp,
        path: pathValues[j].path,
        value: pathValues[j].value
      }
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(update));
      }
    }
  }
}
