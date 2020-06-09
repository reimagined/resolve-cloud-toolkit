import chalk from 'chalk'

const handler = async (): Promise<void> => {
  /* not implemented */
}

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
