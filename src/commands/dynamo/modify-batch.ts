import Promise from 'bluebird'
import fs from 'fs'
import path from 'path'
import { promisify } from 'util'
import chalk from 'chalk'
import log from 'consola'
import flatObject from 'flat'
import { camelCase, mapKeys, get, reduce, isEmpty, unset } from 'lodash'
import { DocumentClient } from 'aws-sdk/clients/dynamodb'

const readFile = promisify(fs.readFile)

const handler = async (args): Promise<void> => {
  const { table, key: keyName, source, patch, mapSourceAttribute } = mapKeys(args, (_, key) =>
    camelCase(key)
  )
  log.debug(`reading source files`)
  const keys = JSON.parse((await readFile(path.resolve(source))).toString('utf-8')).map(item =>
    mapSourceAttribute ? get(item, mapSourceAttribute) : item
  )
  const updateParams = reduce(
    flatObject(JSON.parse((await readFile(path.resolve(patch))).toString('utf-8'))),
    (acc, val, key) => {
      acc.ExpressionAttributeNames[`#a_${acc.index}`] = key
      acc.ExpressionAttributeValues[`:v_${acc.index}`] = val
      acc.UpdateExpression += `${isEmpty(acc.UpdateExpression) ? '' : ','}SET #a_${acc.index}=:v_${
        acc.index
      }`
      acc.index++
      return acc
    },
    {
      index: 0,
      ExpressionAttributeNames: {},
      ExpressionAttributeValues: {},
      UpdateExpression: ''
    }
  )

  unset(updateParams, 'index')
  log.trace(updateParams)

  log.debug(`building document client`)
  const dc = new DocumentClient()

  log.start(`start sequence`)
  await Promise.each(keys, async key => {
    log.trace(`patching: ${key}`)
    await dc
      .update({
        TableName: table,
        Key: { [keyName]: key },
        ...updateParams
      })
      .promise()
  })
  log.success(`completed`)
}

export = {
  handler,
  command: 'modify-batch <table> <key> <source> <patch>',
  describe: chalk.green(''),
  builder: yargs =>
    yargs
      .positional('table', {
        describe: chalk.green("an existing table's id"),
        type: 'string'
      })
      .positional('key', {
        describe: chalk.green("a document's hash key name"),
        type: 'string'
      })
      .positional('source', {
        describe: chalk.green('a file containing items source'),
        type: 'string'
      })
      .positional('patch', {
        describe: chalk.green('a file containing patch'),
        type: 'string'
      })
      .option('map-source-attribute', {
        describe: chalk.green(
          'a path to item key value if a source is an array of objects (ex. item.id)'
        ),
        type: 'string'
      })
}
