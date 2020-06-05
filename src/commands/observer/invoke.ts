import chalk from 'chalk'
import log from 'consola'
import { invokeFunction } from 'resolve-cloud-common/lambda'
import { observerEvent, observerLambdaName } from '../../utils'

const handler = async (args): Promise<void> => {
  const { identifier, publish } = args
  const dryRun = args['dry-run']

  const lambdaName = observerLambdaName(identifier)
  const invocationType = dryRun ? 'DryRun' : 'RequestResponse'
  log.trace(`${invocationType} invocation of ${lambdaName}`)
  const result = await invokeFunction({
    FunctionName: lambdaName,
    Region: args.region,
    InvocationType: invocationType,
    Payload: observerEvent({
      publish
    })
  })
  log.info(result)
}

export = {
  handler,
  command: 'invoke',
  describe: chalk.green('invokes observer and returns results'),
  builder: yargs =>
    yargs
      .option('identifier', {
        describe: chalk.green('observer identifier (multiple instances)'),
        alias: 'id',
        type: 'string',
        default: 'default'
      })
      .option('publish', {
        describe: chalk.green('publish data gathered by observer to its web hook'),
        type: 'boolean',
        default: false
      })
      .option('dry-run', {
        describe: chalk.green('test invocation possibility'),
        type: 'boolean',
        default: false
      })
}
