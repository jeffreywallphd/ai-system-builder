const rules = require('./webpack.rules');

/** @type {import('webpack').Configuration} */
module.exports = {
  module: {
    rules,
  },
  resolve: {
    extensions: ['.js', '.ts', '.tsx', '.json'],
  },
};
