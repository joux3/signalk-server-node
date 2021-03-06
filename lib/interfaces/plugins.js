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

var debug = require('debug')('signalk:interfaces:plugins')
var fs = require('fs')
var path = require('path')
var express = require('express')

module.exports = function(app) {

  return {
    start: function() {
      startPlugins(app)

      ensureExists(path.join(__dirname, "../../plugin-config-data"));

      app.use('/plugins/configure', express.static(path.join(__dirname, '/../../plugin-config/public')));

      router = express.Router();

      app.get('/plugins', function(req, res, next) {
        res.json(app.plugins.map((plugin) => {
          var data = null
          try {
            data = JSON.parse(fs.readFileSync(pathForPluginId(plugin.id), 'utf8'))
          } catch (e) {
            console.log(e.code + " " + e.path)
          }
          return {
            id: plugin.id,
            name: plugin.name,
            description: plugin.description,
            schema: plugin.schema,
            state: plugin.state,
            data: data
          }
        }))
      });
    }
  }
};

function ensureExists(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }
}

function pathForPluginId(id) {
  return path.join(__dirname, "../../plugin-config-data", id + '.json')
}

function getPluginOptions(id) {
  try
  {
    const optionsAsString = fs.readFileSync(pathForPluginId(id), 'utf8');
    try {
      return JSON.parse(optionsAsString)
    } catch (e) {
      console.error("Could not parse JSON options:" + optionsAsString);
      return {}
    }
  } catch (e) {
    debug("Could not find options for plugin " + id + ", returning empty options")
    return {}
  }
  return JSON.parse()
}

function startPlugins(app) {
  app.plugins = []
  fs.readdirSync('./node_modules/').filter(name => name != '.bin').forEach(pluginName => {
    var metadata;
    try {
      metadata = require('../../node_modules/' + pluginName + '/package.json')
    } catch (e) {
      console.log(e)
    }
    if (metadata && metadata.keywords && metadata.keywords.includes('signalk-node-server-plugin')) {
      registerPlugin(app, pluginName)
    }
  })
}

function registerPlugin(app, pluginName) {
  debug('Registering plugin ' + pluginName)
  const plugin = require(pluginName)(app)
  const options = getPluginOptions(plugin.id)
  const restart = (newConfiguration) => {
    const pluginOptions = getPluginOptions(plugin.id)
    pluginOptions.configuration = newConfiguration
    fs.writeFile(pathForPluginId(plugin.id), JSON.stringify(pluginOptions, null, 2), function(err) {
      if(err) {
        console.error(err)
      }
      plugin.stop()
      plugin.start(newConfiguration, restart)
    })
  }
  if (options && options.enabled) {
    debug('Starting plugin ' + pluginName)
    plugin.start(getPluginOptions(plugin.id).configuration, restart)
  }
  app.plugins.push(plugin)

  var router = express.Router()
  router.get("/", (req, res) => {
    const options = getPluginOptions(plugin.id)
    res.json({
      enabled: options.enabled,
      id: plugin.id,
      name: plugin.name
    })
  })
  router.post("/config", (req, res) => {
    fs.writeFile(pathForPluginId(plugin.id), JSON.stringify(req.body, null, 2), function(err) {
      if (err) {
        console.log(err)
        res.status(500)
        res.send(err)
        return
      }
      res.send("Saved configuration for plugin " + plugin.id)
      plugin.stop()
      if (req.body && req.body.enabled) {
        plugin.start(req.body.configuration, restart)
      }
    });
  })
  if(typeof plugin.registerWithRouter != 'undefined') {
    plugin.registerWithRouter(router)
  }
  app.use("/plugins/" + plugin.id, router)
}
