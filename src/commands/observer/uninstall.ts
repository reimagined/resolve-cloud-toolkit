import chalk from 'chalk'
import log from 'consola'
import Lambda from 'aws-sdk/clients/lambda'

const handler = async (args): Promise<void> => {}

export = {
  handler,
  command: 'uninstall',
  describe: chalk.green('uninstalls observer from target region'),
  builder: yargs =>
    yargs.option('identifier', {
      describe: chalk.green('observer identifier (multiple instances)'),
      alias: 'id',
      type: 'string',
      default: 'default'
    })
}
