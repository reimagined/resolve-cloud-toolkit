import chalk from 'chalk'
import log from 'consola'

const handler = () => {
  log.info('okay')
}

export = {
  handler,
  command: 'export <table> <file>',
  aliases: ['rm'],
  describe: chalk.green('remove environment variable'),
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
}
