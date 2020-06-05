import chalk from 'chalk'
import log from 'consola'
import Lambda from 'aws-sdk/clients/lambda'

const handler = async (args): Promise<void> => {}

export = {
  handler,
  command: 'invoke',
  describe: chalk.green('invokes observer and returns results'),
  builder: yargs =>
    yargs.option('identifier', {
      describe: chalk.green('observer identifier (multiple instances)'),
      alias: 'id',
      type: 'string',
      default: 'default'
    })
}
