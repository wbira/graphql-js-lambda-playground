const glob = require('glob');
const { generate } = require('graphql-code-generator');
const { readFileSync, unlinkSync, writeFileSync } = require('fs');
const { basename, resolve, dirname } = require('path');
const {
  append,
  compose,
  concat,
  converge,
  flatten,
  flip,
  groupBy,
  head,
  join,
  map,
  pipe,
  pluck,
  prepend,
  prop,
  slice,
  split,
  tail,
  tap,
  transduce,
  values,
  fromPairs
} = require('ramda');

const toCamelCase = pipe(
  split('-'),
  converge(concat, [
    head,
    pipe(
      tail,
      map(
        pipe(
          split(''),
          ([head, ...tail]) => [head.toUpperCase(), ...tail].join('')
        )
      ),
      join('')
    )
  ])
);

const makeName = pipe(
  prop('path'),
  file => basename(file, '.gql.ts'),
  toCamelCase
);

const printReport = pipe(
  values,
  flatten,
  map(({ dirname, basename }) => ` \x1b[32m✔\x1b[0m ${dirname}/${basename}`),
  prepend('\nTypescript modules created from following graphQL files:\n'),
  append(''), // add a break line
  join('\n'),
  console.log
);

const makeBarrel = pipe(
  pluck('path'),
  map(filePath => ({
    basename: basename(filePath),
    dirname: dirname(filePath)
  })),
  groupBy(prop('dirname')),
  map(files => {
    const dirname = prop('dirname', head(files));
    const content = pipe(
      pluck('basename'),
      map(name => `export * from './${name.replace('.gql.ts', '')}';`),
      join('\n')
    )(files);

    writeFileSync(resolve(dirname + '/index.ts'), content);

    return files;
  })
);

const wrapQueries = transduce(
  compose(
    map(filePath => ({
      path: filePath,
      source: readFileSync(filePath).toString()
    })),
    map(fileData => ({
      ...fileData,
      extractedSource: fileData.source.match(/module.exports = \"([^\"]*)\"/)[1].replace(/\\n/g, '\n')
    })),
    map(fileData => {
      return {
        ...fileData,
        content: `/* tslint:disable */\nexport const ${makeName(fileData)} = \`${fileData.extractedSource}\`;`
      };
    }),
    map(fileData => {
      writeFileSync(resolve(fileData.path.replace('.gql.ts', '.ts')), fileData.content);
      unlinkSync(resolve(fileData.path));
      return fileData;
    })
  ),
  flip(append),
  []
);

async function generateGraphQLTypes({ endpoint, queries, output }) {
  await generate(
    {
      schema: endpoint,
      overwrite: true,
      documents: queries,
      generates: {
        [resolve(process.cwd(), output)]: {
          plugins: ['typescript-common', 'typescript-server']
        }
      }
    },
    true
  );
}

const parseOptions = pipe(
  slice(2, Infinity),
  map(split('=')),
  map(([prop, value]) => [prop.replace(/^--/, ''), value]),
  fromPairs
);

const buildModules = pipe(
  prop('queries'),
  glob.sync,
  wrapQueries,
  makeBarrel,
  printReport
);

/**
 * Convert graphql files to typescript modules
 */
const graphqlToTs = pipe(
  parseOptions,
  tap(generateGraphQLTypes),
  tap(buildModules)
);

graphqlToTs(process.argv);
