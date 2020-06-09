import chalk from 'chalk'
import log from 'consola'
import fs from 'fs'
import path from 'path'
import { promisify } from 'util'
import { mapKeys, camelCase } from 'lodash'
import RDS, { ExecuteStatementResponse, Field } from 'aws-sdk/clients/rdsdataservice'
import { EOL } from 'os'

const writeFile = promisify(fs.writeFile)

const lifecycleDatabaseName = version => `deployment-command-queue-prod-${version}`
const lifecycleCommandTableName = 'commands'
const lifecycleStateTableName = 'state'

const escapeId = (str: string): string => `"${String(str).replace(/(["])/gi, '$1$1')}"`
const escape = (str: string): string => `'${String(str).replace(/(['])/gi, '$1$1')}'`

const coercer = ({ stringValue, longValue, booleanValue, doubleValue, isNull, ...rest }: Field) => {
  if (doubleValue != null) {
    return Number(doubleValue)
  }
  if (longValue != null) {
    return Number(longValue)
  }
  if (stringValue != null) {
    return String(stringValue)
  }
  if (booleanValue != null) {
    return Boolean(booleanValue)
  }
  if (isNull) {
    return null
  }
  throw new Error(`Unknown type ${JSON.stringify(rest)}`)
}

const isHighLoadError = error =>
  error != null &&
  (/Request timed out/i.test(error.message) ||
    /Remaining connection slots are reserved/i.test(error.message) ||
    /I\/O error occurr?ed/i.test(error.message) ||
    /too many clients already/i.test(error.message) ||
    /in a read-only transaction/i.test(error.message) ||
    error.code === 'ProvisionedThroughputExceededException' ||
    error.code === 'LimitExceededException' ||
    error.code === 'RequestLimitExceeded' ||
    error.code === 'ThrottlingException' ||
    error.code === 'TooManyRequestsException' ||
    error.code === 'NetworkingError')

const executeStatement = async (rds: RDS, resourceArn, secretArn, sql) => {
  const errors: any[] = []
  let rows: any[] | null = null

  try {
    // this cumbersome piece for https://github.com/microsoft/TypeScript/issues/11498
    const result: {
      response: ExecuteStatementResponse | null
    } = {
      response: null
    }

    const insist = async ref => {
      try {
        ref.response = await rds
          .executeStatement({
            resourceArn,
            secretArn,
            database: 'postgres',
            continueAfterTimeout: false,
            includeResultMetadata: true,
            sql
          })
          .promise()
      } catch (error) {
        if (isHighLoadError(error)) {
          await insist(ref)
        }
      }
    }

    await insist(result)

    if (result.response) {
      const { columnMetadata, records } = result.response

      if (records && Array.isArray(records) && columnMetadata && Array.isArray(columnMetadata)) {
        rows = records.map(record =>
          columnMetadata.reduce((acc, meta, index) => {
            if (meta.name) {
              acc[meta.name] = coercer(record[index])
            }
            return acc
          }, {})
        )
      }
    }
  } catch (error) {
    errors.push(Error(sql))
    errors.push(error)
  }

  if (errors.length > 0) {
    const error = new Error()
    error.message = errors.map(({ message }) => message).join(EOL)
    error.stack = errors.map(({ stack }) => stack).join(EOL)
    throw error
  }

  return rows
}

const handler = async (args): Promise<void> => {
  const { deployment, file, clusterArn, secretArn } = mapKeys(args, (_, key) => camelCase(key))

  log.debug(`analyzing deployment id`)

  const version = deployment.match(new RegExp('[0-9]+$'))[0]
  if (!version) {
    throw Error(`unsupported deployment id ${deployment}`)
  }

  const major = parseInt(version, 10)
  if (Number.isNaN(major) || major < 0) {
    throw Error(`unsupported deployment id ${deployment}`)
  }

  log.trace(`database name: ${lifecycleDatabaseName(major)}`)

  const execute = executeStatement.bind(null, new RDS(), clusterArn, secretArn)

  let sql = `
    SELECT * FROM ${escapeId(lifecycleDatabaseName(major))}.${escapeId(
    lifecycleStateTableName
  )} WHERE ${escapeId('deploymentId')} = ${escape(deployment)}    
    `

  log.trace(sql)

  const states = await execute(sql)

  log.trace(states[0])

  sql = `
    SELECT * FROM ${escapeId(lifecycleDatabaseName(major))}.${escapeId(
    lifecycleCommandTableName
  )} WHERE ${escapeId('deploymentId')} = ${escape(deployment)}    
  `
  const commands = await execute(sql)

  log.trace(commands)
  log.debug(`writing ${file}`)

  await writeFile(
    path.resolve(file),
    JSON.stringify(
      {
        date: new Date().toISOString(),
        state: {
          ...states[0],
          state: JSON.parse(states[0].state)
        },
        commands: commands.map(command => {
          if (command.command) {
            command.command = JSON.parse(command.command)
          }
          return command
        })
      },
      null,
      2
    )
  )
}

export = {
  handler,
  command: 'export-deployment <deployment> <file>',
  aliases: ['exp-dep'],
  describe: chalk.green('exports postresql data for specific deployment'),
  builder: yargs =>
    yargs
      .positional('deployment', {
        describe: chalk.green('deployment identifier'),
        type: 'string'
      })
      .positional('file', {
        describe: chalk.green('a file name for JSON output'),
        type: 'string'
      })
      .option('cluster-arn', {
        describe: chalk.green('postgresql cluster ARN'),
        type: 'string'
      })
      .option('secret-arn', {
        describe: chalk.green('secret manager resource ARN used to access to the cluster'),
        type: 'string'
      })
      .demandOption(['cluster-arn', 'secret-arn'])
}
