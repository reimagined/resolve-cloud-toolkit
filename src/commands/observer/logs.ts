import chalk from 'chalk'
import log from 'consola'
import Lambda from 'aws-sdk/clients/lambda'

const handler = async (args): Promise<void> => {}

export = {
  handler,
  command: 'logs',
  describe: chalk.green('retrieve observer logs'),
  builder: yargs =>
    yargs.option('identifier', {
      describe: chalk.green('observer identifier (multiple instances)'),
      alias: 'id',
      type: 'string',
      default: 'default'
    })
}
