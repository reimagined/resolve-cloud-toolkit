import fs from 'fs'
import { promisify } from 'util'
import Promise from 'bluebird'
import chalk from 'chalk'
import log from 'consola'
import { DocumentClient } from 'aws-sdk/clients/dynamodb'

import FilterConditionMap = DocumentClient.FilterConditionMap
import Key = DocumentClient.Key

const openFile = promisify(fs.open)
const writeFile = promisify(fs.write)
const closeFile = promisify(fs.close)
const truncateFile = promisify(fs.truncate)

type Args = {
  'scan-filter': FilterConditionMap
  'page-limit': number
}

const stream = async (
  dc: DocumentClient,
  table: string,
  fd: number,
  args: Args,
  separator = '',
  key?: Key
): Promise<void> => {
  const data = await dc
    .scan({
      TableName: table,
      ScanFilter: args['scan-filter'],
      Limit: args['page-limit'],
      ExclusiveStartKey: key
    })
    .promise()

  const { LastEvaluatedKey, Items } = data

  log.trace(`writing ${Items?.length} items to output file`)

  let currentSeparator = separator

  await Promise.each(Items, async item => {
    await writeFile(fd, `${currentSeparator}${JSON.stringify(item, null, 2)}\n`)
    if (!currentSeparator) {
      currentSeparator = ',\n'
    }
  })

  if (LastEvaluatedKey) {
    log.trace(`next key exist, proceed to next page`)
    await stream(dc, table, fd, args, currentSeparator, LastEvaluatedKey)
  }
}

const handler = async (args): Promise<void> => {
  const { table, file } = args

  log.debug(`building document client`)
  const dc = new DocumentClient()

  try {
    log.debug(`truncating file ${file}`)
    await truncateFile(file)
  } catch (err) {
    log.trace(err.message)
  }

  log.debug(`opening file ${file}`)
  const fd = await openFile(file, 'w')

  log.debug(`writing opening bracket`)
  await writeFile(fd, '[\n')

  try {
    log.start(`starting streaming table ${table} to the file ${args.file}`)
    await stream(dc, table, fd, args)

    log.debug(`writing closing bracket`)
    await writeFile(fd, ']\n')

    log.success(`completed`)
  } finally {
    log.debug(`closing file ${file}`)
    await closeFile(fd)
  }
}

export = {
  handler,
  command: 'export <table> <file>',
  describe: chalk.green('exports dynamo db table to file'),
  builder: yargs =>
    yargs
      .positional('table', {
        describe: chalk.green("an existing table's id"),
        type: 'string'
      })
      .positional('file', {
        describe: chalk.green('a file to write to'),
        type: 'string'
      })
      .option('scan-filter', {
        describe: chalk.green(
          'ScanFilter document client parameter as simple string [attribute] [operator] [value] (ex. status EQ destroyed)'
        ),
        type: 'string',
        coerce: (input: string): FilterConditionMap => {
          const parts = input.split(' ')
          if (parts.length !== 3) {
            throw Error(`invalid --scan-filter option value`)
          }
          return {
            [parts[0]]: {
              ComparisonOperator: parts[1],
              AttributeValueList: [parts[2]]
            }
          }
        }
      })
      .option('page-limit', {
        describe: chalk.green('limit number of items to scan within one request'),
        type: 'number',
        default: 1000
      })
}
