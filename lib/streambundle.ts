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

var Bacon = require('baconjs');

class StreamBundle {
    selfContext: string;
    buses: {[path: string]: any};
    streams: {[path: string]: any};
    keys: any;
    constructor(selfId) {
        this.selfContext = 'vessels.' + selfId;
        this.buses = {};
        this.streams = {};
        this.keys = new Bacon.Bus();
    }

    pushDelta(delta) {
        if (delta.updates) {
            delta.updates.forEach(update => {
                if (update.values) {
                    update.values.forEach(pathValue => {
                        this.push({
                            path: pathValue.path,
                            value: pathValue.value,
                            context: delta.context,
                            source: update.source,
                            $source: update.$source
                        });
                    }, this)
                }
            }, this);
        }
    }

    push(pathValueWithSourceAndContext) {
        this.getBus(pathValueWithSourceAndContext.path).push(pathValueWithSourceAndContext);
        if (pathValueWithSourceAndContext.context === this.selfContext) {
            this.getSelfStream(pathValueWithSourceAndContext.path).push(pathValueWithSourceAndContext.value);
        }
    }

    getBus(path) {
        var result = this.buses[path];
        if (!result) {
            result = this.buses[path] = new Bacon.Bus();
            this.keys.push(path);
        }
        return result;
    }

    getSelfStream(path) {
        var result = this.streams[path];
        if (!result) {
            result = this.streams[path] = new Bacon.Bus();
        }
        return result;
    }
}

export = StreamBundle;