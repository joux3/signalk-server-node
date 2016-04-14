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

var selfUuid;
const INTERESTING_PATHS = [
  'navigation.position', 'navigation.speedOverGround', 'navigation.courseOverGroundTrue'
];

module.exports = function(app) {
  var accumulator = new Accumulator();
  var onDelta = accumulator.addDelta.bind(accumulator);

  var api = {};

  api.start = function() {
    selfUuid = app.signalk.self.uuid;
    console.log("got self uuid", selfUuid);
    app.signalk.on('delta', onDelta);
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
    console.log(delta.updates[i].timestamp);
    for (var j = 0; j < pathValuesLen; j++) {
      console.log(pathValues[j])
    }
    console.log("---------")
  }
}
