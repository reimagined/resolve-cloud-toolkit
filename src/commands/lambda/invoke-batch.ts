import fs from 'fs'
import { promisify } from 'util'
import { get, isEmpty, isString } from 'lodash'
import Promise from 'bluebird'
import chalk from 'chalk'
import log from 'consola'
import Lambda from 'aws-sdk/clients/lambda'

const readFile = promisify(fs.readFile)

const invokeSafe = async (
  lambda: Lambda,
  event: object,
  stopOnError: boolean,
  dryRun: boolean,
  arn: string
): Promise<void> => {
  try {
    const invocationType = dryRun ? 'DryRun' : 'Event'
    log.trace(`${invocationType} invocation of ${arn}`)
    await lambda
      .invoke({
        FunctionName: arn,
        InvocationType: invocationType,
        Payload: JSON.stringify(event)
      })
      .promise()
  } catch (err) {
    if (stopOnError) {
      throw err
    } else {
      log.warn(err.message)
    }
  }
}

const handler = async (args): Promise<void> => {
  const { source, event } = args
  const mapSourceAttribute = args['map-source-attribute']

  log.debug(`building Lambda client`)
  const lambda = new Lambda()

  log.debug(`retrieving lambdas to invoke`)
  const list = JSON.parse((await readFile(source)).toString('utf-8'))
    .map(src => (mapSourceAttribute ? get(src, mapSourceAttribute) : src))
    .filter(arn => isString(arn) && !isEmpty(arn))

  log.debug(`retrieving event`)
  const lambdaEvent = JSON.parse((await readFile(event)).toString('utf-8'))

  if (isEmpty(lambdaEvent)) {
    throw Error(`bad lambda event input`)
  }

  log.debug(`total lambdas to invoke ${list.length}`)
  log.trace(list)

  log.start(`begin invocations`)

  const invoke = invokeSafe.bind(null, lambda, lambdaEvent, args['stop-on-error'], args['dry-run'])

  await Promise.each(list, invoke)

  log.success(`completed successfully`)
}

export = {
  handler,
  command: 'invoke-batch <source> <event>',
  describe: chalk.green('batch lambda invocation based on JSON input'),
  builder: yargs =>
    yargs
      .positional('source', {
        describe: chalk.green(
          'a file containing a list of lambda ARN to invoke as array in JSON format'
        ),
        type: 'string'
      })
      .positional('event', {
        describe: chalk.green('a file containing a lambda event in JSON format'),
        type: 'string'
      })
      .option('map-source-attribute', {
        describe: chalk.green(
          'a path to ARN attribute if the source is an array of complex object (ex. payload.lambda.arn)'
        ),
        type: 'string'
      })
      .option('stop-on-error', {
        describe: chalk.green('stop on first invocation error encountered'),
        type: 'boolean',
        default: false
      })
      .option('dry-run', {
        describe: chalk.green('test invocations possibility'),
        type: 'boolean',
        default: false
      })
}
