const glob = require('glob');
const path = require('path');

module.exports = (env, argv) => {
  const queriesPath = argv.queries.startsWith('./') ? argv.queries.substring(2) : argv.queries;

  const entry = glob.sync(queriesPath + '/**/*.gql').reduce((entry, file) => {
    entry[file.replace('.gql', '')] = './' + file;
    return entry;
  }, {});

  return {
    mode: 'production',
    entry,
    output: {
      path: process.cwd(),
      filename: '[name].gql.ts'
    },
    module: {
      rules: [
        {
          test: /\.gql?$/,
          use: [
            {
              loader: 'webpack-graphql-loader',
              options: {
                output: 'string',
                codegen: null
              }
            }
          ]
        }
      ]
    }
  };
};
