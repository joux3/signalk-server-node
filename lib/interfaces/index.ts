require('fs').readdirSync(__dirname + '/').forEach(function(file) {
  if (file.match(/.+\.ts$/g) !== null && file !== 'index.ts') {
    var name = file.replace('.ts', '');
    exports[name] = require('./' + file);
  }
});
